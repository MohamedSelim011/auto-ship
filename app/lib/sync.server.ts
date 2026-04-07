import prisma from "../db.server";
import shopify from "../shopify.server";
import { getOrderUpdateHistory, createQPOrder } from "./qpexpress.server";
import { resolveCityId } from "./city-mapping";
import { QP_TO_SHOPIFY_EVENT, shouldCreateFulfillment } from "./status-mapping";
import {
  getOpenFulfillmentOrderId,
  createFulfillment,
  addFulfillmentEvent,
} from "./shopify-fulfillment.server";

const SYNC_INTERVAL_MS = 5 * 60 * 1000;
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

// Only syncs delivery statuses back from QPExpress — does NOT auto-send orders
export async function syncShop(shop: string) {
  const lastSynced = await prisma.orderMapping.findFirst({
    where: { shop, lastSyncedAt: { not: null } },
    orderBy: { lastSyncedAt: "desc" },
    select: { lastSyncedAt: true },
  });

  const fromDate = lastSynced?.lastSyncedAt
    ? lastSynced.lastSyncedAt.toISOString().split("T")[0]
    : undefined;

  const updates = await getOrderUpdateHistory(shop, fromDate);
  const statusUpdates = updates.filter((u) => u.field === "Order_Delivery_Status");

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
}

// Sends specific orders (by OrderMapping IDs) to QPExpress
export async function sendOrdersToQP(shop: string, mappingIds: string[]) {
  const { admin } = await shopify.unauthenticated.admin(shop);

  for (const mappingId of mappingIds) {
    const mapping = await prisma.orderMapping.findUnique({ where: { id: mappingId } });
    if (!mapping) continue;

    try {
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
              firstName lastName address1 city phone
            }
            lineItems(first: 20) { nodes { title quantity } }
            customer { phone }
          }
        }`,
        { variables: { id: mapping.shopifyOrderId } }
      );

      const orderData = await orderResponse.json();
      const order = orderData.data?.order;
      if (!order) {
        await prisma.orderMapping.update({
          where: { id: mappingId },
          data: { syncStatus: "failed", errorMessage: "Order not found in Shopify" },
        });
        continue;
      }

      const shippingAddress = order.shippingAddress;
      const phone = shippingAddress?.phone || order.customer?.phone || "";
      const fullName = `${shippingAddress?.firstName ?? ""} ${shippingAddress?.lastName ?? ""}`.trim();
      const cityId = resolveCityId(shippingAddress?.city ?? "");
      const lineItemTitles = order.lineItems.nodes
        .map((li: { title: string; quantity: number }) => `${li.title} x${li.quantity}`)
        .join(", ");

      // Paid online → amount = 0 (nothing to collect on delivery)
      const totalAmount = mapping.isPaidOnline
        ? 0
        : parseFloat(order.totalPriceSet.shopMoney.amount);

      const qpOrder = await createQPOrder(shop, {
        full_name: fullName,
        phone,
        address: shippingAddress?.address1 ?? "",
        city: cityId,
        total_amount: totalAmount,
        notes: order.note ?? "",
        order_date: new Date().toISOString(),
        shipment_contents: lineItemTitles,
        referenceID: mapping.shopifyOrderNumber,
      });

      await prisma.orderMapping.update({
        where: { id: mappingId },
        data: {
          qpExpressSerial: String(qpOrder.serial),
          qpStatus: qpOrder.Order_Delivery_Status,
          syncStatus: "synced",
          errorMessage: null,
          lastSyncedAt: new Date(),
        },
      });

      console.log(`[Send] ${mapping.shopifyOrderNumber} → QPExpress serial ${qpOrder.serial}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[Send] Failed for ${mapping.shopifyOrderNumber}:`, message);
      await prisma.orderMapping.update({
        where: { id: mappingId },
        data: { syncStatus: "failed", errorMessage: message },
      });
    }
  }
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
      const fulfillmentOrderId = await getOpenFulfillmentOrderId(admin, mapping.shopifyOrderId);
      if (!fulfillmentOrderId) return;
      fulfillmentId = await createFulfillment(admin, fulfillmentOrderId, mapping.qpExpressSerial ?? "");
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
    console.error(`[QPExpress Sync] Failed to update Shopify fulfillment for ${mapping.shopifyOrderId}:`, err);
  }
}
