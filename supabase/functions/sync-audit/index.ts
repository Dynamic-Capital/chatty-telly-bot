// supabase/functions/sync-audit/index.ts
// Audits bot/miniapp linkage and optionally fixes drift.

import { optionalEnv } from "../_shared/env.ts";
import { ok, unauth, nf, mna, oops } from "../_shared/http.ts";
import { expectedSecret } from "../_shared/telegram_secret.ts";

interface TelegramResponse {
  ok: boolean;
  result?: Record<string, unknown>;
}

async function tg(token: string, method: string, body?: unknown): Promise<
  TelegramResponse
> {
  try {
    const r = await fetch(
      `https://api.telegram.org/bot${token}/${method}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      },
    );
    return await r.json();
  } catch {
    return { ok: false };
  }
}

export async function handler(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const path = url.pathname;

    // Public version endpoint
    if (req.method === "GET" && path === "/version") {
      return ok({ name: "sync-audit", ts: new Date().toISOString() });
    }

    // Auth guard
    const admin = optionalEnv("ADMIN_API_SECRET");
    if (path !== "/version") {
      if (!admin) return unauth();
      const header = req.headers.get("x-admin-secret");
      if (!header || header !== admin) return unauth();
    }

    // Only accept POST /
    if (req.method === "POST" && path === "/") {
      const body = await req.json().catch(() => ({}));
      const fix = Boolean(body?.fix);

      // --- Step 1: collect env secrets ---
      const supabaseUrl = optionalEnv("SUPABASE_URL");
      const serviceKey = optionalEnv("SUPABASE_SERVICE_ROLE_KEY");
      const botToken = optionalEnv("TELEGRAM_BOT_TOKEN");
      const miniUrlRaw = optionalEnv("MINI_APP_URL");
      const miniShort = optionalEnv("MINI_APP_SHORT_NAME");
      const webhookSecret = await expectedSecret();

      const secrets = {
        SUPABASE_URL: !!supabaseUrl,
        SUPABASE_SERVICE_ROLE_KEY: !!serviceKey,
        TELEGRAM_BOT_TOKEN: !!botToken,
        TELEGRAM_WEBHOOK_SECRET: !!webhookSecret,
        MINI_APP_URL: !!miniUrlRaw,
        MINI_APP_SHORT_NAME: !!miniShort,
      };
      const missing = Object.entries(secrets)
        .filter(([, v]) => !v)
        .map(([k]) => k);

      // --- Step 2: derive expected endpoints ---
      const functionsBase = `${url.protocol}//${url.host}`;
      const expectedWebhook = `${functionsBase}/telegram-bot`;

      // --- Step 3: ping related endpoints ---
      const [botVer, miniVer, miniHead] = await Promise.all([
        fetch(`${functionsBase}/telegram-bot/version`).catch(() => null),
        fetch(`${functionsBase}/miniapp/version`).catch(() => null),
        fetch(`${functionsBase}/miniapp`, { method: "HEAD" }).catch(() => null),
      ]);

      const endpoints = {
        telegramBotVersion: botVer?.ok ?? false,
        miniappVersion: miniVer?.ok ?? false,
        miniappHead: miniHead?.ok ?? false,
      };

      // --- Step 4: inspect Telegram webhook ---
      let webhookActual: string | null = null;
      let webhookFixed = false;
      let webhookSecretOk = true;
      if (botToken) {
        const info = await tg(botToken, "getWebhookInfo");
        webhookActual = info?.result?.url as string | null ?? null;
        const currentSecret = info?.result?.secret_token as string | null ?? null;
        webhookSecretOk = !webhookSecret || currentSecret === webhookSecret;
        const mismatch =
          webhookActual !== expectedWebhook || !webhookSecretOk;
        if (mismatch && fix && webhookSecret) {
          const set = await tg(botToken, "setWebhook", {
            url: expectedWebhook,
            secret_token: webhookSecret,
            allowed_updates: ["message", "callback_query"],
          });
          webhookFixed = !!set?.ok;
          if (webhookFixed) {
            webhookActual = expectedWebhook;
            webhookSecretOk = true;
          }
        }
      }

      // --- Step 5: determine mini-app URL and menu button ---
      let miniExpected: string | null = null;
      if (miniUrlRaw) {
        miniExpected = miniUrlRaw.endsWith("/") ? miniUrlRaw : `${miniUrlRaw}/`;
      } else if (miniShort && botToken) {
        const me = await tg(botToken, "getMe");
        const username = me?.result?.username as string | undefined;
        if (username) {
          miniExpected = `https://t.me/${username}/${miniShort}`;
        }
      }

      let menuActual: string | null = null;
      let menuFixed = false;
      if (botToken) {
        const menu = await tg(botToken, "getChatMenuButton");
        menuActual =
          menu?.result?.menu_button?.web_app?.url as string | null ?? null;
        const menuMismatch = miniExpected && menuActual !== miniExpected;
        if (menuMismatch && fix && miniExpected) {
          const set = await tg(botToken, "setChatMenuButton", {
            menu_button: {
              type: "web_app",
              text: "Join",
              web_app: { url: miniExpected },
            },
          });
          menuFixed = !!set?.ok;
          if (menuFixed) menuActual = miniExpected;
        }
      }

      // --- Summaries ---
      const notes: string[] = [...missing];
      if (!endpoints.telegramBotVersion) notes.push("telegram-bot/version");
      if (!endpoints.miniappVersion) notes.push("miniapp/version");
      if (!endpoints.miniappHead) notes.push("miniapp_head");
      if (webhookActual !== expectedWebhook) notes.push("webhook_url");
      if (!webhookSecretOk) notes.push("webhook_secret");
      if (miniExpected && menuActual !== miniExpected) notes.push("menu_url");

      const okAll = notes.length === 0;

      return ok({
        ok: okAll,
        secrets,
        endpoints,
        telegram: {
          webhook: { expected: expectedWebhook, actual: webhookActual, fixed: webhookFixed },
          menu: { expected: miniExpected, actual: menuActual, fixed: menuFixed },
        },
        notes,
        version: { name: "sync-audit", ts: new Date().toISOString() },
      });
    }

    // unmatched routes
    if (req.method === "GET") return nf();
    return mna();
  } catch (e) {
    return oops("sync-audit error", e instanceof Error ? e.message : String(e));
  }
}

Deno.serve(handler);

