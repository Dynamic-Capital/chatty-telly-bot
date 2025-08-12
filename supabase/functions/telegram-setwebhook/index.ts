import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { optionalEnv } from "../_shared/env.ts";
import { expectedSecret } from "../_shared/telegram_secret.ts";
import { ok, oops, mna } from "../_shared/http.ts";

const BOT = optionalEnv("TELEGRAM_BOT_TOKEN") || "";
const BASE = (optionalEnv("SUPABASE_URL") || "").replace(/\/$/, "");
const FN = "telegram-webhook";
const url = BASE ? `${BASE}/functions/v1/${FN}` : "";

serve(async (req) => {
  const u = new URL(req.url);
  if (req.method === "GET" && u.pathname.endsWith("/version")) {
    return ok({ name: "telegram-setwebhook", ts: new Date().toISOString() });
  }
  if (req.method === "HEAD") return new Response(null, { status: 200 });
  if (req.method !== "GET") return mna();

  const SECRET = await expectedSecret();
  if (!BOT || !url) {
    return oops("Missing BOT or BASE URL");
  }
  const drop = u.searchParams.get("drop") === "1"; // optional: delete webhook first
  const dry = u.searchParams.get("dry") === "1"; // optional: dry-run

  if (dry) {
    return ok({ dry: true, target: url, uses_secret: !!SECRET });
  }

  if (drop) {
    await fetch(`https://api.telegram.org/bot${BOT}/deleteWebhook`, {
      method: "POST",
    }).catch(() => null);
  }
  const form = new URLSearchParams();
  form.set("url", url);
  if (SECRET) form.set("secret_token", SECRET);

  const res = await fetch(`https://api.telegram.org/bot${BOT}/setWebhook`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form,
  });
  const json = await res.json().catch(() => null);
  return ok({
    telegram_ok: res.ok,
    status: res.status,
    result: json,
    target: url,
    used_secret: !!SECRET,
  });
});
