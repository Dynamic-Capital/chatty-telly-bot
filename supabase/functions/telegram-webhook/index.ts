function getEnv(key: string): string {
  if (typeof Deno !== "undefined" && typeof Deno.env?.get === "function") {
    return Deno.env.get(key) ?? "";
  }
  if (typeof process !== "undefined") {
    return (process.env as Record<string, string | undefined>)[key] ?? "";
  }
  return "";
}

const BOT_TOKEN = getEnv("TELEGRAM_BOT_TOKEN");
const WEBHOOK_SECRET = getEnv("TELEGRAM_WEBHOOK_SECRET");

interface TelegramMessage {
  text?: string;
  chat?: { id?: number };
}

interface TelegramUpdate {
  message?: TelegramMessage;
}

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
  let update: TelegramUpdate | null = null;
  try {
    update = await req.json() as TelegramUpdate;
  } catch (err) {
    console.error("failed to parse update", err);
    return new Response(JSON.stringify({ ok: true }), { headers });
  }

  const text = update?.message?.text;
  const chatId = update?.message?.chat?.id;

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

// Start the HTTP server when run as a standalone script in Deno.
if (import.meta.main && typeof Deno !== "undefined") {
  // Use a dynamic import so the module can also be loaded in Node tests
  // where the Deno standard library is unavailable.
  const { serve } = await import(
    "https://deno.land/std@0.224.0/http/server.ts"
  );
  serve(handler);
}
