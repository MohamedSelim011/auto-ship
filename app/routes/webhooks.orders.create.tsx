import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

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
  const shopifyOrderNumber = order.name;

  // Only track orders if QPExpress is configured for this shop
  const config = await prisma.qPExpressConfig.findUnique({ where: { shop } });
  if (!config) {
    console.log(`[Webhook] QPExpress not configured for ${shop} — skipping`);
    return new Response(null, { status: 200 });
  }

  // Avoid duplicates
  const existing = await prisma.orderMapping.findUnique({
    where: { shop_shopifyOrderId: { shop, shopifyOrderId } },
  });
  if (existing) {
    return new Response(null, { status: 200 });
  }

  // Save as "new" — merchant will manually select and send to QPExpress
  await prisma.orderMapping.create({
    data: {
      shop,
      shopifyOrderId,
      shopifyOrderNumber,
      syncStatus: "new",
    },
  });

  console.log(`[Webhook] Order ${shopifyOrderNumber} saved — waiting for manual send`);
  return new Response(null, { status: 200 });
};
