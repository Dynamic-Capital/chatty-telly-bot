import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    if (!botToken) {
      throw new Error('TELEGRAM_BOT_TOKEN is not set');
    }

    console.log('Testing bot status...');

    // 1. Check bot info
    const botInfoResponse = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const botInfo = await botInfoResponse.json();
    console.log('Bot info result:', botInfo);

    // 2. Check webhook info
    const webhookResponse = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
    const webhookInfo = await webhookResponse.json();
    console.log('Webhook info result:', webhookInfo);

    // 3. Check for pending updates
    const updatesResponse = await fetch(
      `https://api.telegram.org/bot${botToken}/getUpdates?limit=1`,
    );
    const updatesInfo = await updatesResponse.json();
    console.log('Recent updates:', updatesInfo);

    return new Response(
      JSON.stringify({
        success: true,
        bot_status: botInfo.ok ? '✅ Bot Active' : '❌ Bot Error',
        bot_info: botInfo.result,
        webhook_status: webhookInfo.result?.url ? '✅ Webhook Set' : '❌ No Webhook',
        webhook_info: webhookInfo.result,
        pending_updates: updatesInfo.result?.length || 0,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );
  } catch (error) {
    console.error('Error testing bot:', error);
    return new Response(
      JSON.stringify({
        error: error.message,
        success: false,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    );
  }
});
