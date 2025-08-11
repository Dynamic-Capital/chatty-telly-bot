import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { optionalEnv } from "../_shared/env.ts";

serve(async (req) => {
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  };

  try {
    let chatId: number | null = null;

    if (req.method === "GET") {
      const url = new URL(req.url);
      const id = url.searchParams.get("chat_id");
      if (id) chatId = Number(id);
    } else if (req.method === "POST") {
      try {
        const body = await req.json();
        if (body && body.chat_id !== undefined) {
          chatId = Number(body.chat_id);
        }
      } catch {
        // ignore JSON parse errors
      }
    }

    if (!chatId) {
      return new Response(
        JSON.stringify({ ok: false, error: "chat_id is required" }),
        { status: 400, headers },
      );
    }

    const base = (optionalEnv("SUPABASE_URL") || "").replace(/\/$/, "");
    if (!base) {
      return new Response(
        JSON.stringify({ ok: false, error: "SUPABASE_URL not set" }),
        { status: 500, headers },
      );
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

    const secret = optionalEnv("TELEGRAM_WEBHOOK_SECRET");
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

    return new Response(
      JSON.stringify({
        ok: resp.ok,
        status: resp.status,
        webhook_url: webhookUrl,
        preview: text.slice(0, 300),
      }),
      { headers },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers },
    );
  }
});
