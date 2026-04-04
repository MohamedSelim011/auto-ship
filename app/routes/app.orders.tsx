import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { QP_STATUS_LABEL, QP_STATUS_TONE } from "../lib/status-mapping";
import { retryFailedOrders } from "../lib/sync.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const orders = await prisma.orderMapping.findMany({
    where: { shop: session.shop },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return { orders };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "retry-all") {
    await retryFailedOrders(session.shop);
    return { retried: true };
  }

  if (intent === "retry-one") {
    const id = formData.get("id") as string;
    await prisma.orderMapping.update({
      where: { id },
      data: { retryCount: 0 },
    });
    await retryFailedOrders(session.shop);
    return { retried: true };
  }

  return null;
};

type Order = {
  id: string;
  shopifyOrderNumber: string;
  shopifyOrderId: string;
  qpExpressSerial: string | null;
  qpStatus: string | null;
  syncStatus: string;
  retryCount: number;
  errorMessage: string | null;
  lastSyncedAt: string | null;
  createdAt: string;
};

function syncStatusTone(status: string) {
  if (status === "synced") return "success";
  if (status === "failed") return "critical";
  return "attention";
}

function syncStatusLabel(status: string) {
  if (status === "synced") return "Synced";
  if (status === "failed") return "Failed";
  return "Pending";
}

export default function Orders() {
  const { orders } = useLoaderData<{ orders: Order[] }>();
  const fetcher = useFetcher();
  const isRetrying = fetcher.state === "submitting";

  const failedCount = orders.filter((o) => o.syncStatus === "failed").length;

  function retryAll() {
    const fd = new FormData();
    fd.set("intent", "retry-all");
    fetcher.submit(fd, { method: "post" });
  }

  function retryOne(id: string) {
    const fd = new FormData();
    fd.set("intent", "retry-one");
    fd.set("id", id);
    fetcher.submit(fd, { method: "post" });
  }

  return (
    <s-page heading="QPExpress Orders">
      {failedCount > 0 && (
        <s-banner tone="warning">
          <p>
            {failedCount} order{failedCount > 1 ? "s" : ""} failed to sync with QPExpress.
          </p>
          <s-button
            variant="secondary"
            loading={isRetrying}
            onClick={retryAll}
          >
            Retry All Failed
          </s-button>
        </s-banner>
      )}

      <s-section heading={`${orders.length} Orders`}>
        {orders.length === 0 ? (
          <s-paragraph>
            No orders synced yet. Orders will appear here after the first
            Shopify order is placed.
          </s-paragraph>
        ) : (
          <s-box
            padding="none"
            borderWidth="base"
            borderRadius="base"
            overflow="hidden"
          >
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f6f6f7" }}>
                  <th style={thStyle}>Shopify Order</th>
                  <th style={thStyle}>QPExpress Serial</th>
                  <th style={thStyle}>Delivery Status</th>
                  <th style={thStyle}>Sync Status</th>
                  <th style={thStyle}>Last Synced</th>
                  <th style={thStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} style={{ borderTop: "1px solid #e1e3e5" }}>
                    <td style={tdStyle}>
                      <s-link
                        href={`https://admin.shopify.com/orders/${order.shopifyOrderId.split("/").pop()}`}
                        target="_blank"
                      >
                        {order.shopifyOrderNumber}
                      </s-link>
                    </td>
                    <td style={tdStyle}>
                      {order.qpExpressSerial ?? (
                        <span style={{ color: "#8c9196" }}>—</span>
                      )}
                    </td>
                    <td style={tdStyle}>
                      {order.qpStatus ? (
                        <s-badge
                          tone={QP_STATUS_TONE[order.qpStatus] ?? "attention"}
                        >
                          {QP_STATUS_LABEL[order.qpStatus] ?? order.qpStatus}
                        </s-badge>
                      ) : (
                        <s-badge tone="attention">Pending</s-badge>
                      )}
                    </td>
                    <td style={tdStyle}>
                      <s-badge tone={syncStatusTone(order.syncStatus)}>
                        {syncStatusLabel(order.syncStatus)}
                      </s-badge>
                      {order.errorMessage && (
                        <div
                          style={{
                            fontSize: "12px",
                            color: "#d82c0d",
                            marginTop: "4px",
                            maxWidth: "200px",
                          }}
                          title={order.errorMessage}
                        >
                          {order.errorMessage.slice(0, 60)}
                          {order.errorMessage.length > 60 ? "…" : ""}
                        </div>
                      )}
                    </td>
                    <td style={tdStyle}>
                      {order.lastSyncedAt
                        ? new Date(order.lastSyncedAt).toLocaleString()
                        : "—"}
                    </td>
                    <td style={tdStyle}>
                      {order.syncStatus === "failed" && (
                        <s-button
                          variant="secondary"
                          size="slim"
                          loading={isRetrying}
                          onClick={() => retryOne(order.id)}
                        >
                          Retry
                        </s-button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </s-box>
        )}
      </s-section>
    </s-page>
  );
}

const thStyle: React.CSSProperties = {
  padding: "10px 12px",
  textAlign: "left",
  fontSize: "13px",
  fontWeight: 600,
  color: "#202223",
};

const tdStyle: React.CSSProperties = {
  padding: "10px 12px",
  fontSize: "14px",
  verticalAlign: "middle",
};
