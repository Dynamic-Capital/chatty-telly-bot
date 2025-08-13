import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { optionalEnv } from "../_shared/env.ts";
import { createLogger } from "../_shared/logger.ts";

const BOT_TOKEN = optionalEnv("TELEGRAM_BOT_TOKEN");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function getLogger(req: Request) {
  return createLogger({
    function: "debug-bot",
    requestId:
      req.headers.get("sb-request-id") ||
      req.headers.get("x-request-id") ||
      crypto.randomUUID(),
  });
}

serve(async (req) => {
  const logger = getLogger(req);
  logger.info("🔧 Debug function called");
  logger.info("Method:", req.method);
  logger.info("URL:", req.url);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logger.info("🔑 Environment check:");
    logger.info("BOT_TOKEN exists:", !!BOT_TOKEN);
    logger.info("BOT_TOKEN length:", BOT_TOKEN?.length || 0);

    if (!BOT_TOKEN) {
      return new Response(
        JSON.stringify({
          error: "Bot token not configured",
          env_check: {
            bot_token: false,
          },
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Test Telegram API connectivity
    logger.info("🤖 Testing Telegram API...");
    const botInfoResponse = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/getMe`,
    );
    const botInfo = await botInfoResponse.json();

    logger.info("🤖 Bot info response:", JSON.stringify(botInfo, null, 2));

    // Get current webhook info
    logger.info("🔍 Getting webhook info...");
    const webhookInfoResponse = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`,
    );
    const webhookInfo = await webhookInfoResponse.json();

    logger.info("🔍 Webhook info:", JSON.stringify(webhookInfo, null, 2));

    // Test bot function URL
    const supabaseUrl = optionalEnv("SUPABASE_URL");
    const botFunctionUrl = `${supabaseUrl}/functions/v1/telegram-bot`;

    logger.info("🧪 Testing bot function URL:", botFunctionUrl);

    let botFunctionTest;
    try {
      const testResponse = await fetch(botFunctionUrl);
      const testText = await testResponse.text();
      botFunctionTest = {
        status: testResponse.status,
        ok: testResponse.ok,
        response: testText,
      };
    } catch (error) {
      botFunctionTest = {
        error: error.message,
      };
    }

    return new Response(
      JSON.stringify(
        {
          success: true,
          timestamp: new Date().toISOString(),
          environment: {
            bot_token_configured: !!BOT_TOKEN,
            supabase_url: supabaseUrl,
          },
          telegram_api: {
            bot_info: botInfo,
            webhook_info: webhookInfo,
          },
          bot_function_test: botFunctionTest,
          bot_function_url: botFunctionUrl,
        },
        null,
        2,
      ),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    logger.error("🚨 Debug error:", error);
    return new Response(
      JSON.stringify(
        {
          success: false,
          error: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString(),
        },
        null,
        2,
      ),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
