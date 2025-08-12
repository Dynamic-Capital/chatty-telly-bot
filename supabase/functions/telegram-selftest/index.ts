import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { optionalEnv } from "../_shared/env.ts";
import { expectedSecret } from "../_shared/telegram_secret.ts";

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
  // GET /?chat_id=123 : direct sendMessage to confirm token works and chat_id is valid.
  // POST { "chat_id":123 } : server-to-server webhook simulation for /start.
  try {
    if (!BOT) {
      return new Response(
        JSON.stringify({ ok: false, error: "BOT_TOKEN missing" }),
        { status: 500, headers: { "content-type": "application/json" } },
      );
    }

    if (req.method === "GET") {
      const chatId = Number(new URL(req.url).searchParams.get("chat_id") || 0);
      if (!chatId) {
        return new Response(
          JSON.stringify({ ok: false, error: "chat_id required" }),
          { status: 400, headers: { "content-type": "application/json" } },
        );
      }
      const res = await tg("sendMessage", {
        chat_id: chatId,
        text: "Self-test ✅ Bot can send messages.",
      });
      const txt = await res.text().catch(() => "");
      return new Response(
        JSON.stringify({
          ok: res.ok,
          status: res.status,
          body: txt.slice(0, 300),
        }),
        { headers: { "content-type": "application/json" } },
      );
    }

    // POST path: simulate Telegram → Webhook with a /start update
    const { chat_id } = await req.json().catch(() => ({}));
    if (!chat_id) {
      return new Response(
        JSON.stringify({ ok: false, error: "chat_id required in JSON" }),
        { status: 400, headers: { "content-type": "application/json" } },
      );
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
    return new Response(
      JSON.stringify({
        ok: resp.ok,
        status: resp.status,
        webhook: WEBHOOK,
        body: body.slice(0, 300),
      }),
      {
        headers: {
          "content-type": "application/json",
          "cache-control": "no-store",
        },
      },
    );
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
});
