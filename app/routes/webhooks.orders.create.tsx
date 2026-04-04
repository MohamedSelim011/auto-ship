import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { createQPOrder } from "../lib/qpexpress.server";
import { resolveCityId } from "../lib/city-mapping";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, payload, topic } = await authenticate.webhook(request);

  console.log(`[Webhook] ${topic} for ${shop}`);

  const order = payload as {
    id: number;
    name: string;
    created_at: string;
    note?: string;
    total_price: string;
    customer?: { phone?: string };
    shipping_address?: {
      first_name?: string;
      last_name?: string;
      address1?: string;
      city?: string;
      phone?: string;
    };
    line_items: Array<{ title: string; quantity: number }>;
  };

  const shopifyOrderId = `gid://shopify/Order/${order.id}`;
  const shopifyOrderNumber = order.name; // e.g. "#1001"

  // Check if QPExpress is configured for this shop
  const config = await prisma.qPExpressConfig.findUnique({ where: { shop } });
  if (!config) {
    console.log(`[Webhook] QPExpress not configured for ${shop} — skipping`);
    return new Response(null, { status: 200 });
  }

  // Avoid duplicate processing
  const existing = await prisma.orderMapping.findUnique({
    where: { shop_shopifyOrderId: { shop, shopifyOrderId } },
  });
  if (existing) {
    return new Response(null, { status: 200 });
  }

  const shippingAddress = order.shipping_address;
  const phone = shippingAddress?.phone || order.customer?.phone || "";
  const fullName = [shippingAddress?.first_name, shippingAddress?.last_name]
    .filter(Boolean)
    .join(" ");

  // Skip orders missing required fields — QPExpress will reject them anyway
  if (!shippingAddress || !fullName || !phone || !shippingAddress.address1 || !shippingAddress.city) {
    console.log(`[Webhook] Order ${shopifyOrderNumber} missing required fields — skipping`);
    return new Response(null, { status: 200 });
  }

  const cityId = resolveCityId(shippingAddress.city);

  const lineItemTitles = order.line_items
    .map((li) => `${li.title} x${li.quantity}`)
    .join(", ");

  // Create the DB record immediately so we can track it
  const mapping = await prisma.orderMapping.create({
    data: {
      shop,
      shopifyOrderId,
      shopifyOrderNumber,
      syncStatus: "pending",
    },
  });

  try {
    const qpOrder = await createQPOrder(shop, {
      full_name: fullName,
      phone,
      address: shippingAddress?.address1 ?? "",
      city: cityId,
      total_amount: parseFloat(order.total_price),
      notes: order.note ?? "",
      order_date: order.created_at,
      shipment_contents: lineItemTitles,
      referenceID: order.name,
    });

    await prisma.orderMapping.update({
      where: { id: mapping.id },
      data: {
        qpExpressSerial: String(qpOrder.serial),
        qpStatus: qpOrder.Order_Delivery_Status,
        syncStatus: "synced",
        lastSyncedAt: new Date(),
      },
    });

    console.log(
      `[Webhook] Order ${shopifyOrderNumber} → QPExpress serial ${qpOrder.serial}`
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Webhook] Failed to create QPExpress order for ${shopifyOrderNumber}:`, message);

    await prisma.orderMapping.update({
      where: { id: mapping.id },
      data: {
        syncStatus: "failed",
        errorMessage: message,
        retryCount: 1,
      },
    });
  }

  return new Response(null, { status: 200 });
};
