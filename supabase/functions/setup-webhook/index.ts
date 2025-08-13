import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getEnv } from "../_shared/env.ts";
import { createLogger } from "../_shared/logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function getLogger(req: Request) {
  return createLogger({
    function: "setup-webhook",
    requestId:
      req.headers.get("sb-request-id") ||
      req.headers.get("x-request-id") ||
      crypto.randomUUID(),
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const logger = getLogger(req);

  try {
    const botToken = getEnv("TELEGRAM_BOT_TOKEN");

    logger.info("Setting up Telegram webhook...");

    const supabaseUrl = getEnv("SUPABASE_URL");

    // Get the webhook URL for our telegram-bot function
    const webhookUrl = `${supabaseUrl}/functions/v1/telegram-bot`;

    logger.info("Webhook URL:", webhookUrl);

    // Delete any existing webhook first
    const deleteResponse = await fetch(
      `https://api.telegram.org/bot${botToken}/deleteWebhook`,
      {
        method: "POST",
      },
    );
    const deleteResult = await deleteResponse.json();
    logger.info("Delete webhook result:", deleteResult);

    // Set the new webhook
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/setWebhook`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: webhookUrl,
          allowed_updates: ["message", "callback_query", "inline_query"],
          drop_pending_updates: true,
        }),
      },
    );

    const result = await response.json();
    logger.info("Webhook setup result:", result);

    if (!result.ok) {
      throw new Error(`Failed to set webhook: ${result.description}`);
    }

    // Get webhook info to confirm
    const infoResponse = await fetch(
      `https://api.telegram.org/bot${botToken}/getWebhookInfo`,
    );
    const webhookInfo = await infoResponse.json();
    logger.info("Webhook info:", webhookInfo);

    // Test bot info
    const botInfoResponse = await fetch(
      `https://api.telegram.org/bot${botToken}/getMe`,
    );
    const botInfo = await botInfoResponse.json();
    logger.info("Bot info:", botInfo);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Webhook configured successfully",
        webhook_set: result,
        webhook_info: webhookInfo.result,
        bot_info: botInfo.result,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    logger.error("Error setting up webhook:", error);
    return new Response(
      JSON.stringify({
        error: error.message,
        success: false,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
});
