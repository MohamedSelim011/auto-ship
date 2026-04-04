import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, payload, topic } = await authenticate.webhook(request);

  console.log(`[Webhook] ${topic} for ${shop}`);

  const order = payload as {
    id: number;
    name: string;
    financial_status: string; // "paid" | "pending" | "voided" etc.
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
  const shopifyOrderNumber = order.name;

  const config = await prisma.qPExpressConfig.findUnique({ where: { shop } });
  if (!config) {
    console.log(`[Webhook] QPExpress not configured for ${shop} — skipping`);
    return new Response(null, { status: 200 });
  }

  const existing = await prisma.orderMapping.findUnique({
    where: { shop_shopifyOrderId: { shop, shopifyOrderId } },
  });
  if (existing) return new Response(null, { status: 200 });

  const shippingAddress = order.shipping_address;
  const phone = shippingAddress?.phone || order.customer?.phone || "";
  const customerName = [shippingAddress?.first_name, shippingAddress?.last_name]
    .filter(Boolean)
    .join(" ");
  const addressLine = [shippingAddress?.address1, shippingAddress?.city]
    .filter(Boolean)
    .join(", ");

  // "paid" = online payment, anything else = COD
  const isPaidOnline = order.financial_status === "paid";

  await prisma.orderMapping.create({
    data: {
      shop,
      shopifyOrderId,
      shopifyOrderNumber,
      syncStatus: "new",
      customerName: customerName || null,
      customerPhone: phone || null,
      shippingAddress: addressLine || null,
      isPaidOnline,
    },
  });

  console.log(`[Webhook] Order ${shopifyOrderNumber} saved (${isPaidOnline ? "paid online" : "COD"}) — waiting for manual send`);
  return new Response(null, { status: 200 });
};
