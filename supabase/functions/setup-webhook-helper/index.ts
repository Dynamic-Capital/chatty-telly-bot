import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { need } from "../_shared/env.ts";
import { ok, oops, mna } from "../_shared/http.ts";
import { ensureWebhookSecret } from "../_shared/telegram_secret.ts";
import { createClient } from "../_shared/client.ts";
import { version } from "../_shared/version.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function withCors(res: Response) {
  Object.entries(corsHeaders).forEach(([k, v]) => res.headers.set(k, v));
  return res;
}

export async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return withCors(ok());
  }
  const v = version(req, "setup-webhook-helper");
  if (v) return withCors(v);
  if (req.method !== "POST") {
    return withCors(mna());
  }

  try {
    const BOT_TOKEN = need("TELEGRAM_BOT_TOKEN");
    const SUPABASE_URL = need("SUPABASE_URL");
    const PROJECT_URL = SUPABASE_URL.replace("https://", "").replace(".supabase.co", "");
    const WEBHOOK_URL = `https://${PROJECT_URL}.functions.supabase.co/telegram-bot`;

    const supa = createClient();
    const WEBHOOK_SECRET = await ensureWebhookSecret(supa);

    console.log(`Setting up webhook: ${WEBHOOK_URL}`);
    console.log(`Using webhook secret: ${WEBHOOK_SECRET}`);

    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: WEBHOOK_URL,
          secret_token: WEBHOOK_SECRET,
          drop_pending_updates: true,
        }),
      },
    );

    const telegramResult = await telegramResponse.json();

    if (!telegramResult.ok) {
      console.error("Telegram webhook setup failed:", telegramResult);
      return withCors(oops("Failed to set webhook with Telegram", telegramResult));
    }
    return withCors(ok({
      success: true,
      webhook_url: WEBHOOK_URL,
      telegram_response: telegramResult,
      message: "Webhook configured successfully!",
      webhook_secret: WEBHOOK_SECRET,
      instructions: [
        "If TELEGRAM_WEBHOOK_SECRET is not set in Supabase secrets, add it with the provided value",
      ],
    }));
  } catch (error) {
    console.error("Setup webhook error:", error);
    return withCors(oops("Failed to setup webhook", { error: (error as Error).message }));
  }
}

if (import.meta.main) serve(handler);
