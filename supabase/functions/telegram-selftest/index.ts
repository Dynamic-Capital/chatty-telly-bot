import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { optionalEnv } from "../_shared/env.ts";
import { expectedSecret } from "../_shared/telegram_secret.ts";
import { ok, bad, oops, mna } from "../_shared/http.ts";

const BOT = optionalEnv("TELEGRAM_BOT_TOKEN") || "";
const BASE = (optionalEnv("SUPABASE_URL") || "").replace(/\/$/, "");
const WEBHOOK = `${BASE}/functions/v1/telegram-webhook`;

function tg(method: string, payload: unknown) {
  return fetch(`https://api.telegram.org/bot${BOT}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(8000),
  });
}

serve(async (req) => {
  const url = new URL(req.url);
  if (req.method === "GET" && url.pathname.endsWith("/version")) {
    return ok({ name: "telegram-selftest", ts: new Date().toISOString() });
  }
  if (req.method === "HEAD") return new Response(null, { status: 200 });

  try {
    if (!BOT) {
      return oops("BOT_TOKEN missing");
    }

    if (req.method === "GET") {
      const chatId = Number(url.searchParams.get("chat_id") || 0);
      if (!chatId) {
        return bad("chat_id required");
      }
      const res = await tg("sendMessage", {
        chat_id: chatId,
        text: "Self-test ✅ Bot can send messages.",
      });
      const txt = await res.text().catch(() => "");
      return ok({ telegram_ok: res.ok, status: res.status, body: txt.slice(0, 300) });
    }

    if (req.method !== "POST") return mna();

    // POST path: simulate Telegram → Webhook with a /start update
    const { chat_id } = await req.json().catch(() => ({}));
    if (!chat_id) {
      return bad("chat_id required in JSON");
    }
    const fakeUpdate = {
      update_id: Date.now(),
      message: {
        message_id: 1,
        date: Math.floor(Date.now() / 1000),
        chat: { id: chat_id, type: "private" },
        text: "/start",
      },
    };
    const SECRET = await expectedSecret();
    const resp = await fetch(WEBHOOK, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(SECRET ? { "x-telegram-bot-api-secret-token": SECRET } : {}),
      },
      body: JSON.stringify(fakeUpdate),
      signal: AbortSignal.timeout(8000),
    });
    const body = await resp.text().catch(() => "");
    return ok({
      webhook: WEBHOOK,
      status: resp.status,
      telegram_ok: resp.ok,
      body: body.slice(0, 300),
    });
  } catch (e) {
    return oops("Self-test failed", String(e));
  }
});
