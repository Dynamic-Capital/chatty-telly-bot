import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!BOT_TOKEN) {
      return new Response("Bot token not configured", { status: 500, headers: corsHeaders });
    }

    // Set webhook URL to our edge function
    const webhookUrl = `${SUPABASE_URL}/functions/v1/telegram-bot`;
    
    console.log(`Setting webhook to: ${webhookUrl}`);
    
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ["message", "callback_query"]
      })
    });

    const result = await response.json();
    console.log("Webhook setup result:", result);

    if (result.ok) {
      // Test bot info
      const botInfoResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`);
      const botInfo = await botInfoResponse.json();
      
      return new Response(JSON.stringify({
        success: true,
        webhook_set: true,
        webhook_url: webhookUrl,
        bot_info: botInfo.result,
        message: "Webhook configured successfully!"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    } else {
      return new Response(JSON.stringify({
        success: false,
        error: result.description,
        webhook_url: webhookUrl
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  } catch (error) {
    console.error("Error setting up webhook:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});