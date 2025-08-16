import { optionalEnv } from "../_shared/env.ts";
import { mna, nf, ok, oops, unauth } from "../_shared/http.ts";
import { expectedSecret } from "../_shared/telegram_secret.ts";

interface TgResp {
  ok: boolean;
  result?: Record<string, unknown>;
}

async function tg(
  token: string,
  method: string,
  body?: unknown,
): Promise<TgResp> {
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    return await r.json();
  } catch {
    return { ok: false };
  }
}

export async function handler(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const path = url.pathname;

    if (req.method === "GET" && path === "/version") {
      return ok({
        name: "telegram-webhook-keeper",
        ts: new Date().toISOString(),
      });
    }

    const admin = optionalEnv("ADMIN_API_SECRET");
    if (path !== "/version" && admin) {
      const header = req.headers.get("x-admin-secret");
      if (!header || header !== admin) return unauth();
    }

    if (req.method === "POST" && path === "/run") {
      const token = optionalEnv("TELEGRAM_BOT_TOKEN");
      const secret = await expectedSecret();
      if (!token || !secret) return oops("missing bot token or webhook secret");

      const functionsBase = `${url.protocol}//${url.host}`;
      const expectedWebhook = `${functionsBase}/telegram-bot`;

      const info = await tg(token, "getWebhookInfo");
      const currentUrl = info?.result?.url as string | undefined;
      const currentSecret = info?.result?.secret_token as string | undefined;
      let webhookOk = currentUrl === expectedWebhook &&
        currentSecret === secret;
      let webhookFixed = false;
      if (!webhookOk) {
        const set = await tg(token, "setWebhook", {
          url: expectedWebhook,
          secret_token: secret,
          allowed_updates: ["message", "callback_query"],
        });
        webhookFixed = !!set?.ok;
        webhookOk = webhookFixed;
      }

      const miniRaw = optionalEnv("MINI_APP_URL");
      const miniExpected = miniRaw
        ? (miniRaw.endsWith("/") ? miniRaw : `${miniRaw}/`)
        : null;

      let menuOk = true;
      let menuFixed = false;
      if (miniExpected) {
        const menu = await tg(token, "getChatMenuButton");
        const menuActual = menu?.result?.menu_button?.web_app?.url as
          | string
          | undefined;
        menuOk = menuActual === miniExpected;
        if (!menuOk) {
          const set = await tg(token, "setChatMenuButton", {
            menu_button: {
              type: "web_app",
              text: "Join",
              web_app: { url: miniExpected },
            },
          });
          menuFixed = !!set?.ok;
          menuOk = menuFixed;
        }
      }

      const okAll = webhookOk && menuOk;
      return ok({
        ok: okAll,
        webhook: { fixed: webhookFixed },
        menu: { fixed: menuFixed },
      });
    }

    if (req.method === "GET") return nf();
    return mna();
  } catch (e) {
    return oops(
      "telegram-webhook-keeper error",
      e instanceof Error ? e.message : String(e),
    );
  }
}

if (import.meta.main) {
  Deno.serve(handler);
}
