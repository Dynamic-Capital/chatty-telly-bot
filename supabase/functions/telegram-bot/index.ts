import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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

// Helper to log messages
const logMessage = (step: string, details?: any) => {
  console.log(`[TELEGRAM-BOT] ${step}`, details ? JSON.stringify(details) : '');
};

// Helper to get or create bot user
async function getOrCreateUser(telegramUser: any) {
  const { data: existingUser } = await supabaseClient
    .from('bot_users')
    .select('*')
    .eq('telegram_id', telegramUser.id.toString())
    .maybeSingle();

  if (existingUser) {
    return existingUser;
  }

  const { data: newUser, error } = await supabaseClient
    .from('bot_users')
    .insert({
      telegram_id: telegramUser.id.toString(),
      username: telegramUser.username,
      first_name: telegramUser.first_name,
      last_name: telegramUser.last_name,
    })
    .select()
    .single();

  if (error) {
    logMessage("Error creating user", error);
    throw error;
  }

  return newUser;
}

// Helper to send Telegram message
async function sendTelegramMessage(chatId: string, text: string, replyMarkup?: any) {
  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
  if (!botToken) {
    throw new Error('TELEGRAM_BOT_TOKEN not set');
  }

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      reply_markup: replyMarkup,
      parse_mode: 'HTML'
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    logMessage("Error sending message", error);
    throw new Error(`Failed to send message: ${error}`);
  }

  return await response.json();
}

