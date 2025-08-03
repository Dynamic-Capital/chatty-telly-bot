import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseClient = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { persistSession: false } }
);

const logStep = (step: string, details?: any) => {
  console.log(`[PAYMENT-WEBHOOK] ${step}`, details ? JSON.stringify(details) : '');
};

// Helper to send Telegram message
async function sendTelegramMessage(chatId: string, text: string) {
  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
  if (!botToken) {
    logStep("TELEGRAM_BOT_TOKEN not set");
    return;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML'
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      logStep("Error sending Telegram message", error);
    }
  } catch (error) {
    logStep("Failed to send Telegram message", error);
  }
}

// Helper to grant VIP access
async function grantVipAccess(userId: string, planId: string, telegramChatId: string) {
  try {
    // Get plan details
    const { data: plan } = await supabaseClient
      .from('subscription_plans')
      .select('*')
      .eq('id', planId)
      .single();

    if (!plan) {
      throw new Error("Plan not found");
    }

    // Calculate expiry date
    let expiryDate = null;
    if (!plan.is_lifetime) {
      expiryDate = new Date();
      expiryDate.setMonth(expiryDate.getMonth() + plan.duration_months);
    }

    // Update user VIP status
    const { error: updateError } = await supabaseClient
      .from('bot_users')
      .update({
        is_vip: true,
        subscription_expires_at: expiryDate?.toISOString(),
        current_plan_id: planId,
      })
      .eq('id', userId);

    if (updateError) {
      throw updateError;
    }

    // Send success message to user
    const successMessage = `
🎉 <b>Payment Successful!</b>

✅ Your VIP access has been activated!

💎 Plan: ${plan.name}
⏰ ${plan.is_lifetime ? 'Lifetime Access' : `Valid until: ${expiryDate?.toLocaleDateString()}`}

🔗 <b>VIP Channel:</b> https://t.me/your_vip_channel

Welcome to the VIP club! 🚀`;

    await sendTelegramMessage(telegramChatId, successMessage);

    logStep("VIP access granted successfully", { userId, planId, telegramChatId });
  } catch (error) {
    logStep("Error granting VIP access", error);
    
    // Send error message to user
    const errorMessage = `
❌ <b>Payment Processing Error</b>

Your payment was received, but there was an issue activating your VIP access.

Please contact support with your payment details.
We'll resolve this quickly!`;

    await sendTelegramMessage(telegramChatId, errorMessage);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Webhook received");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    
    if (!stripeKey || !webhookSecret) {
      throw new Error("Stripe keys not configured");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      throw new Error("No Stripe signature found");
    }

    // Verify webhook signature
    let event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      logStep("Webhook signature verification failed", err);
      return new Response("Webhook signature verification failed", { status: 400 });
    }

    logStep("Event type", event.type);

    // Handle successful payment
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      logStep("Checkout session completed", { sessionId: session.id, metadata: session.metadata });

      const { payment_id, plan_id, telegram_chat_id } = session.metadata || {};

      if (!payment_id || !plan_id || !telegram_chat_id) {
        logStep("Missing metadata in session", session.metadata);
        return new Response("Missing metadata", { status: 400 });
      }

      // Update payment status
      const { data: payment, error: paymentError } = await supabaseClient
        .from('payments')
        .update({
          status: 'completed',
          webhook_data: {
            stripe_session_id: session.id,
            amount_total: session.amount_total,
            payment_status: session.payment_status,
          }
        })
        .eq('id', payment_id)
        .select('user_id')
        .single();

      if (paymentError || !payment) {
        logStep("Error updating payment", paymentError);
        return new Response("Payment not found", { status: 404 });
      }

      // Grant VIP access
      await grantVipAccess(payment.user_id, plan_id, telegram_chat_id);
    }

    // Handle failed payment
    if (event.type === 'checkout.session.expired' || 
        event.type === 'payment_intent.payment_failed') {
      const session = event.data.object as any;
      const { payment_id, telegram_chat_id } = session.metadata || {};

      if (payment_id) {
        // Update payment status
        await supabaseClient
          .from('payments')
          .update({ status: 'failed' })
          .eq('id', payment_id);
      }

      if (telegram_chat_id) {
        const failureMessage = `
❌ <b>Payment Failed</b>

Your payment could not be processed.

Please try again or contact support if the issue persists.

Use /plans to see available options.`;

        await sendTelegramMessage(telegram_chat_id, failureMessage);
      }
    }

    return new Response("OK", { headers: corsHeaders });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in payment webhook", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});