import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { requireEnv } from "../_shared/env.ts";
import { expectedSecret } from "../_shared/telegram_secret.ts";
import { json, mna } from "../_shared/http.ts";
import { version } from "../_shared/version.ts";

const { TELEGRAM_BOT_TOKEN: BOT_TOKEN, SUPABASE_URL } = requireEnv(
  ["TELEGRAM_BOT_TOKEN", "SUPABASE_URL"] as const,
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const DEBUG = Deno.env.get("DEBUG");
function debug(...args: unknown[]) {
  if (DEBUG) console.debug(...args);
}

// Avoid logging sensitive environment details or full API responses.

export async function handler(req: Request): Promise<Response> {
  console.info("Webhook setup invoked");

  if (req.method === "OPTIONS") {
    return json({}, 200, corsHeaders);
  }
  const v = version(req, "setup-telegram-webhook");
  if (v) return v;
  if (req.method !== "POST") return mna();

  try {
    if (!BOT_TOKEN) {
      console.error("Bot token not configured");
      return json({ success: false, error: "Bot token not configured" }, 500, corsHeaders);
    }

    if (!SUPABASE_URL) {
      console.error("Supabase URL not configured");
      return json({ success: false, error: "Supabase URL not configured" }, 500, corsHeaders);
    }

    const SECRET = await expectedSecret();
    if (!SECRET) {
      console.error("❌ TELEGRAM_WEBHOOK_SECRET not configured");
      return json({ success: false, error: "Webhook secret not configured" }, 500, corsHeaders);
    }

    const webhookUrl = `${SUPABASE_URL}/functions/v1/telegram-bot`;

    debug("Deleting existing webhook");
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    debug("Setting new webhook");
    const response = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: webhookUrl,
          secret_token: SECRET,
          allowed_updates: ["message", "callback_query"],
          drop_pending_updates: true,
        }),
      },
    );

    const result = await response.json();
    if (result.ok) {
      debug("Webhook set");
      return json(
        { success: true, webhook_set: true, webhook_url: webhookUrl },
        200,
        corsHeaders,
      );
    } else {
      console.error("Webhook setup failed", result.description);
      return json(
        { success: false, error: result.description, webhook_url: webhookUrl },
        400,
        corsHeaders,
      );
    }
  } catch (error) {
    console.error("Error setting up webhook", error);
    return json(
      {
        success: false,
        error: (error as Error).message,
      },
      500,
      corsHeaders,
    );
  }
}

if (import.meta.main) serve(handler);