// Helper to get subscription plans
async function getSubscriptionPlans() {
  const { data: plans, error } = await supabaseClient
    .from('subscription_plans')
    .select('*')
    .order('price', { ascending: true });

  if (error) {
    logMessage("Error fetching plans", error);
    throw error;
  }

  return plans;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const update = await req.json();
    logMessage("Received update", update);

    // Handle callback queries (button presses)
    if (update.callback_query) {
      const callbackQuery = update.callback_query;
      const chatId = callbackQuery.message.chat.id.toString();
      const data = callbackQuery.data;
      const user = await getOrCreateUser(callbackQuery.from);

      if (data.startsWith('plan_')) {
        const planId = data.replace('plan_', '');
        
        // Get plan details
        const { data: plan } = await supabaseClient
          .from('subscription_plans')
          .select('*')
          .eq('id', planId)
          .single();

        if (plan) {
          const planDetails = `
<b>${plan.name}</b>
💰 Price: $${plan.price}
⏰ Duration: ${plan.is_lifetime ? 'Lifetime' : `${plan.duration_months} month(s)`}
✨ Features:
${plan.features.map((f: string) => `• ${f}`).join('\n')}

Choose your payment method:`;

          const paymentKeyboard = {
            inline_keyboard: [
              [
                { text: "💳 Stripe", callback_data: `payment_stripe_${planId}` },
                { text: "🅿️ PayPal", callback_data: `payment_paypal_${planId}` }
              ],
              [
                { text: "🪙 Binance", callback_data: `payment_binance_${planId}` },
                { text: "🏦 Bank Transfer", callback_data: `payment_bank_${planId}` }
              ],
              [
                { text: "⬅️ Back to Plans", callback_data: "show_plans" }
              ]
            ]
          };

          await sendTelegramMessage(chatId, planDetails, paymentKeyboard);
        }
      } else if (data.startsWith('payment_')) {
        const [, method, planId] = data.split('_');
        
        // Create payment record
        const { data: payment, error } = await supabaseClient
          .from('payments')
          .insert({
            user_id: user.id,
            plan_id: planId,
            payment_method: method,
            status: 'pending'
          })
          .select()
          .single();

        if (error) {
          logMessage("Error creating payment", error);
          await sendTelegramMessage(chatId, "❌ Error creating payment. Please try again.");
          return new Response("OK");
        }

        // Get plan for amount
        const { data: plan } = await supabaseClient
          .from('subscription_plans')
          .select('*')
          .eq('id', planId)
          .single();

        if (method === 'stripe') {
          // Create Stripe checkout session
          const checkoutResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/create-checkout`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`
            },
            body: JSON.stringify({
              plan_id: planId,
              payment_id: payment.id,
              telegram_chat_id: chatId,
              amount: plan.price * 100, // Convert to cents
            })
          });

          if (checkoutResponse.ok) {
            const { url } = await checkoutResponse.json();
            await sendTelegramMessage(chatId, `💳 <b>Stripe Payment</b>\n\nClick the link below to complete your payment:\n\n🔗 <a href="${url}">Complete Payment</a>\n\n⏱️ Payment link expires in 30 minutes.`);
          } else {
            await sendTelegramMessage(chatId, "❌ Error creating Stripe checkout. Please try again.");
          }
        } else {
          // For other payment methods, show manual payment instructions
          const instructions = getPaymentInstructions(method, plan.price, payment.id);
          await sendTelegramMessage(chatId, instructions);
        }
      } else if (data === 'show_plans') {
        await showPlans(chatId);
      }

      // Answer callback query
      await fetch(`https://api.telegram.org/bot${Deno.env.get('TELEGRAM_BOT_TOKEN')}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: callbackQuery.id }),
      });
    }

    // Handle regular messages
    if (update.message) {
      const message = update.message;
      const chatId = message.chat.id.toString();
      const text = message.text;
      const user = await getOrCreateUser(message.from);

      if (text === '/start') {
        const welcomeMessage = `
🤖 <b>Welcome to VIP Trading Signals!</b>

👋 Hello ${user.first_name || 'there'}!

Get access to premium trading signals, market analysis, and exclusive VIP content.

Choose your subscription plan:`;

        await sendTelegramMessage(chatId, welcomeMessage);
        await showPlans(chatId);
      } else if (text === '/status') {
        await showUserStatus(chatId, user);
      } else if (text === '/plans') {
        await showPlans(chatId);
      } else {
        // Default response
        await sendTelegramMessage(chatId, "Use /start to begin or /plans to see subscription options.");
      }
    }

    return new Response("OK", { headers: corsHeaders });
  } catch (error) {
    logMessage("Error processing update", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function showPlans(chatId: string) {
  const plans = await getSubscriptionPlans();
  
  const planButtons = plans.map(plan => ([{
    text: `${plan.name} - $${plan.price}`,
    callback_data: `plan_${plan.id}`
  }]));

  const keyboard = { inline_keyboard: planButtons };

  const plansMessage = `
💎 <b>VIP Subscription Plans</b>

Choose the plan that works best for you:

🔹 <b>1 Month VIP</b> - $9.99
🔹 <b>3 Month VIP</b> - $24.99 (15% off)
🔹 <b>6 Month VIP</b> - $44.99 (25% off)
🔹 <b>Lifetime VIP</b> - $199.99 (Best Value!)

✨ All plans include:
• Priority trading signals
• VIP chat access
• Daily market analysis
• Expert support

Click a plan below for details:`;

  await sendTelegramMessage(chatId, plansMessage, keyboard);
}

async function showUserStatus(chatId: string, user: any) {
  const statusMessage = user.is_vip 
    ? `✅ <b>VIP Status: Active</b>\n\n👤 User: ${user.first_name}\n⏰ Expires: ${user.subscription_expires_at ? new Date(user.subscription_expires_at).toLocaleDateString() : 'Never'}\n💎 Plan: ${user.current_plan_id ? 'VIP Member' : 'Free'}`
    : `❌ <b>VIP Status: Inactive</b>\n\n👤 User: ${user.first_name}\n📝 Status: Free Member\n\n💡 Use /plans to upgrade to VIP!`;

  await sendTelegramMessage(chatId, statusMessage);
}

function getPaymentInstructions(method: string, amount: number, paymentId: string): string {
  switch (method) {
    case 'paypal':
      return `💰 <b>PayPal Payment</b>\n\nAmount: $${amount}\nPayment ID: ${paymentId}\n\n📧 Send payment to: payments@yourbot.com\n\n⚠️ Please include the Payment ID in the notes.\n\nOnce payment is confirmed, your VIP access will be activated automatically.`;
    
    case 'binance':
      return `🪙 <b>Binance Payment</b>\n\nAmount: $${amount} USDT\nPayment ID: ${paymentId}\n\n💳 Binance Pay ID: @yourbot\n🔗 Or scan QR code: [QR_CODE_PLACEHOLDER]\n\n⚠️ Please include the Payment ID in the memo.\n\nOnce payment is confirmed, your VIP access will be activated automatically.`;
    
    case 'bank':
      return `🏦 <b>Bank Transfer</b>\n\nAmount: $${amount}\nPayment ID: ${paymentId}\n\n🏛️ Bank Details:\nAccount: Your Bank Account\nRouting: 123456789\nSWIFT: ABCD1234\n\n⚠️ Please include the Payment ID in the transfer memo.\n\nProcessing time: 1-3 business days.`;
    
    default:
      return `Payment method ${method} instructions coming soon.`;
  }
}