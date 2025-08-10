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
  } catch (err) {
    console.error("sendMessage error", err);
  }
}

export async function handler(req: Request): Promise<Response> {
  const headers = { "Content-Type": "application/json" };

  // Only accept POST requests
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: true }), { headers });
  }

  // Validate optional secret
  if (WEBHOOK_SECRET) {
    const url = new URL(req.url);
    const headerSecret = req.headers.get("x-telegram-bot-api-secret-token");
    const querySecret = url.searchParams.get("secret");
    if (headerSecret !== WEBHOOK_SECRET && querySecret !== WEBHOOK_SECRET) {
      return new Response(JSON.stringify({ ok: true }), { headers });
    }
  }

  // Parse the incoming update
  let update: any = null;
  try {
    update = await req.json();
  } catch (err) {
    console.error("failed to parse update", err);
    return new Response(JSON.stringify({ ok: true }), { headers });
  }

  const text: string | undefined = update?.message?.text;
  const chatId: number | undefined = update?.message?.chat?.id;

  // Reply to /start messages
  if (text === "/start" && typeof chatId === "number") {
    try {
      await sendMessage(chatId, "Bot activated. Replying to /start");
    } catch (err) {
      console.error("error handling /start", err);
    }
  }

  return new Response(JSON.stringify({ ok: true }), { headers });
}

// Start the HTTP server when run as a standalone script
if (import.meta.main) {
  serve(handler);
}

