import prisma from "../db.server";

const BASE_URL =
  process.env.QP_EXPRESS_BASE_URL || "https://qpxpress.com:8001";

export interface QPOrderInput {
  full_name: string;
  phone: string;
  address: string;
  total_amount: number;
  notes?: string;
  order_date: string;
  shipment_contents: string;
  weight?: string;
  city: number | string;
  referenceID?: string | number;
}

export interface QPOrder {
  serial: number;
  order_date: string;
  shipment_contents: string;
  weight: string;
  full_name: string;
  phone: string;
  city: string;
  notes: string;
  total_amount: string;
  total_fees: string;
  Order_Delivery_Status: string;
  address: string;
  created_date: string;
  update_date: string;
  StatusNote: string;
  has_return: boolean;
  return_count: number;
  referenceID: string;
}

export interface QPOrderUpdate {
  serial: number;
  referenceID: string;
  full_name: string;
  phone: string;
  field: string;
  old_value: string;
  new_value: string;
  notes: string;
  transaction_date: string;
}

async function getToken(shop: string): Promise<string> {
  const config = await prisma.qPExpressConfig.findUnique({ where: { shop } });
  if (!config) throw new Error("QPExpress not configured for this shop");

  if (config.token) return config.token;

  return refreshToken(shop, config.username, config.password);
}

async function refreshToken(
  shop: string,
  username: string,
  password: string
): Promise<string> {
  const response = await fetch(`${BASE_URL}/integration/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) throw new Error("QPExpress authentication failed");

  const data = await response.json();
  const token: string = data.token;

  await prisma.qPExpressConfig.update({
    where: { shop },
    data: { token },
  });

  return token;
}

async function authedFetch(
  shop: string,
  url: string,
  options: RequestInit = {},
  retry = true
): Promise<Response> {
  const token = await getToken(shop);
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (response.status === 401 && retry) {
    // Clear cached token and retry once
    await prisma.qPExpressConfig.update({ where: { shop }, data: { token: null } });
    return authedFetch(shop, url, options, false);
  }

  return response;
}

export async function testConnection(
  username: string,
  password: string
): Promise<{ ok: boolean; companyName?: string; error?: string }> {
  try {
    const response = await fetch(`${BASE_URL}/integration/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) return { ok: false, error: "Invalid credentials" };

    const data = await response.json();
    return { ok: true, companyName: data.company_name };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[QPExpress] testConnection error:", msg);
    return { ok: false, error: `Could not reach QPExpress API: ${msg}` };
  }
}

export async function createQPOrder(
  shop: string,
  orderData: QPOrderInput
): Promise<QPOrder> {
  const response = await authedFetch(
    shop,
    `${BASE_URL}/integration/order`,
    {
      method: "POST",
      body: JSON.stringify(orderData),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(JSON.stringify(error));
  }

  return response.json();
}

export async function getOrderUpdateHistory(
  shop: string,
  fromDate?: string
): Promise<QPOrderUpdate[]> {
  const params = new URLSearchParams({
    page_size: "200",
    page: "1",
    ...(fromDate ? { from_date: fromDate } : {}),
  });

  const response = await authedFetch(
    shop,
    `${BASE_URL}/integration/get_order_update_history?${params}`
  );

  if (!response.ok) throw new Error("Failed to fetch QPExpress update history");

  return response.json();
}

export async function getQPOrder(
  shop: string,
  serial: string
): Promise<QPOrder> {
  const response = await authedFetch(
    shop,
    `${BASE_URL}/integration/order/${serial}`
  );

  if (!response.ok) throw new Error(`QPExpress order ${serial} not found`);

  return response.json();
}
