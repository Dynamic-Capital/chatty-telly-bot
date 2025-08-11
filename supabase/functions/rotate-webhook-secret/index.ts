import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function genHex(n = 24) {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
}
async function tg(token: string, method: string, body?: unknown) {
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return await r.json().catch(() => ({}));
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  // Admin header secret from Phase 4 (reuse)
  const hdr = req.headers.get("X-Admin-Secret") || "";
  if (hdr !== (Deno.env.get("ADMIN_API_SECRET") || "")) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = Deno.env.get("SUPABASE_URL")!,
    svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supa = createClient(url, svc, { auth: { persistSession: false } });
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
  const ref = (new URL(url)).hostname.split(".")[0];
  const expectedUrl = `https://${ref}.functions.supabase.co/telegram-bot`;

  const secret = genHex(24);
  await supa.from("bot_settings").upsert({
    setting_key: "TELEGRAM_WEBHOOK_SECRET",
    setting_value: secret,
  }, { onConflict: "setting_key" });

  const set = await tg(token, "setWebhook", {
    url: expectedUrl,
    secret_token: secret,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: false,
  });
  const info = await tg(token, "getWebhookInfo");

  return new Response(
    JSON.stringify({
      ok: info?.ok === true,
      new_secret: secret,
      webhook: info,
    }),
    { headers: { "content-type": "application/json" } },
  );
});
