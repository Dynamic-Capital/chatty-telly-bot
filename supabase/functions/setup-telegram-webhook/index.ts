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

export async function handler(req: Request): Promise<Response> {
  console.log("🔧 Webhook setup function called");

  if (req.method === "OPTIONS") {
    return json({}, 200, corsHeaders);
  }
  const v = version(req, "setup-telegram-webhook");
  if (v) return v;
  if (req.method !== "POST") return mna();

  try {
    console.log("🔑 Checking environment variables...");
    console.log("BOT_TOKEN exists:", !!BOT_TOKEN);
    console.log("SUPABASE_URL exists:", !!SUPABASE_URL);

    if (!BOT_TOKEN) {
      console.error("❌ Bot token not configured");
      return json({ success: false, error: "Bot token not configured" }, 500, corsHeaders);
    }

    if (!SUPABASE_URL) {
      console.error("❌ Supabase URL not configured");
      return json({ success: false, error: "Supabase URL not configured" }, 500, corsHeaders);
    }

    const SECRET = await expectedSecret();
    if (!SECRET) {
      console.error("❌ TELEGRAM_WEBHOOK_SECRET not configured");
      return json({ success: false, error: "Webhook secret not configured" }, 500, corsHeaders);
    }

    const webhookUrl = `${SUPABASE_URL}/functions/v1/telegram-bot`;

    console.log("🔗 Setting webhook...");

    console.log("🗑️ Deleting existing webhook...");
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook`);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    console.log("📡 Setting new webhook...");
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
    console.log("📋 Webhook setup result:", JSON.stringify(result, null, 2));

    if (result.ok) {
      console.log("🤖 Testing bot info...");
      const botInfoResponse = await fetch(
        `https://api.telegram.org/bot${BOT_TOKEN}/getMe`,
      );
      const botInfo = await botInfoResponse.json();
      console.log("🤖 Bot info:", JSON.stringify(botInfo, null, 2));

      console.log("🔍 Verifying webhook info...");
      const webhookInfoResponse = await fetch(
        `https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`,
      );
      const webhookInfo = await webhookInfoResponse.json();
      console.log("🔍 Webhook info:", JSON.stringify(webhookInfo, null, 2));

      return json(
        {
          success: true,
          webhook_set: true,
          webhook_url: webhookUrl,
          bot_info: botInfo.result,
          webhook_info: webhookInfo.result,
          message: "Webhook configured successfully!",
        },
        200,
        corsHeaders,
      );
    } else {
      console.error("❌ Webhook setup failed:", result);
      return json(
        {
          success: false,
          error: result.description,
          webhook_url: webhookUrl,
          full_response: result,
        },
        400,
        corsHeaders,
      );
    }
  } catch (error) {
    console.error("🚨 Error setting up webhook:", error);
    return json(
      {
        success: false,
        error: (error as Error).message,
        stack: (error as Error).stack,
      },
      500,
      corsHeaders,
    );
  }
}

if (import.meta.main) serve(handler);
