import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!botToken) {
      throw new Error("TELEGRAM_BOT_TOKEN is not set");
    }

    console.log("Setting up Telegram webhook...");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (!supabaseUrl) {
      throw new Error("SUPABASE_URL is not set");
    }

    // Get the webhook URL for our telegram-bot function
    const webhookUrl = `${supabaseUrl}/functions/v1/telegram-bot`;

    console.log("Webhook URL:", webhookUrl);

    // Delete any existing webhook first
    const deleteResponse = await fetch(
      `https://api.telegram.org/bot${botToken}/deleteWebhook`,
      {
        method: "POST",
      },
    );
    const deleteResult = await deleteResponse.json();
    console.log("Delete webhook result:", deleteResult);

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
    console.log("Webhook setup result:", result);

    if (!result.ok) {
      throw new Error(`Failed to set webhook: ${result.description}`);
    }

    // Get webhook info to confirm
    const infoResponse = await fetch(
      `https://api.telegram.org/bot${botToken}/getWebhookInfo`,
    );
    const webhookInfo = await infoResponse.json();
    console.log("Webhook info:", webhookInfo);

    // Test bot info
    const botInfoResponse = await fetch(
      `https://api.telegram.org/bot${botToken}/getMe`,
    );
    const botInfo = await botInfoResponse.json();
    console.log("Bot info:", botInfo);

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
    console.error("Error setting up webhook:", error);
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
