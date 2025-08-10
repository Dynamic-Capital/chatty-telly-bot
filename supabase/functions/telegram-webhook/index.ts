import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
const WEBHOOK_SECRET = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") || "";

async function sendMessage(chatId: number, text: string) {
  if (!BOT_TOKEN) return;
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch (_) {
    // ignore network errors
  }
}

serve(async (req) => {
  const headers = { "Content-Type": "application/json" };

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: true }), { headers });
  }

  if (WEBHOOK_SECRET) {
    const url = new URL(req.url);
    const headerSecret = req.headers.get("x-telegram-bot-api-secret-token");
    const querySecret = url.searchParams.get("secret");
    if (headerSecret !== WEBHOOK_SECRET && querySecret !== WEBHOOK_SECRET) {
      return new Response(JSON.stringify({ ok: true }), { headers });
    }
  }

  let update: any = null;
  try {
    update = await req.json();
  } catch (_) {
    // ignore parse errors
  }

  const text: string | undefined = update?.message?.text;
  const chatId: number | undefined = update?.message?.chat?.id;

  if (text === "/start" && typeof chatId === "number") {
    await sendMessage(chatId, "Bot activated. Replying to /start");
  }

  return new Response(JSON.stringify({ ok: true }), { headers });
});

