import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { syncShop } from "../lib/sync.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const [config, totalOrders, failedOrders, lastSynced] = await Promise.all([
    prisma.qPExpressConfig.findUnique({
      where: { shop },
      select: { username: true },
    }),
    prisma.orderMapping.count({ where: { shop } }),
    prisma.orderMapping.count({ where: { shop, syncStatus: "failed" } }),
    prisma.orderMapping.findFirst({
      where: { shop, lastSyncedAt: { not: null } },
      orderBy: { lastSyncedAt: "desc" },
      select: { lastSyncedAt: true },
    }),
  ]);

  return {
    isConfigured: !!config,
    username: config?.username ?? null,
    totalOrders,
    failedOrders,
    lastSyncedAt: lastSynced?.lastSyncedAt?.toISOString() ?? null,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  await syncShop(session.shop);
  return { synced: true, syncedAt: new Date().toISOString() };
};

export default function Dashboard() {
  const { isConfigured, username, totalOrders, failedOrders, lastSyncedAt } =
    useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const isSyncing = fetcher.state === "submitting";

  return (
    <s-page heading="AutoShip — QPExpress Integration">
      {!isConfigured && (
        <s-banner tone="warning">
          <p>
            QPExpress credentials are not configured yet.{" "}
            <s-link href="/app/settings">Go to Settings</s-link> to connect
            your QPExpress account.
          </p>
        </s-banner>
      )}

      <s-section heading="Connection Status">
        <s-stack direction="block" gap="base">
          {isConfigured ? (
            <s-badge tone="success">Connected — {username}</s-badge>
          ) : (
            <s-badge tone="critical">Not Connected</s-badge>
          )}
          <s-paragraph>
            {isConfigured
              ? "QPExpress is connected. New Shopify orders will automatically be created in QPExpress and delivery statuses will sync back every 5 minutes."
              : "Connect your QPExpress account to start syncing orders."}
          </s-paragraph>
        </s-stack>
      </s-section>

      <s-section heading="Order Statistics">
        <s-stack direction="inline" gap="loose">
          <s-box
            padding="base"
            borderWidth="base"
            borderRadius="base"
          >
            <s-text variant="headingLg">{totalOrders}</s-text>
            <s-paragraph>Total Orders Synced</s-paragraph>
          </s-box>

          <s-box
            padding="base"
            borderWidth="base"
            borderRadius="base"
          >
            <s-text variant="headingLg">{failedOrders}</s-text>
            <s-paragraph>Failed Orders</s-paragraph>
          </s-box>

          <s-box
            padding="base"
            borderWidth="base"
            borderRadius="base"
          >
            <s-text variant="headingLg">
              {lastSyncedAt
                ? new Date(lastSyncedAt).toLocaleTimeString()
                : "—"}
            </s-text>
            <s-paragraph>
              {lastSyncedAt
                ? `Last sync — ${new Date(lastSyncedAt).toLocaleDateString()}`
                : "Never synced"}
            </s-paragraph>
          </s-box>
        </s-stack>
      </s-section>

      <s-section heading="Manual Sync">
        <s-stack direction="block" gap="base">
          <s-paragraph>
            Status sync runs automatically every 5 minutes. You can also trigger
            a manual sync to get the latest delivery statuses from QPExpress now.
          </s-paragraph>
          <s-button
            variant="primary"
            loading={isSyncing}
            disabled={!isConfigured}
            onClick={() => fetcher.submit({}, { method: "post" })}
          >
            {isSyncing ? "Syncing…" : "Sync Now"}
          </s-button>
        </s-stack>
      </s-section>

      <s-section heading="Quick Links" slot="aside">
        <s-stack direction="block" gap="base">
          <s-link href="/app/orders">View All Orders</s-link>
          <s-link href="/app/settings">QPExpress Settings</s-link>
        </s-stack>
      </s-section>

      <s-section heading="How It Works" slot="aside">
        <s-unordered-list>
          <s-list-item>New Shopify orders are automatically sent to QPExpress</s-list-item>
          <s-list-item>Delivery status syncs from QPExpress every 5 minutes</s-list-item>
          <s-list-item>Shopify fulfillment events are updated automatically</s-list-item>
          <s-list-item>Failed orders can be retried from the Orders page</s-list-item>
        </s-unordered-list>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
