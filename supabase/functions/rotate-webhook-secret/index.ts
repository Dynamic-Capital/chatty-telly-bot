import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ok, mna, unauth, oops } from "../_shared/http.ts";
import { requireEnv } from "../_shared/env.ts";

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
  try {
    const urlObj = new URL(req.url);
    if (req.method === "GET" && urlObj.pathname.endsWith("/version")) {
      return ok({ name: "rotate-webhook-secret", ts: new Date().toISOString() });
    }
    if (req.method === "HEAD") return new Response(null, { status: 200 });
    if (req.method !== "POST") {
      return mna();
    }

    // Admin header secret from Phase 4 (reuse)
    const hdr = req.headers.get("X-Admin-Secret") || "";
    if (hdr !== (Deno.env.get("ADMIN_API_SECRET") || "")) {
      return unauth();
    }

    const { SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: svc, TELEGRAM_BOT_TOKEN: token } =
      requireEnv(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "TELEGRAM_BOT_TOKEN"] as const);
    const supa = createClient(url, svc, { auth: { persistSession: false } });
    const ref = (new URL(url)).hostname.split(".")[0];
    const expectedUrl = `https://${ref}.functions.supabase.co/telegram-bot`;

    const secret = genHex(24);
    await supa.from("bot_settings").upsert({
      setting_key: "TELEGRAM_WEBHOOK_SECRET",
      setting_value: secret,
    }, { onConflict: "setting_key" });

    await tg(token, "setWebhook", {
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
  } catch (e) {
    return oops("Internal Error", String(e));
  }
});
