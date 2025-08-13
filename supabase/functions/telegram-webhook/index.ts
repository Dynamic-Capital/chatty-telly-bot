import { optionalEnv } from "../_shared/env.ts";
import { ok, mna, oops, bad } from "../_shared/http.ts";
import { validateTelegramHeader } from "../_shared/telegram_secret.ts";
import { createLogger } from "../_shared/logger.ts";

interface TelegramMessage {
  text?: string;
  chat?: { id?: number };
}

interface TelegramUpdate {
  message?: TelegramMessage;
}

const baseLogger = createLogger({ function: "telegram-webhook" });

function getLogger(req: Request) {
  return createLogger({
    function: "telegram-webhook",
    requestId:
      req.headers.get("sb-request-id") ||
      req.headers.get("x-request-id") ||
      crypto.randomUUID(),
  });
}

/**
 * Minimal wrapper around Telegram's sendMessage API.
 * Allows passing through optional payload fields like reply_markup.
 */
async function sendMessage(
  chatId: number,
  text: string,
  extra?: Record<string, unknown>,
) {
  const token = optionalEnv("TELEGRAM_BOT_TOKEN");
  if (!token) {
    baseLogger.warn(
      "TELEGRAM_BOT_TOKEN is not set; cannot send message",
    );
    return;
  }
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, ...extra }),
    });
  } catch (err) {
    baseLogger.error("sendMessage error", err);
  }
}

function isValidHttpsUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:";
  } catch {
    return false;
  }
}

export async function handler(req: Request): Promise<Response> {
  const logger = getLogger(req);
  try {
    const url = new URL(req.url);

    // Health/version probe
    if (req.method === "GET" && url.pathname.endsWith("/version")) {
      return ok({ name: "telegram-webhook", ts: new Date().toISOString() });
    }

    // Only accept POST for webhook deliveries
    if (req.method !== "POST") {
      return mna();
    }

    // Validate Telegram secret header (DB-first with env fallback)
    const authResp = await validateTelegramHeader(req);
    if (authResp) return authResp;

    // Parse the incoming update
    let update: TelegramUpdate | null = null;
    try {
      update = await req.json() as TelegramUpdate;
    } catch (err) {
      logger.error("failed to parse update", err);
      return bad("Invalid JSON");
    }

    const text = update?.message?.text?.trim();
    const chatId = update?.message?.chat?.id;

    // Reply to /start messages (with optional parameters)
    const command = text?.split(/\s+/)[0];
    if (command === "/start" && typeof chatId === "number") {
      try {
        const miniUrl = optionalEnv("MINI_APP_URL");
        const short = optionalEnv("MINI_APP_SHORT_NAME");
        const botUsername = optionalEnv("TELEGRAM_BOT_USERNAME") || "";
        let openUrl: string | null = null;
        if (miniUrl) {
          openUrl = miniUrl.endsWith("/") ? miniUrl : miniUrl + "/";
        } else if (short && botUsername) {
          openUrl = `https://t.me/${botUsername}/${short}`;
        }
        if (!openUrl || !isValidHttpsUrl(openUrl)) {
          await sendMessage(
            chatId,
            "Bot activated. Mini app is being configured. Please try again soon.",
          );
        } else {
          await sendMessage(chatId, "Open the VIP Mini App:", {
            reply_markup: {
              inline_keyboard: [[{
                text: "Open VIP Mini App",
                web_app: { url: openUrl },
              }]],
            },
          });
        }
      } catch (err) {
        logger.error("error handling /start", err);
      }
    }

    return ok({ ok: true });
  } catch (err) {
    logger.error("telegram-webhook handler error", err);
    return oops("Internal Error", String(err));
  }
}

// Start the HTTP server when run as a standalone script in Deno.
if (import.meta.main && typeof Deno !== "undefined") {
  // Use a dynamic import so the module can also be loaded in Node tests
  // where the Deno standard library is unavailable.
  const { serve } = await import(
    "https://deno.land/std@0.224.0/http/server.ts"
  );
  serve(handler);
}
