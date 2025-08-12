import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { expectedSecret, readDbWebhookSecret } from "../_shared/telegram_secret.ts";

function requireEnv(k: string) {
  const v = Deno.env.get(k);
  if (!v) throw new Error(`Missing env: ${k}`);
  return v;
}
function projectRef(): string {
  const url = Deno.env.get("SUPABASE_URL");
  if (url) {
    try {
      return new URL(url).hostname.split(".")[0];
    } catch {
      // ignore invalid URL
    }
  }
  const ref = Deno.env.get("SUPABASE_PROJECT_ID");
  if (!ref) throw new Error("Cannot derive SUPABASE project ref");
  return ref;
}
function genSecretHex(len = 24) {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

interface SupaUpsert {
  from: (table: string) => {
    upsert: (
      values: Record<string, unknown>,
      options: { onConflict: string },
    ) => Promise<{ error?: { message: string } }>;
  };
}

async function upsertDbSecret(supa: SupaUpsert, secret: string) {
  const { error } = await supa
    .from("bot_settings")
    .upsert({ setting_key: "TELEGRAM_WEBHOOK_SECRET", setting_value: secret }, {
      onConflict: "setting_key",
    });
  if (error) throw new Error("upsert bot_settings failed: " + error.message);
}

export async function decideSecret(
  supa: SupaUpsert,
  envSecret?: string | null,
): Promise<string> {
  let secret = envSecret ?? (await expectedSecret(supa));
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
  if (req.method !== "GET" && req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // Supabase + Telegram pre-reqs
  const url = requireEnv("SUPABASE_URL");
  const srv = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const token = requireEnv("TELEGRAM_BOT_TOKEN");
  const ref = projectRef();
  const expectedUrl = `https://${ref}.functions.supabase.co/telegram-bot`;

  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  const supa = createClient(url, srv, { auth: { persistSession: false } });

  // 1) Determine secret precedence: DB -> ENV -> generate
    const secret = await decideSecret(supa);

  // 2) Ping bot echo (helps surface downtime)
  let echoOK = false;
  try {
    const ping = await fetch(`${expectedUrl}/echo`, { method: "GET" });
    echoOK = ping.ok;
  } catch {
    // ignore network errors
  }

  // 3) Ensure webhook points to expected URL
  const before = await tgCall(token, "getWebhookInfo");
  const currentUrl: string | undefined = before.json?.result?.url;
  const needsSet = !currentUrl || currentUrl !== expectedUrl;

  let setResult: Record<string, unknown> | null = null;
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
    secretStoredInDb: !!(await readDbWebhookSecret(supa)),
    before: before.json,
    setAttempted: needsSet,
    setResult,
    after: after.json,
  };
  return new Response(JSON.stringify(out, null, 2), {
    headers: { "content-type": "application/json" },
    status: out.ok ? 200 : 500,
  });
}

if (import.meta.main) {
  serve(handler);
}
