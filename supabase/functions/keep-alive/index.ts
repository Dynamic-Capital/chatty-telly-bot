import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getEnv } from "../_shared/env.ts";
import { createLogger } from "../_shared/logger.ts";
import { json, mna } from "../_shared/http.ts";
import { version } from "../_shared/version.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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
  }, 4 * 60 * 1000);
}

function stopKeepAlive() {
  if (keepAliveTimer) {
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
  }
}

export async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return json({}, 200, corsHeaders);
  }
  const v = version(req, "keep-alive");
  if (v) return v;
  if (req.method !== "POST") return mna();

  const logger = getLogger(req);

  try {
    startKeepAlive();
    getEnv("TELEGRAM_BOT_TOKEN");
    logger.info("Keep-alive service started for telegram bot");
    return json(
      {
        success: true,
        message: "Keep-alive service active",
        timestamp: new Date().toISOString(),
        status: "Bot function will stay warm to reduce response lag",
      },
      200,
      corsHeaders,
    );
  } catch (error) {
    logger.error("Error in keep-alive service:", error);
    return json(
      {
        error: (error as Error).message,
        success: false,
      },
      500,
      corsHeaders,
    );
  }
}

if (import.meta.main) serve(handler);

addEventListener("beforeunload", () => {
  stopKeepAlive();
  baseLogger.info("Keep-alive service stopped");
});
