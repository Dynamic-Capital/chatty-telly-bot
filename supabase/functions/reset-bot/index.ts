import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    console.log("Resetting Telegram bot...");

    // 1. Delete the current webhook
    const deleteResponse = await fetch(`https://api.telegram.org/bot${botToken}/deleteWebhook`, {
      method: 'POST',
    });
    const deleteResult = await deleteResponse.json();
    console.log("Delete webhook result:", deleteResult);

    // 2. Clear any pending updates
    const clearUpdatesResponse = await fetch(`https://api.telegram.org/bot${botToken}/getUpdates?offset=-1`, {
      method: 'POST',
    });
    const clearUpdatesResult = await clearUpdatesResponse.json();
    console.log("Cleared pending updates:", clearUpdatesResult);

    // 3. Re-establish the webhook
    const projectUrl = Deno.env.get("SUPABASE_URL");
    if (!projectUrl) {
      throw new Error("SUPABASE_URL is not set");
    }
    const webhookUrl = `${projectUrl}/functions/v1/telegram-bot`;
    const setWebhookResponse = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ['message', 'callback_query', 'inline_query'],
        drop_pending_updates: true
      }),
    });

    const webhookResult = await setWebhookResponse.json();
    console.log("Webhook reset result:", webhookResult);

    if (!webhookResult.ok) {
      throw new Error(`Failed to reset webhook: ${webhookResult.description}`);
    }

    // 4. Get webhook info to confirm
    const infoResponse = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
    const webhookInfo = await infoResponse.json();
    console.log("New webhook info:", webhookInfo);

    // 5. Test bot responsiveness
    const botInfoResponse = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const botInfo = await botInfoResponse.json();
    console.log("Bot info after reset:", botInfo);

    return new Response(JSON.stringify({
      success: true,
      message: "Bot reset successfully! All sessions cleared and webhook reestablished.",
      steps_completed: [
        "Webhook deleted",
        "Pending updates cleared", 
        "Webhook reestablished",
        "Bot responsiveness verified"
      ],
      webhook_info: webhookInfo.result,
      bot_info: botInfo.result
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200
    });

  } catch (error) {
    console.error("Error resetting bot:", error);
    return new Response(JSON.stringify({
      error: error.message,
      success: false,
      message: "Failed to reset bot. Check logs for details."
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500
    });
  }
});