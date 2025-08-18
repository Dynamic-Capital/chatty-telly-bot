import { ok, mna, oops, bad } from "../_shared/http.ts";
import { validateTelegramHeader } from "../_shared/telegram_secret.ts";
import { createLogger } from "../_shared/logger.ts";
import { envOrSetting, getContent } from "../_shared/config.ts";
import { readMiniAppEnv } from "../_shared/miniapp.ts";

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
const BOT_TOKEN = await envOrSetting("TELEGRAM_BOT_TOKEN");

async function sendMessage(
  chatId: number,
  text: string,
  extra?: Record<string, unknown>,
) {
  if (!BOT_TOKEN) {
    baseLogger.warn(
      "TELEGRAM_BOT_TOKEN is not set; cannot send message",
    );
    return;
  }
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, ...extra }),
    });
  } catch (err) {
    baseLogger.error("sendMessage error", err);
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

    // Basic command dispatcher for simple health/admin commands
    type CommandHandler = (chatId: number) => Promise<void>;

    const handlers: Record<string, CommandHandler> = {
      "/start": async (chatId) => {
        const { url, short } = await readMiniAppEnv();
        const botUsername = (await envOrSetting("TELEGRAM_BOT_USERNAME")) || "";
        const btnText = await getContent("miniapp_button_text") ?? "Open VIP Mini App";
        const prompt = await getContent("miniapp_open_prompt") ?? "Join the VIP Mini App:";

        if (url) {
          await sendMessage(chatId, prompt, {
            reply_markup: {
              inline_keyboard: [[{ text: btnText, web_app: { url } }]],
            },
          });
          return;
        }

        if (short && botUsername) {
          await sendMessage(chatId, prompt, {
            reply_markup: {
              inline_keyboard: [[{
                text: btnText,
                url: `https://t.me/${botUsername}/${short}`,
              }]],
            },
          });
          return;
        }

        const msg = await getContent("bot_activated_configuring") ??
          "Bot activated. Mini app is being configured. Please try again soon.";
        await sendMessage(chatId, msg);
      },
      "/ping": async (chatId) => {
        await sendMessage(chatId, JSON.stringify({ pong: true }));
      },
    };

    const command = text?.split(/\s+/)[0];
    if (typeof chatId === "number" && command && handlers[command]) {
      try {
        await handlers[command](chatId);
      } catch (err) {
        logger.error(`error handling ${command}`, err);
      }
    }

    return ok({ ok: true });
  } catch (err) {
    logger.error("telegram-webhook handler error", err);
    return oops("Internal Error", String(err));
  }
}

// Start the HTTP server when run as a standalone script in Deno.
export default handler;
if (import.meta.main && typeof Deno !== "undefined") {
  // Use a dynamic import so the module can also be loaded in Node tests
  // where the Deno standard library is unavailable.
  const { serve } = await import(
    "https://deno.land/std@0.224.0/http/server.ts"
  );
  serve(handler);
}
