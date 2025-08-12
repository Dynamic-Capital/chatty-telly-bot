import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { optionalEnv } from "../_shared/env.ts";
import { expectedSecret } from "../_shared/telegram_secret.ts";
import { ok, oops, mna } from "../_shared/http.ts";

const BOT = optionalEnv("TELEGRAM_BOT_TOKEN") || "";
const BASE = (optionalEnv("SUPABASE_URL") || "").replace(/\/$/, "");
const FN = "telegram-webhook";
const expected = BASE ? `${BASE}/functions/v1/${FN}` : null;

function red(s: string, keep = 4) {
  return s ? s.slice(0, keep) + "...redacted" : "";
}

serve(async (req) => {
  const url = new URL(req.url);
  if (req.method === "GET" && url.pathname.endsWith("/version")) {
    return ok({ name: "telegram-getwebhook", ts: new Date().toISOString() });
  }
  if (req.method === "HEAD") return new Response(null, { status: 200 });
  if (req.method !== "GET") return mna();

  const SECRET = await expectedSecret();
  if (!BOT) {
    return oops("BOT_TOKEN missing");
  }
  const info = await fetch(`https://api.telegram.org/bot${BOT}/getWebhookInfo`)
    .then((r) => r.json()).catch((e) => ({ ok: false, error: String(e) }));
  return ok({
    expected_url: expected,
    has_secret: !!SECRET,
    token_preview: red(BOT),
    webhook_info: info,
  });
});
