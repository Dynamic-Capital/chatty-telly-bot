import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getEnv } from "../_shared/env.ts";
import { createLogger } from "../_shared/logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Keep-alive function to prevent cold starts
let keepAliveTimer: number | null = null;

const baseLogger = createLogger({ function: "keep-alive" });

function getLogger(req: Request) {
  return createLogger({
    function: "keep-alive",
    requestId:
      req.headers.get("sb-request-id") ||
      req.headers.get("x-request-id") ||
      crypto.randomUUID(),
  });
}

function startKeepAlive() {
  if (keepAliveTimer) return;

  keepAliveTimer = setInterval(() => {
    baseLogger.info("Keep-alive ping:", new Date().toISOString());
  }, 4 * 60 * 1000); // Every 4 minutes
}

function stopKeepAlive() {
  if (keepAliveTimer) {
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
  }
}

serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const logger = getLogger(req);

  try {
    // Start keep-alive on first request
    startKeepAlive();

    const botToken = getEnv("TELEGRAM_BOT_TOKEN");

    logger.info("Keep-alive service started for telegram bot");

    return new Response(
      JSON.stringify({
        success: true,
        message: "Keep-alive service active",
        timestamp: new Date().toISOString(),
        status: "Bot function will stay warm to reduce response lag",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    logger.error("Error in keep-alive service:", error);
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

// Cleanup on shutdown
addEventListener("beforeunload", () => {
  stopKeepAlive();
  baseLogger.info("Keep-alive service stopped");
});
