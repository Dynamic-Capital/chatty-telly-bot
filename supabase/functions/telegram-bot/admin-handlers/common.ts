import { createClient } from "../../_shared/client.ts";
import { requireEnv } from "../../_shared/env.ts";

const { TELEGRAM_BOT_TOKEN: BOT_TOKEN } = requireEnv([
  "TELEGRAM_BOT_TOKEN",
] as const);

export const supabaseAdmin = createClient();

let currentMessageId: number | null = null;

export function setCallbackMessageId(id: number | null) {
  currentMessageId = id;
}

async function callTelegram(
  method: string,
  payload: Record<string, unknown>,
) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/${method}`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const errorData = await response.text();
      console.error(`❌ Telegram API error [${method}]:`, errorData);
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error(`❌ Error calling Telegram API [${method}]:`, error);
    return null;
  }
}

export async function sendMessage(
  chatId: number,
  text: string,
  replyMarkup?: Record<string, unknown>,
) {
  const payload: Record<string, unknown> = {
    chat_id: chatId,
    text,
    reply_markup: replyMarkup,
    parse_mode: "Markdown",
  };

  if (currentMessageId != null) {
    payload.message_id = currentMessageId;
    const res = await callTelegram("editMessageText", payload);
    currentMessageId = res?.result?.message_id ?? null;
    return res;
  }

  const res = await callTelegram("sendMessage", payload);
  currentMessageId = res?.result?.message_id ?? null;
  return res;
}

