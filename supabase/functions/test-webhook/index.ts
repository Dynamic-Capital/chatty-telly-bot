import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { optionalEnv } from "../_shared/env.ts";

const BOT_TOKEN = optionalEnv("TELEGRAM_BOT_TOKEN");

serve(async (req) => {
  console.log("🔧 WEBHOOK TEST FUNCTION CALLED!");
  console.log("Method:", req.method);
  console.log("Headers:", Object.fromEntries(req.headers.entries()));

  try {
    const body = await req.text();
    console.log("Body:", body);

    // Test if bot token works
    if (BOT_TOKEN) {
      const testResponse = await fetch(
        `https://api.telegram.org/bot${BOT_TOKEN}/getMe`,
      );
      const testResult = await testResponse.json();
      console.log("Bot test result:", testResult);

      // Get webhook info
      const webhookResponse = await fetch(
        `https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`,
      );
      const webhookResult = await webhookResponse.json();
      console.log("Current webhook:", webhookResult);
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
    console.error("Error:", error);
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
