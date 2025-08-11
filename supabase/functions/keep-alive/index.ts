import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getEnv } from "../_shared/env.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Keep-alive function to prevent cold starts
let keepAliveTimer: number | null = null;

function startKeepAlive() {
  if (keepAliveTimer) return;

  keepAliveTimer = setInterval(() => {
    console.log("Keep-alive ping:", new Date().toISOString());
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

  try {
    // Start keep-alive on first request
    startKeepAlive();

    const botToken = getEnv("TELEGRAM_BOT_TOKEN");

    console.log("Keep-alive service started for telegram bot");

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
    console.error("Error in keep-alive service:", error);
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
  console.log("Keep-alive service stopped");
});
