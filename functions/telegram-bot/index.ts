function getEnv(key: string): string {
  if (typeof Deno !== "undefined" && typeof Deno.env?.get === "function") {
    return Deno.env.get(key) ?? "";
  }
  const nodeProcess = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  return nodeProcess?.env?.[key] ?? "";
}

async function sendMessage(chatId: number, text: string) {
  const token = getEnv("TELEGRAM_BOT_TOKEN");
  if (!token) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch (_e) {
    // ignore network errors in tests
  }
}

export async function serveWebhook(req: Request): Promise<Response> {
  const headers = { "content-type": "application/json" };
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: true }), { headers });
  }

  const secret = getEnv("TELEGRAM_WEBHOOK_SECRET");
  if (secret) {
    const url = new URL(req.url);
    const headerSecret = req.headers.get("x-telegram-bot-api-secret-token");
    const querySecret = url.searchParams.get("secret");
    if (headerSecret !== secret && querySecret !== secret) {
      return new Response(JSON.stringify({ ok: true }), { headers });
    }
  }

  let update: any;
  try {
    update = await req.json();
  } catch {
    return new Response(JSON.stringify({ ok: true }), { headers });
  }
  const text = update?.message?.text ?? "";
  const chatId = update?.message?.chat?.id;
  if (text.startsWith("/start") && typeof chatId === "number") {
    await sendMessage(chatId, "Bot activated. Replying to /start");
  }
  return new Response(JSON.stringify({ ok: true }), { headers });
}

export default serveWebhook;
