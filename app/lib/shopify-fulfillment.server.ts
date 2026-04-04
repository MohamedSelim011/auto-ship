import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";

/**
 * Gets the first OPEN fulfillment order ID for a given Shopify order.
 */
export async function getOpenFulfillmentOrderId(
  admin: AdminApiContext["admin"],
  shopifyOrderId: string
): Promise<string | null> {
  const response = await admin.graphql(
    `#graphql
    query getOrderFulfillmentOrders($orderId: ID!) {
      order(id: $orderId) {
        fulfillmentOrders(first: 10) {
          nodes {
            id
            status
          }
        }
      }
    }`,
    { variables: { orderId: shopifyOrderId } }
  );

  const data = await response.json();
  const nodes = data.data?.order?.fulfillmentOrders?.nodes ?? [];
  const open = nodes.find((fo: { id: string; status: string }) => fo.status === "OPEN");
  return open?.id ?? null;
}

/**
 * Creates a Shopify fulfillment for an order and returns the fulfillment GID.
 */
export async function createFulfillment(
  admin: AdminApiContext["admin"],
  fulfillmentOrderId: string,
  trackingNumber: string
): Promise<string | null> {
  const response = await admin.graphql(
    `#graphql
    mutation fulfillmentCreateV2($fulfillment: FulfillmentV2Input!) {
      fulfillmentCreateV2(fulfillment: $fulfillment) {
        fulfillment {
          id
          status
        }
        userErrors {
          field
          message
        }
      }
    }`,
    {
      variables: {
        fulfillment: {
          lineItemsByFulfillmentOrder: [
            { fulfillmentOrderId },
          ],
          trackingInfo: {
            number: trackingNumber,
            company: "QPExpress",
          },
          notifyCustomer: false,
        },
      },
    }
  );

  const data = await response.json();
  const userErrors = data.data?.fulfillmentCreateV2?.userErrors ?? [];
  if (userErrors.length > 0) {
    console.error("Fulfillment create errors:", userErrors);
    return null;
  }

  return data.data?.fulfillmentCreateV2?.fulfillment?.id ?? null;
}

/**
 * Adds a fulfillment event (e.g. IN_TRANSIT, DELIVERED) to an existing fulfillment.
 */
export async function addFulfillmentEvent(
  admin: AdminApiContext["admin"],
  fulfillmentId: string,
  status: string
): Promise<void> {
  const response = await admin.graphql(
    `#graphql
    mutation fulfillmentEventCreate($fulfillmentEvent: FulfillmentEventInput!) {
      fulfillmentEventCreate(fulfillmentEvent: $fulfillmentEvent) {
        fulfillmentEvent {
          id
          status
        }
        userErrors {
          field
          message
        }
      }
    }`,
    {
      variables: {
        fulfillmentEvent: {
          fulfillmentId,
          status,
        },
      },
    }
  );

  const data = await response.json();
  const userErrors = data.data?.fulfillmentEventCreate?.userErrors ?? [];
  if (userErrors.length > 0) {
    console.error("Fulfillment event errors:", userErrors);
  }
}
