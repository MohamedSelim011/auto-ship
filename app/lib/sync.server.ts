import prisma from "../db.server";
import shopify from "../shopify.server";
import { getOrderUpdateHistory, createQPOrder } from "./qpexpress.server";
import { resolveCityId } from "./city-mapping";
import {
  QP_TO_SHOPIFY_EVENT,
  shouldCreateFulfillment,
} from "./status-mapping";
import {
  getOpenFulfillmentOrderId,
  createFulfillment,
  addFulfillmentEvent,
} from "./shopify-fulfillment.server";

const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
let schedulerStarted = false;

export function startScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;

  setInterval(async () => {
    try {
      await syncAllShops();
    } catch (err) {
      console.error("[QPExpress Scheduler] Error:", err);
    }
  }, SYNC_INTERVAL_MS);

  console.log("[QPExpress Scheduler] Started — polling every 5 minutes");
}

export async function syncAllShops() {
  const configs = await prisma.qPExpressConfig.findMany();
  for (const config of configs) {
    await syncShop(config.shop).catch((err) =>
      console.error(`[QPExpress Sync] Failed for ${config.shop}:`, err)
    );
  }
}

export async function syncShop(shop: string) {
  // Find last synced time to use as from_date
  const lastSynced = await prisma.orderMapping.findFirst({
    where: { shop, lastSyncedAt: { not: null } },
    orderBy: { lastSyncedAt: "desc" },
    select: { lastSyncedAt: true },
  });

  const fromDate = lastSynced?.lastSyncedAt
    ? lastSynced.lastSyncedAt.toISOString().split("T")[0]
    : undefined;

  const updates = await getOrderUpdateHistory(shop, fromDate);

  // Only process Order_Delivery_Status field changes
  const statusUpdates = updates.filter(
    (u) => u.field === "Order_Delivery_Status"
  );

  for (const update of statusUpdates) {
    const serial = String(update.serial);
    const mapping = await prisma.orderMapping.findFirst({
      where: { shop, qpExpressSerial: serial },
    });

    if (!mapping) continue;

    const shopifyEvent = QP_TO_SHOPIFY_EVENT[update.new_value];

    if (shopifyEvent && shouldCreateFulfillment(update.new_value)) {
      await updateShopifyFulfillmentStatus(shop, mapping, shopifyEvent);
    }

    await prisma.orderMapping.update({
      where: { id: mapping.id },
      data: {
        qpStatus: update.new_value,
        lastSyncedAt: new Date(),
        syncStatus: "synced",
        errorMessage: null,
      },
    });
  }

  // Retry failed orders
  await retryFailedOrders(shop);
}

async function updateShopifyFulfillmentStatus(
  shop: string,
  mapping: {
    id: string;
    shopifyOrderId: string;
    shopifyFulfillmentId: string | null;
    qpExpressSerial: string | null;
  },
  shopifyEvent: string
) {
  try {
    const { admin } = await shopify.unauthenticated.admin(shop);

    let fulfillmentId = mapping.shopifyFulfillmentId;

    if (!fulfillmentId) {
      const fulfillmentOrderId = await getOpenFulfillmentOrderId(
        admin,
        mapping.shopifyOrderId
      );
      if (!fulfillmentOrderId) return;

      fulfillmentId = await createFulfillment(
        admin,
        fulfillmentOrderId,
        mapping.qpExpressSerial ?? ""
      );

      if (fulfillmentId) {
        await prisma.orderMapping.update({
          where: { id: mapping.id },
          data: { shopifyFulfillmentId: fulfillmentId },
        });
      }
    }

    if (fulfillmentId) {
      await addFulfillmentEvent(admin, fulfillmentId, shopifyEvent);
    }
  } catch (err) {
    console.error(
      `[QPExpress Sync] Failed to update Shopify fulfillment for order ${mapping.shopifyOrderId}:`,
      err
    );
  }
}

export async function retryFailedOrders(shop: string) {
  const failedOrders = await prisma.orderMapping.findMany({
    where: { shop, syncStatus: "failed", retryCount: { lt: 2 } },
  });

  if (failedOrders.length === 0) return;

  const { admin } = await shopify.unauthenticated.admin(shop);

  for (const mapping of failedOrders) {
    try {
      // Re-fetch the Shopify order to get the original data
      const orderResponse = await admin.graphql(
        `#graphql
        query getOrder($id: ID!) {
          order(id: $id) {
            id
            name
            createdAt
            note
            totalPriceSet { shopMoney { amount } }
            shippingAddress {
              firstName
              lastName
              address1
              city
              phone
            }
            lineItems(first: 20) {
              nodes { title quantity }
            }
            customer { phone }
          }
        }`,
        { variables: { id: mapping.shopifyOrderId } }
      );

      const orderData = await orderResponse.json();
      const order = orderData.data?.order;
      if (!order) continue;

      const shippingAddress = order.shippingAddress;
      const lineItemTitles = order.lineItems.nodes
        .map((li: { title: string; quantity: number }) => `${li.title} x${li.quantity}`)
        .join(", ");

      const phone =
        shippingAddress?.phone || order.customer?.phone || "";

      const cityId = resolveCityId(shippingAddress?.city ?? "");
      if (!cityId) {
        await prisma.orderMapping.update({
          where: { id: mapping.id },
          data: {
            retryCount: { increment: 1 },
            errorMessage: `Unknown city "${shippingAddress?.city}". Cannot map to QPExpress.`,
            syncStatus: "failed",
          },
        });
        continue;
      }

      const qpOrder = await createQPOrder(shop, {
        full_name: `${shippingAddress?.firstName ?? ""} ${shippingAddress?.lastName ?? ""}`.trim(),
        phone,
        address: shippingAddress?.address1 ?? "",
        city: cityId,
        total_amount: parseFloat(order.totalPriceSet.shopMoney.amount),
        notes: order.note ?? "",
        order_date: order.createdAt,
        shipment_contents: lineItemTitles,
        referenceID: mapping.shopifyOrderNumber,
      });

      await prisma.orderMapping.update({
        where: { id: mapping.id },
        data: {
          qpExpressSerial: String(qpOrder.serial),
          syncStatus: "synced",
          errorMessage: null,
          retryCount: { increment: 1 },
          lastSyncedAt: new Date(),
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await prisma.orderMapping.update({
        where: { id: mapping.id },
        data: {
          retryCount: { increment: 1 },
          errorMessage: message,
          syncStatus: mapping.retryCount + 1 >= 2 ? "failed" : "failed",
        },
      });
    }
  }
}
