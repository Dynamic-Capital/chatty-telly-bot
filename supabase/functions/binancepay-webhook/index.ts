import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "../_shared/client.ts";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  if (Deno.env.get("BINANCE_ENABLED") !== "true") {
    return new Response("Disabled", { status: 403 });
  }

  // NOTE: Implement Binance signature verification here before trusting payload.
  // Placeholder only — do NOT auto-approve without real verification!

  const body = await req.json().catch(() => ({}));
  // Example: locate payment by payment_provider_id from your checkout-init step
  const providerId = body?.merchantTradeNo || body?.prepayId || null;

  const supa = createClient();

  if (providerId) {
    const { data: rows } = await supa.from("payments").select("id").eq(
      "payment_provider_id",
      providerId,
    ).limit(1);
    if (rows && rows[0]) {
      await supa.from("payments").update({
        status: "completed",
        webhook_data: { ...(body || {}), source: "binance_webhook" },
      }).eq("id", rows[0].id);
      await supa.from("admin_logs").insert({
        admin_telegram_id: "system",
        action_type: "provider_webhook",
        action_description: `Binance webhook completed payment ${rows[0].id}`,
        affected_table: "payments",
        affected_record_id: rows[0].id,
      });
    }
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "content-type": "application/json" },
  });
});
