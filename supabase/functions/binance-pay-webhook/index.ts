import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Signature verification function
async function verifySignature(timestamp: string, nonce: string, body: string, signature: string, secretKey: string): Promise<boolean> {
  const payload = timestamp + '\n' + nonce + '\n' + body + '\n';
  
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secretKey);
  const messageData = encoder.encode(payload);
  
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign']
  );
  
  const expectedSignature = await crypto.subtle.sign('HMAC', key, messageData);
  const expectedSignatureHex = Array.from(new Uint8Array(expectedSignature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
  
  return expectedSignatureHex === signature.toUpperCase();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawBody = await req.text();
    const webhookData = JSON.parse(rawBody);
    
    // Get signature headers for verification
    const timestamp = req.headers.get('BinancePay-Timestamp');
    const nonce = req.headers.get('BinancePay-Nonce');
    const signature = req.headers.get('BinancePay-Signature');
    
    // Verify webhook signature (optional but recommended for production)
    const secretKey = Deno.env.get('BINANCE_SECRET_KEY');
    if (secretKey && timestamp && nonce && signature) {
      const isValid = await verifySignature(timestamp, nonce, rawBody, signature, secretKey);
      if (!isValid) {
        console.error('Invalid webhook signature');
        return new Response(JSON.stringify({ error: 'Invalid signature' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }
    
    console.log('Binance Pay webhook received:', webhookData);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { bizType, data } = webhookData;

    if (bizType === 'PAY_SUCCESS') {
      const { merchantTradeNo, transactionId, transactionTime, payerInfo } = data;

      // Find the payment record
      const { data: payment, error: paymentError } = await supabase
        .from('payments')
        .select(`
          *,
          subscription_plans (*)
        `)
        .eq('id', merchantTradeNo)
        .single();

      if (paymentError || !payment) {
        console.error('Payment not found:', merchantTradeNo);
        throw new Error('Payment not found');
      }

      // Update payment status
      await supabase
        .from('payments')
        .update({
          status: 'completed',
          payment_provider_id: transactionId,
          webhook_data: webhookData,
          updated_at: new Date().toISOString()
        })
        .eq('id', merchantTradeNo);

      // Get or create bot user
      let { data: botUser } = await supabase
        .from('bot_users')
        .select('*')
        .eq('telegram_id', payment.user_id)
        .single();

      if (!botUser) {
        const { data: newBotUser, error: createError } = await supabase
          .from('bot_users')
          .insert({
            telegram_id: payment.user_id,
            is_vip: true,
            current_plan_id: payment.plan_id
          })
          .select()
          .single();

        if (createError) {
          console.error('Error creating bot user:', createError);
        } else {
          botUser = newBotUser;
        }
      }

      // Calculate subscription dates
      const startDate = new Date();
      const endDate = new Date();
      
      if (payment.subscription_plans.is_lifetime) {
        endDate.setFullYear(endDate.getFullYear() + 100); // Lifetime = 100 years
      } else {
        endDate.setMonth(endDate.getMonth() + payment.subscription_plans.duration_months);
      }

      // Update bot user with VIP status
      await supabase
        .from('bot_users')
        .update({
          is_vip: true,
          current_plan_id: payment.plan_id,
          subscription_expires_at: endDate.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('telegram_id', payment.user_id);

      // Create or update user subscription
      await supabase
        .from('user_subscriptions')
        .upsert({
          telegram_user_id: payment.user_id,
          plan_id: payment.plan_id,
          subscription_start_date: startDate.toISOString(),
          subscription_end_date: endDate.toISOString(),
          is_active: true,
          payment_status: 'completed',
          payment_method: 'binance_pay',
          updated_at: new Date().toISOString()
        });

      // Send success message to user via Telegram bot
      const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
      if (botToken) {
        try {
          const message = `🎉 <b>Payment Successful!</b>\n\n✅ Your ${payment.subscription_plans.name} subscription has been activated!\n💎 You now have VIP access until ${endDate.toLocaleDateString()}\n\n🚀 Welcome to the VIP club!`;

          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: payment.user_id,
              text: message,
              parse_mode: 'HTML'
            })
          });
          // Fetch plan channel links from database
          const { data: channels, error: channelError } = await supabase
            .from('plan_channels')
            .select('channel_name, invite_link, chat_id')
            .eq('plan_id', payment.plan_id)
            .eq('is_active', true);

          interface PlanChannel {
            channel_name: string;
            invite_link: string;
            chat_id: string | null;
          }

          if (!channelError && channels && channels.length > 0) {
            const linksText = channels
              .map((c: PlanChannel) => `🔗 ${c.channel_name}: ${c.invite_link}`)
              .join('\n');

            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: payment.user_id,
                text: `📢 <b>VIP Access Links</b>\n\n${linksText}`,
                parse_mode: 'HTML',
                disable_web_page_preview: true
              })
            });

            // Record channel membership entries when chat IDs are available
            const memberships = channels
              .filter((c: PlanChannel) => c.chat_id)
              .map((c: PlanChannel) => ({
                channel_id: c.chat_id!,
                channel_name: c.channel_name,
                package_id: payment.plan_id,
                telegram_user_id: payment.user_id,
                is_active: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                added_at: new Date().toISOString()
              }));

            if (memberships.length > 0) {
              await supabase.from('channel_memberships').insert(memberships);
            }
          }

        } catch (error) {
          console.error('Error sending Telegram notification:', error);
        }
      }

      console.log(`Payment ${merchantTradeNo} completed successfully`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in binance-pay-webhook:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});