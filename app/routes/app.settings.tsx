import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { testConnection } from "../lib/qpexpress.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const config = await prisma.qPExpressConfig.findUnique({
    where: { shop: session.shop },
    select: { username: true, companyName: true },
  });
  return {
    username: config?.username ?? "",
    companyName: config?.companyName ?? null,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  const username = formData.get("username") as string;
  const password = formData.get("password") as string;

  if (!username || !password) {
    return { success: false, error: "Username and password are required" };
  }

  const result = await testConnection(username, password);
  if (!result.ok) {
    return { success: false, error: result.error ?? "Connection failed" };
  }

  if (intent === "save") {
    await prisma.qPExpressConfig.upsert({
      where: { shop: session.shop },
      create: {
        shop: session.shop,
        username,
        password,
        token: null,
        companyName: result.companyName ?? null,
      },
      update: {
        username,
        password,
        token: null,
        companyName: result.companyName ?? null,
      },
    });
    return { success: true, companyName: result.companyName, saved: true };
  }

  return { success: true, companyName: result.companyName, saved: false };
};

export default function Settings() {
  const { username: savedUsername, companyName: savedCompanyName } =
    useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const isSubmitting = fetcher.state === "submitting";
  const result = fetcher.data;

  const [username, setUsername] = useState(savedUsername);
  const [password, setPassword] = useState("");

  const displayCompanyName = result?.companyName ?? savedCompanyName;

  function submitCredentials(intent: "test" | "save") {
    const fd = new FormData();
    fd.set("intent", intent);
    fd.set("username", username);
    fd.set("password", password);
    fetcher.submit(fd, { method: "post" });
  }

  return (
    <s-page heading="QPExpress Settings">
      <s-section heading="API Credentials">
        <s-paragraph>
          Enter your QPExpress portal credentials.
        </s-paragraph>

        <s-stack direction="block" gap="base">
          {result?.success && result.saved && (
            <s-banner tone="success"><p>Credentials saved successfully.</p></s-banner>
          )}
          {result?.success && !result.saved && (
            <s-banner tone="success"><p>Connection successful. Click Save to store.</p></s-banner>
          )}
          {result && "error" in result && result.error && (
            <s-banner tone="critical"><p>{result.error}</p></s-banner>
          )}

          {displayCompanyName && (
            <s-box padding="base" borderWidth="base" borderRadius="base" background="subdued">
              <s-stack direction="inline" gap="tight">
                <s-badge tone="success">Connected</s-badge>
                <s-text variant="headingSm">{displayCompanyName}</s-text>
              </s-stack>
            </s-box>
          )}

          <s-text-field
            label="QPExpress Username"
            value={username}
            onInput={(e: Event) => setUsername((e.target as HTMLInputElement).value)}
            autoComplete="off"
          />
          <s-text-field
            label="QPExpress Password"
            type="password"
            value={password}
            onInput={(e: Event) => setPassword((e.target as HTMLInputElement).value)}
          />

          <s-stack direction="inline" gap="base">
            <s-button variant="secondary" loading={isSubmitting} onClick={() => submitCredentials("test")}>
              Test Connection
            </s-button>
            <s-button variant="primary" loading={isSubmitting} onClick={() => submitCredentials("save")}>
              Save Credentials
            </s-button>
          </s-stack>
        </s-stack>
      </s-section>
    </s-page>
  );
}
