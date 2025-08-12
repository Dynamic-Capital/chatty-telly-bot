// supabase/functions/linkage-audit/index.ts
// Reports whether bot webhook, Mini App URL, and project ref align.
// Also lists which envs are present inside the Edge runtime (source of truth).
import { functionsHost, functionUrl, getProjectRef } from "../_shared/edge.ts";
import { EnvKey, optionalEnv } from "../_shared/env.ts";

type J = Record<string, unknown>;
function has(k: EnvKey) {
  return optionalEnv(k) !== null;
}
function env(k: EnvKey) {
  return optionalEnv(k) ?? "";
}

async function getWebhookInfo(token?: string): Promise<Record<string, unknown>> {
  if (!token) return { ok: false, error: "missing_token" };
  try {
    const r = await fetch(
      `https://api.telegram.org/bot${token}/getWebhookInfo`,
    );
    return await r.json();
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}

function sameHost(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  try {
    return new URL(a).host === new URL(b).host;
  } catch {
    return false;
  }
}

function normalizeSlash(u?: string) {
  if (!u) return u;
  return u.endsWith("/") ? u : u + "/";
}

export default async function handler(_req: Request): Promise<Response> {
  const projectRef = getProjectRef();
  const expectedHost = functionsHost();
  const botToken = env("TELEGRAM_BOT_TOKEN");
  const miniUrl = normalizeSlash(env("MINI_APP_URL"));
  const botWebhookUrlExpected = functionUrl("telegram-bot"); // expected
  const healthUrl = functionUrl("miniapp-health"); // optional if you added it

  // Telegram: where the webhook is actually pointing
  const webhookInfo = await getWebhookInfo(botToken);
  const currentWebhookUrl: string | undefined = webhookInfo?.result?.url;

  const checks = {
    projectRef,
    expectedFunctionsHost: expectedHost,
    expectedWebhookUrl: botWebhookUrlExpected,
    currentWebhookUrl,
    miniAppUrl: miniUrl,
    sameHost_webhook_vs_functions: sameHost(
      currentWebhookUrl,
      botWebhookUrlExpected || "",
    ),
    sameHost_mini_vs_functions: sameHost(miniUrl, botWebhookUrlExpected || ""),
    env: {
      TELEGRAM_BOT_TOKEN: has("TELEGRAM_BOT_TOKEN"),
      TELEGRAM_WEBHOOK_SECRET: has("TELEGRAM_WEBHOOK_SECRET"),
      MINI_APP_URL: has("MINI_APP_URL"),
      SUPABASE_URL: has("SUPABASE_URL"),
      SUPABASE_ANON_KEY: has("SUPABASE_ANON_KEY"),
      SUPABASE_PROJECT_ID: has("SUPABASE_PROJECT_ID"),
    },
    optional: {
      miniapp_health_url: healthUrl,
    },
    notes: [
      "expectedWebhookUrl should equal currentWebhookUrl",
      "miniAppUrl host should match expected functions host (same project)",
      "All runtime secrets should be set in Supabase Edge",
    ],
  } as J;

  return new Response(JSON.stringify({ ok: true, linkage: checks }), {
    headers: { "content-type": "application/json" },
  });
}
