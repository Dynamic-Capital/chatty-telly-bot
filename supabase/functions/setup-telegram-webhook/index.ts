import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  console.log("🔧 Webhook setup function called");
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🔑 Checking environment variables...");
    console.log("BOT_TOKEN exists:", !!BOT_TOKEN);
    console.log("SUPABASE_URL exists:", !!SUPABASE_URL);
    
    if (!BOT_TOKEN) {
      console.error("❌ Bot token not configured");
      return new Response("Bot token not configured", { status: 500, headers: corsHeaders });
    }

    if (!SUPABASE_URL) {
      console.error("❌ Supabase URL not configured");
      return new Response("Supabase URL not configured", { status: 500, headers: corsHeaders });
    }

    // Set webhook URL to our edge function
    // Append ?forceFunctionRegion=<project-region> for latency pinning
    const webhookUrl = `${SUPABASE_URL}/functions/v1/telegram-bot`;
    
    console.log(`🔗 Setting webhook to: ${webhookUrl}`);
    
    // First, delete any existing webhook
    console.log("🗑️ Deleting existing webhook...");
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook`);

    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Set new webhook
    console.log("📡 Setting new webhook...");
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ["message", "callback_query"],
        drop_pending_updates: true // Clear any pending updates
      })
    });

    const result = await response.json();
    console.log("📋 Webhook setup result:", JSON.stringify(result, null, 2));

    if (result.ok) {
      // Test bot info
      console.log("🤖 Testing bot info...");
      const botInfoResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`);
      const botInfo = await botInfoResponse.json();
      console.log("🤖 Bot info:", JSON.stringify(botInfo, null, 2));
      
      // Get webhook info to verify
      console.log("🔍 Verifying webhook info...");
      const webhookInfoResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
      const webhookInfo = await webhookInfoResponse.json();
      console.log("🔍 Webhook info:", JSON.stringify(webhookInfo, null, 2));
      
      return new Response(JSON.stringify({
        success: true,
        webhook_set: true,
        webhook_url: webhookUrl,
        bot_info: botInfo.result,
        webhook_info: webhookInfo.result,
        message: "Webhook configured successfully!"
      }, null, 2), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    } else {
      console.error("❌ Webhook setup failed:", result);
      return new Response(JSON.stringify({
        success: false,
        error: result.description,
        webhook_url: webhookUrl,
        full_response: result
      }, null, 2), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  } catch (error) {
    console.error("🚨 Error setting up webhook:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      stack: error.stack
    }, null, 2), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});