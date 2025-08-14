import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { need } from "../_shared/env.ts";
import { ok, oops } from "../_shared/http.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { 
      status: 405,
      headers: corsHeaders 
    });
  }

  try {
    const BOT_TOKEN = need("TELEGRAM_BOT_TOKEN");
    const PROJECT_URL = need("SUPABASE_URL").replace("https://", "").replace(".supabase.co", "");
    const WEBHOOK_URL = `https://${PROJECT_URL}.functions.supabase.co/telegram-bot`;
    
    // Generate a secure webhook secret
    const WEBHOOK_SECRET = crypto.randomUUID();
    
    console.log(`Setting up webhook: ${WEBHOOK_URL}`);
    console.log(`Generated webhook secret: ${WEBHOOK_SECRET}`);

    // Set webhook with Telegram
    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: WEBHOOK_URL,
          secret_token: WEBHOOK_SECRET,
          drop_pending_updates: true
        })
      }
    );

    const telegramResult = await telegramResponse.json();
    
    if (!telegramResult.ok) {
      console.error("Telegram webhook setup failed:", telegramResult);
      return oops("Failed to set webhook with Telegram", telegramResult);
    }

    // Update bot_settings with the new webhook secret
    const SUPABASE_URL = need("SUPABASE_URL");
    const SERVICE_KEY = need("SUPABASE_SERVICE_ROLE_KEY");

    const settingsResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/bot_settings`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          setting_key: 'TELEGRAM_WEBHOOK_SECRET',
          setting_value: WEBHOOK_SECRET,
          is_active: true,
          description: 'Auto-generated webhook secret for Telegram bot'
        })
      }
    );

    if (!settingsResponse.ok) {
      console.error("Failed to update bot settings");
      return oops("Failed to save webhook secret to database");
    }

    // Also set the webhook secret as a Supabase secret
    // Note: This would need to be done manually by the user in the Supabase dashboard

    const response = ok({
      success: true,
      webhook_url: WEBHOOK_URL,
      telegram_response: telegramResult,
      message: "Webhook configured successfully! Please set TELEGRAM_WEBHOOK_SECRET in Supabase secrets.",
      webhook_secret: WEBHOOK_SECRET,
      instructions: [
        "1. Go to Supabase Dashboard > Edge Functions > Secrets",
        "2. Add/Update TELEGRAM_WEBHOOK_SECRET with the provided value",
        "3. The bot should start working immediately"
      ]
    });

    return new Response(response.body, {
      status: response.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error("Setup webhook error:", error);
    const response = oops("Failed to setup webhook", { error: error.message });
    return new Response(response.body, {
      status: response.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});