import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getEnv } from "../_shared/env.ts";
import { json, mna } from "../_shared/http.ts";
import { version } from "../_shared/version.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

export async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return json({}, 200, corsHeaders);
  }
  const v = version(req, "test-bot-status");
  if (v) return v;
  if (req.method !== "POST") return mna();

  try {
    const botToken = getEnv("TELEGRAM_BOT_TOKEN");

    console.log("Testing bot status...");

    const botInfoResponse = await fetch(
      `https://api.telegram.org/bot${botToken}/getMe`,
    );
    const botInfo = await botInfoResponse.json();
    console.log("Bot info result:", botInfo);

    const webhookResponse = await fetch(
      `https://api.telegram.org/bot${botToken}/getWebhookInfo`,
    );
    const webhookInfo = await webhookResponse.json();
    console.log("Webhook info result:", webhookInfo);

    const updatesResponse = await fetch(
      `https://api.telegram.org/bot${botToken}/getUpdates?limit=1`,
    );
    const updatesInfo = await updatesResponse.json();
    console.log("Recent updates:", updatesInfo);

    return json(
      {
        success: true,
        bot_status: botInfo.ok ? "✅ Bot Active" : "❌ Bot Error",
        bot_info: botInfo.result,
        webhook_status: webhookInfo.result?.url
          ? "✅ Webhook Set"
          : "❌ No Webhook",
        webhook_info: webhookInfo.result,
        pending_updates: updatesInfo.result?.length || 0,
        timestamp: new Date().toISOString(),
      },
      200,
      corsHeaders,
    );
  } catch (error) {
    console.error("Error testing bot:", error);
    return json(
      {
        error: (error as Error).message,
        success: false,
        timestamp: new Date().toISOString(),
      },
      500,
      corsHeaders,
    );
  }
}

if (import.meta.main) serve(handler);
