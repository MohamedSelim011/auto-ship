import type { LoaderFunctionArgs } from "react-router";
import { syncAllShops } from "../lib/sync.server";

export async function loader({ request }: LoaderFunctionArgs) {
  // Verify this is called by Vercel Cron (or our own secret)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    await syncAllShops();
    return new Response(JSON.stringify({ ok: true, time: new Date().toISOString() }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[Cron] Sync failed:", error);
    return new Response(JSON.stringify({ ok: false, error: String(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
