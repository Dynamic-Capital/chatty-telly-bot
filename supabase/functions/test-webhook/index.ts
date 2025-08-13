import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createLogger } from "../_shared/logger.ts";
import { optionalEnv } from "../_shared/env.ts";

const BOT_TOKEN = optionalEnv("TELEGRAM_BOT_TOKEN");

function getLogger(req: Request) {
  return createLogger({
    function: "test-webhook",
    requestId:
      req.headers.get("sb-request-id") ||
      req.headers.get("x-request-id") ||
      crypto.randomUUID(),
  });
}

serve(async (req) => {
  const logger = getLogger(req);
  logger.info("🔧 WEBHOOK TEST FUNCTION CALLED!");
  logger.info("Method:", req.method);
  logger.info("Headers:", Object.fromEntries(req.headers.entries()));

  try {
    const body = await req.text();
    logger.info("Body:", body);

    // Test if bot token works
    if (BOT_TOKEN) {
      const testResponse = await fetch(
        `https://api.telegram.org/bot${BOT_TOKEN}/getMe`,
      );
      const testResult = await testResponse.json();
      logger.info("Bot test result:", testResult);

      // Get webhook info
      const webhookResponse = await fetch(
        `https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`,
      );
      const webhookResult = await webhookResponse.json();
      logger.info("Current webhook:", webhookResult);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Test function working!",
        timestamp: new Date().toISOString(),
        method: req.method,
        body: body,
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    logger.error("Error:", error);
    return new Response(
      JSON.stringify({
        error: error.message,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
});
