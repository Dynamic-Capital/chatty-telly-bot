import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { expectedSecret, readDbWebhookSecret } from "../_shared/telegram_secret.ts";
import { requireEnv } from "../_shared/env.ts";
import { json, mna, ok } from "../_shared/http.ts";
function projectRef(): string {
  const url = Deno.env.get("SUPABASE_URL");
  if (url) {
    try {
      return new URL(url).hostname.split(".")[0];
    } catch {}
  }
  return requireEnv("SUPABASE_PROJECT_ID");
}
function genSecretHex(len = 24) {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function upsertDbSecret(supa: any, secret: string) {
  const { error } = await supa
    .from("bot_settings")
    .upsert({ setting_key: "TELEGRAM_WEBHOOK_SECRET", setting_value: secret }, {
      onConflict: "setting_key",
    });
  if (error) throw new Error("upsert bot_settings failed: " + error.message);
}

export async function decideSecret(supa: any): Promise<string> {
  let secret = await expectedSecret();
  if (secret) return secret;
  secret = genSecretHex(24);
  await upsertDbSecret(supa, secret);
  return secret;
}

async function tgCall(token: string, method: string, body?: unknown) {
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, json: j };
}

async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  if (req.method === "GET" && url.pathname.endsWith("/version")) {
    return ok({ name: "telegram-webhook-keeper", ts: new Date().toISOString() });
  }
  if (req.method === "HEAD") return new Response(null, { status: 200 });
  if (req.method !== "GET" && req.method !== "POST") {
    return mna();
  }

  // Supabase + Telegram pre-reqs
  const {
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    TELEGRAM_BOT_TOKEN,
  } = requireEnv([
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "TELEGRAM_BOT_TOKEN",
  ] as const);
  const ref = projectRef();
  const expectedUrl = `https://${ref}.functions.supabase.co/telegram-bot`;

  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const token = TELEGRAM_BOT_TOKEN;

  // 1) Determine secret precedence: DB -> ENV -> generate
  const secret = await decideSecret(supa);

  // 2) Ping bot echo (helps surface downtime)
  let echoOK = false;
  try {
    const ping = await fetch(`${expectedUrl}/echo`, { method: "GET" });
    echoOK = ping.ok;
  } catch {}

  // 3) Ensure webhook points to expected URL
  const before = await tgCall(token, "getWebhookInfo");
  const currentUrl: string | undefined = before.json?.result?.url;
  const needsSet = !currentUrl || currentUrl !== expectedUrl;

  let setResult: any = null;
  if (needsSet) {
    setResult = await tgCall(token, "setWebhook", {
      url: expectedUrl,
      secret_token: secret, // always (re)assert
      allowed_updates: ["message", "callback_query"],
      drop_pending_updates: false,
    });
  }

  // 4) Report
  const after = await tgCall(token, "getWebhookInfo");
  const out = {
    ok: after.json?.ok === true,
    expectedUrl,
    echoOK,
    secretStoredInDb: !!(await readDbWebhookSecret()),
    before: before.json,
    setAttempted: needsSet,
    setResult,
    after: after.json,
  };
  return json(out, out.ok ? 200 : 500);
}

if (import.meta.main) {
  serve(handler);
}
