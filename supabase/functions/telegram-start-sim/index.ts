import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { optionalEnv } from "../_shared/env.ts";
import { expectedSecret } from "../_shared/telegram_secret.ts";
import { ok, bad, oops, mna } from "../_shared/http.ts";

serve(async (req) => {
  const url = new URL(req.url);
  if (req.method === "GET" && url.pathname.endsWith("/version")) {
    return ok({ name: "telegram-start-sim", ts: new Date().toISOString() });
  }
  if (req.method === "HEAD") return new Response(null, { status: 200 });

  try {
    let chatId: number | null = null;

    if (req.method === "GET") {
      const id = url.searchParams.get("chat_id");
      if (id) chatId = Number(id);
    } else if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      if (body && body.chat_id !== undefined) {
        chatId = Number(body.chat_id);
      }
    } else {
      return mna();
    }

    if (!chatId) {
      return bad("chat_id is required");
    }

    const base = (optionalEnv("SUPABASE_URL") || "").replace(/\/$/, "");
    if (!base) {
      return oops("SUPABASE_URL not set");
    }

    const webhookUrl = `${base}/functions/v1/telegram-webhook`;

    const update = {
      update_id: Date.now(),
      message: {
        message_id: 1,
        date: Math.floor(Date.now() / 1000),
        chat: { id: chatId, type: "private" },
        text: "/start",
      },
    };

    const fetchHeaders: Record<string, string> = {
      "Content-Type": "application/json",
    };

    const secret = await expectedSecret();
    if (secret) {
      fetchHeaders["x-telegram-bot-api-secret-token"] = secret;
    }

    const resp = await fetch(webhookUrl, {
      method: "POST",
      headers: fetchHeaders,
      body: JSON.stringify(update),
      signal: AbortSignal.timeout(8000),
    });

    const text = await resp.text();

    return ok({
      telegram_ok: resp.ok,
      status: resp.status,
      webhook_url: webhookUrl,
      preview: text.slice(0, 300),
    });
  } catch (err) {
    return oops("start-sim failed", String(err));
  }
});
