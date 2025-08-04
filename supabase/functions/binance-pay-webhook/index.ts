import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const webhookData = await req.json();
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

          // Add user to VIP channel and group (implement later when chat IDs are available)
          console.log(`User ${payment.user_id} payment completed, should be added to VIP groups`);

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