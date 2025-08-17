import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { optionalEnv } from "../_shared/env.ts";
import { expectedSecret } from "../_shared/telegram_secret.ts";
import { bad, ok, oops, mna } from "../_shared/http.ts";
import { version } from "../_shared/version.ts";

export async function handler(req: Request): Promise<Response> {
  const v = version(req, "telegram-start-sim");
  if (v) return v;
  if (req.method !== "GET" && req.method !== "POST") return mna();
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
    } else {
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
      sent_ok: resp.ok,
      status: resp.status,
      webhook_url: webhookUrl,
      preview: text.slice(0, 300),
    });
  } catch (err) {
    return oops(String(err));
  }
}

if (import.meta.main) serve(handler);
