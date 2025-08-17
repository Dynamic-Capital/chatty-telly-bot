import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { need, maybe } from "../_shared/env.ts";
import { ok, oops } from "../_shared/http.ts";
import { getSetting } from "../_shared/config.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const BOT_TOKEN = need("TELEGRAM_BOT_TOKEN");
    const SUPABASE_URL = need("SUPABASE_URL");
    const SERVICE_KEY = need("SUPABASE_SERVICE_ROLE_KEY");

    console.log("Checking bot status...");

    // Check bot info from Telegram
    const botInfoResponse = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/getMe`
    );
    const botInfo = await botInfoResponse.json();

    // Check webhook info
    const webhookResponse = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`
    );
    const webhookInfo = await webhookResponse.json();

    // Read webhook secret from database
    const dbSecret = await getSetting<string>("TELEGRAM_WEBHOOK_SECRET");
    const envSecret = maybe("TELEGRAM_WEBHOOK_SECRET");

    // Check bot users count
    const usersResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/bot_users?select=count`,
      {
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'Prefer': 'count=exact'
        },
      }
    );
    const userCount = usersResponse.headers.get('content-range')?.split('/')[1] || '0';

    const status = {
      bot_info: {
        success: botInfo.ok,
        data: botInfo.ok ? {
          id: botInfo.result.id,
          username: botInfo.result.username,
          first_name: botInfo.result.first_name,
          can_read_all_group_messages: botInfo.result.can_read_all_group_messages,
          supports_inline_queries: botInfo.result.supports_inline_queries
        } : null,
        error: !botInfo.ok ? botInfo.description : null
      },
      webhook_info: {
        success: webhookInfo.ok,
        data: webhookInfo.ok ? {
          url: webhookInfo.result.url,
          has_custom_certificate: webhookInfo.result.has_custom_certificate,
          pending_update_count: webhookInfo.result.pending_update_count,
          last_error_date: webhookInfo.result.last_error_date,
          last_error_message: webhookInfo.result.last_error_message,
          max_connections: webhookInfo.result.max_connections,
          allowed_updates: webhookInfo.result.allowed_updates
        } : null,
        error: !webhookInfo.ok ? webhookInfo.description : null
      },
      secrets: {
        db_secret_exists: !!dbSecret,
        env_secret_exists: !!envSecret,
        secrets_match: dbSecret === envSecret,
        db_secret_preview: dbSecret ? `${dbSecret.substring(0, 8)}...` : null
      },
      database: {
        total_users: parseInt(userCount),
        connection_successful: usersResponse.ok
      },
      recommendations: []
    };

    // Add recommendations based on status
    if (!status.bot_info.success) {
      status.recommendations.push("❌ Bot token is invalid. Check TELEGRAM_BOT_TOKEN in Supabase secrets");
    }

    if (!status.webhook_info.data?.url) {
      status.recommendations.push("⚠️ No webhook URL set. Use setup-webhook-helper to configure");
    }

    if (!status.secrets.env_secret_exists) {
      status.recommendations.push("❌ TELEGRAM_WEBHOOK_SECRET not set in Supabase secrets");
    }

    if (!status.secrets.secrets_match && status.secrets.db_secret_exists && status.secrets.env_secret_exists) {
      status.recommendations.push("⚠️ Webhook secrets don't match between database and environment");
    }

    if (status.webhook_info.data?.pending_update_count > 0) {
      status.recommendations.push(`⚠️ ${status.webhook_info.data.pending_update_count} pending updates. Consider clearing them`);
    }

    if (status.webhook_info.data?.last_error_message) {
      status.recommendations.push(`❌ Last webhook error: ${status.webhook_info.data.last_error_message}`);
    }

    if (status.recommendations.length === 0) {
      status.recommendations.push("✅ Bot configuration looks good!");
    }

    const response = ok({
      status: "success",
      timestamp: new Date().toISOString(),
      ...status
    });

    return new Response(response.body, {
      status: response.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error("Bot status check error:", error);
    const response = oops("Failed to check bot status", { error: error.message });
    return new Response(response.body, {
      status: response.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});