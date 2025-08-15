import { createClient } from "../../_shared/client.ts";
import { requireEnv } from "../../_shared/env.ts";

const { TELEGRAM_BOT_TOKEN: BOT_TOKEN } = requireEnv([
  "TELEGRAM_BOT_TOKEN",
] as const);

export const supabaseAdmin = createClient();

export async function sendMessage(
  chatId: number,
  text: string,
  replyMarkup?: Record<string, unknown>,
) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  const payload = {
    chat_id: chatId,
    text: text,
    reply_markup: replyMarkup,
    parse_mode: "Markdown",
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("❌ Telegram API error:", errorData);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("❌ Error sending message:", error);
    return null;
  }
}
