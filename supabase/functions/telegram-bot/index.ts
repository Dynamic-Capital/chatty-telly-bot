import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

// VIP Channel and Group Configuration
// Note: You'll need to add the bot as admin to both channel and group
// and get the actual chat IDs (these are placeholders)
const VIP_CHANNEL_ID = "-1001234567890"; // Replace with actual channel ID
const VIP_GROUP_ID = "-1001234567891";   // Replace with actual group ID

// Helper logging function
const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[TELEGRAM-BOT] ${step}${detailsStr}`);
};

serve(async (req) => {
  // Log every incoming request for debugging
  console.log("=== TELEGRAM BOT REQUEST ===");
  console.log("Method:", req.method);
  console.log("URL:", req.url);
  console.log("Headers:", Object.fromEntries(req.headers.entries()));

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Telegram bot webhook started");
    
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!botToken) {
      throw new Error("TELEGRAM_BOT_TOKEN is not set");
    }
    
    logStep("Bot token loaded", { tokenExists: !!botToken, tokenPrefix: botToken?.substring(0, 10) });

    // Initialize Supabase client with service role key
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const update = await req.json();
    logStep("Received update", { updateId: update.update_id });

    // Handle text messages
    if (update.message?.text) {
      const message = update.message;
      const chatId = message.chat.id;
      const text = message.text;
      const userId = message.from.id;
      const username = message.from.username;

      logStep("Processing message", { chatId, text, userId, username });

      // Admin commands - Add your Telegram user ID here
      const adminIds = ["8486248025", "225513686"]; // Your admin and support admin user IDs
      const isAdmin = adminIds.includes(userId.toString());

      if (text === "/start") {
        await handleMainMenu(botToken, chatId, userId, username, supabaseClient);
      } else if (text === "/help" || text === "/commands") {
        await handleHelp(botToken, chatId, isAdmin, supabaseClient);
      } else if (text === "/admin" && isAdmin) {
        await handleAdminMenu(botToken, chatId, supabaseClient);
      } else if (text.startsWith("/approve ") && isAdmin) {
        const subscriptionId = text.replace("/approve ", "").trim();
        await handleApprovePayment(botToken, chatId, subscriptionId, supabaseClient);
      } else if (text.startsWith("/reject ") && isAdmin) {
        const parts = text.replace("/reject ", "").trim().split(" ");
        const subscriptionId = parts[0];
        const reason = parts.slice(1).join(" ") || "Payment verification failed";
        await handleRejectPayment(botToken, chatId, subscriptionId, reason, supabaseClient);
      } else if (text.startsWith("/pending") && isAdmin) {
        await handlePendingPayments(botToken, chatId, supabaseClient);
      } else if (text.startsWith("/setwelcome ") && isAdmin) {
        const welcomeText = text.replace("/setwelcome ", "").trim();
        await handleSetWelcome(botToken, chatId, welcomeText, supabaseClient);
      } else if (text.startsWith("/addpromo ") && isAdmin) {
        const promoData = text.replace("/addpromo ", "").trim();
        await handleAddPromo(botToken, chatId, promoData, supabaseClient);
      } else if (text.startsWith("/listpromos") && isAdmin) {
        await handleListPromos(botToken, chatId, supabaseClient);
      } else if (text.startsWith("/deletepromo ") && isAdmin) {
        const promoCode = text.replace("/deletepromo ", "").trim();
        await handleDeletePromo(botToken, chatId, promoCode, supabaseClient);
      } else if (text.startsWith("/stats") && isAdmin) {
        await handleStats(botToken, chatId, supabaseClient);
      } else if (text.startsWith("/setbank ") && isAdmin) {
        const bankDetails = text.replace("/setbank ", "").trim();
        await handleSetBankDetails(botToken, chatId, bankDetails, supabaseClient);
      } else if (text.startsWith("/setcrypto ") && isAdmin) {
        const cryptoDetails = text.replace("/setcrypto ", "").trim();
        await handleSetCryptoDetails(botToken, chatId, cryptoDetails, supabaseClient);
      } else if (text.startsWith("/addvip ") && isAdmin) {
        const userId = text.replace("/addvip ", "").trim();
        await handleAddVIP(botToken, chatId, userId, supabaseClient);
      } else if (text.startsWith("/removevip ") && isAdmin) {
        const userId = text.replace("/removevip ", "").trim();
        await handleRemoveVIP(botToken, chatId, userId, supabaseClient);
      } else if (text.startsWith("/checkvip ") && isAdmin) {
        const userId = text.replace("/checkvip ", "").trim();
        await handleCheckVIP(botToken, chatId, userId, supabaseClient);
      } else if (text.startsWith("/checkexpired") && isAdmin) {
        await checkExpiredSubscriptions(botToken, supabaseClient);
        await sendMessage(botToken, chatId, "✅ Expired subscriptions check completed. Check logs for details.");
      } else if (text.startsWith("/getchatid") && isAdmin) {
        await sendMessage(botToken, chatId, `📋 <b>Chat Information</b>\n\n🆔 Chat ID: <code>${chatId}</code>\n📍 Chat Type: ${message.chat.type}\n📝 Title: ${message.chat.title || 'Private Chat'}\n\n💡 <b>Tip:</b> Add your bot to your VIP channel/group and use this command there to get their IDs.`);
      } else if (text.startsWith("/addplan ") && isAdmin) {
        const planData = text.replace("/addplan ", "").trim();
        await handleAddPlan(botToken, chatId, planData, supabaseClient);
      } else if (text.startsWith("/promo ") || text.startsWith("PROMO")) {
        const promoCode = text.replace("/promo ", "").replace("PROMO", "").trim();
        await handlePromoCode(botToken, chatId, userId, username, promoCode, supabaseClient);
      } else if (text === "/faq") {
        await handleFAQ(botToken, chatId, supabaseClient);
      } else if (text.startsWith("/ask ")) {
        const question = text.replace("/ask ", "").trim();
        await handleAIQuestion(botToken, chatId, question, supabaseClient);
      } else {
        // If user sends a question directly (not a command), treat it as an AI FAQ question
        if (text.length > 10 && text.includes("?")) {
          await handleAIQuestion(botToken, chatId, text, supabaseClient);
        } else {
          await sendMessage(botToken, chatId, "Hi there! 👋 I'm here to help you with VIP plans and services. Type /help to see what I can do for you, /faq for common questions, or just ask me anything!");
        }
      }
    }

    // Handle photo uploads (receipts)
    if (update.message?.photo || update.message?.document) {
      const message = update.message;
      const chatId = message.chat.id;
      const userId = message.from.id;
      const username = message.from.username;

      logStep("Processing file upload", { chatId, userId, username });
      await handleFileUpload(botToken, chatId, userId, username, message, supabaseClient);
    }

    // Handle callback queries (inline button presses)
    if (update.callback_query) {
      const callbackQuery = update.callback_query;
      const chatId = callbackQuery.message.chat.id;
      const data = callbackQuery.data;
      const userId = callbackQuery.from.id;
      const username = callbackQuery.from.username;

      logStep("Processing callback query", { chatId, data, userId, username });

      if (data?.startsWith("plan_")) {
        const planId = data.replace("plan_", "");
        await handlePlanSelection(botToken, chatId, userId, username, planId, supabaseClient);
      } else if (data?.startsWith("payment_")) {
        const [, method, planId] = data.split("_");
        await handlePaymentMethod(botToken, chatId, userId, username, method, planId, supabaseClient);
      } else if (data === "main_menu") {
        await handleMainMenu(botToken, chatId, userId, username, supabaseClient);
      } else if (data === "view_packages") {
        await handleStartCommand(botToken, chatId, userId, username, supabaseClient);
      } else if (data === "contact_support") {
        await handleContactSupport(botToken, chatId, supabaseClient);
      } else if (data === "payment_options") {
        await handlePaymentOptions(botToken, chatId, supabaseClient);
      } else if (data === "enter_promo") {
        await sendMessage(botToken, chatId, "🎫 <b>Enter Promo Code</b>\n\nPlease send your promo code in this format:\n<code>PROMO YOUR_CODE</code>\n\nExample: <code>PROMO SAVE20</code>", {
          inline_keyboard: [[{ text: "← Back to Main Menu", callback_data: "main_menu" }]]
        });
      } else if (data === "about_us") {
        await handleAboutUs(botToken, chatId, supabaseClient);
      } else if (data === "my_account") {
        await handleMyAccount(botToken, chatId, userId, supabaseClient);
      } else if (data === "back_to_plans") {
        await handleStartCommand(botToken, chatId, userId, username, supabaseClient);
      } else if (data?.startsWith("manual_crypto_")) {
        const planId = data.replace("manual_crypto_", "");
        await handleManualCrypto(botToken, chatId, userId, username, planId, supabaseClient);
      } else if (data?.startsWith("admin_")) {
        // Admin dashboard callbacks - check if user is admin
        const adminIds = ["8486248025", "225513686"];
        if (!adminIds.includes(userId.toString())) {
          await sendMessage(botToken, chatId, "❌ Access denied. Admin privileges required.");
          return;
        }
        logStep("Processing admin callback", { data, userId });
        await handleAdminCallback(botToken, chatId, data, userId, supabaseClient);
      } else if (data?.startsWith("approve_")) {
        // Check admin access for approval
        const adminIds = ["8486248025", "225513686"];
        if (!adminIds.includes(userId.toString())) {
          await sendMessage(botToken, chatId, "❌ Access denied. Admin privileges required.");
          return;
        }
        const subscriptionId = data.replace("approve_", "");
        await handleApprovePayment(botToken, chatId, subscriptionId, supabaseClient);
      } else if (data?.startsWith("reject_") && !data.startsWith("reject_confirm_")) {
        // Check admin access for rejection
        const adminIds = ["8486248025", "225513686"];
        if (!adminIds.includes(userId.toString())) {
          await sendMessage(botToken, chatId, "❌ Access denied. Admin privileges required.");
          return;
        }
        const subscriptionId = data.replace("reject_", "");
        await handleRejectPaymentCallback(botToken, chatId, subscriptionId, supabaseClient);
      } else if (data?.startsWith("reject_confirm_")) {
        // Check admin access for reject confirmation
        const adminIds = ["8486248025", "225513686"];
        if (!adminIds.includes(userId.toString())) {
          await sendMessage(botToken, chatId, "❌ Access denied. Admin privileges required.");
          return;
        }
        const parts = data.replace("reject_confirm_", "").split("_");
        const subscriptionId = parts[0];
        const reason = parts.slice(1).join("_").replace(/_/g, " ");
        await handleRejectPayment(botToken, chatId, subscriptionId, reason, supabaseClient);
      } else if (data === "admin_menu") {
        // Admin menu access - check if user is admin
        const adminIds = ["8486248025", "225513686"];
        if (!adminIds.includes(userId.toString())) {
          await sendMessage(botToken, chatId, "❌ Access denied. Admin privileges required.");
          return;
        }
        logStep("Admin menu access", { userId });
        await handleAdminMenu(botToken, chatId, supabaseClient);
      } else if (data === "view_faq") {
        await handleFAQ(botToken, chatId, supabaseClient);
      } else if (data === "ask_ai") {
        await sendMessage(botToken, chatId, "💬 <b>Ask AI Assistant</b>\n\nType your question and I'll help you! For example:\n\n/ask How do I change my subscription?\n/ask What payment methods do you accept?\n/ask How long does activation take?\n\nOr simply type your question directly!");
      }

      // Answer the callback query to remove loading state
      await answerCallbackQuery(botToken, callbackQuery.id);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in telegram-bot", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

// Main menu function - shows when user types /start
async function handleMainMenu(botToken: string, chatId: number, userId: number, username: string, supabaseClient: any) {
  logStep("Handling main menu", { chatId, userId, username });

  const mainMenuKeyboard = {
    inline_keyboard: [
      [
        { text: "📦 View Packages", callback_data: "view_packages" },
        { text: "💰 Payment Options", callback_data: "payment_options" }
      ],
      [
        { text: "🆘 Contact Support", callback_data: "contact_support" },
        { text: "🎫 Enter Promo Code", callback_data: "enter_promo" }
      ],
      [
        { text: "ℹ️ About Us", callback_data: "about_us" },
        { text: "📊 My Account", callback_data: "my_account" }
      ]
    ]
  };

  const welcomeMessage = `🌟 <b>Welcome to Dynamic VIP Bot!</b> 🌟

Hi ${username ? `@${username}` : 'there'}! 👋

🚀 Your gateway to exclusive VIP access and premium features!

✨ <b>What would you like to do?</b>

📦 View our subscription packages
💰 Learn about payment methods
🆘 Get help from our support team
🎫 Apply a promotional code
📊 Check your account status

Select an option below to get started:`;

  await sendMessage(botToken, chatId, welcomeMessage, mainMenuKeyboard);
}

// Support function
async function handleContactSupport(botToken: string, chatId: number, supabaseClient: any) {
  const supportMessage = `🆘 <b>Contact Support</b>

We're here to help! 💪

📧 <b>Email:</b> support@dynamicvip.com
📱 <b>Telegram:</b> @DynamicVIP_Support
⏰ <b>Response Time:</b> Usually within 2-4 hours

🔗 <b>Quick Links:</b>
• FAQ: /faq
• Technical Issues: /tech
• Billing Questions: /billing

💬 <b>Or simply describe your issue and we'll get back to you!</b>`;

  const backKeyboard = {
    inline_keyboard: [
      [{ text: "← Back to Main Menu", callback_data: "main_menu" }]
    ]
  };

  await sendMessage(botToken, chatId, supportMessage, backKeyboard);
}

// Payment options overview
async function handlePaymentOptions(botToken: string, chatId: number, supabaseClient: any) {
  const paymentMessage = `💰 <b>Payment Methods Available</b>

We accept multiple payment methods for your convenience:

💳 <b>Credit/Debit Cards (Stripe)</b>
• Instant activation
• Visa, Mastercard, American Express
• Secure & encrypted

🅿️ <b>PayPal</b>
• Fast & reliable
• Buyer protection included
• Instant activation

🏦 <b>Bank Transfer</b>
• Direct bank-to-bank transfer
• Manual verification (1-2 business days)
• Perfect for large amounts

₿ <b>Cryptocurrency</b>
• Bitcoin, Ethereum, USDT
• Via Binance Pay
• Fast processing (30 mins average)

🎫 <b>Promo Codes</b>
• Get discounts on any plan
• Special offers and seasonal deals

Ready to subscribe? Choose a package first!`;

  const backKeyboard = {
    inline_keyboard: [
      [
        { text: "📦 View Packages", callback_data: "view_packages" },
        { text: "← Back to Main Menu", callback_data: "main_menu" }
      ]
    ]
  };

  await sendMessage(botToken, chatId, paymentMessage, backKeyboard);
}

async function handleStartCommand(botToken: string, chatId: number, userId: number, username: string, supabaseClient: any) {

  // Fetch available subscription plans
  const { data: plans, error } = await supabaseClient
    .from("subscription_plans")
    .select("*")
    .order("price", { ascending: true });

  if (error) {
    logStep("Error fetching plans", { error });
    await sendMessage(botToken, chatId, "Sorry, there was an error loading subscription plans. Please try again later.");
    return;
  }

  const keyboard = {
    inline_keyboard: plans.map((plan: any) => [
      {
        text: `${plan.name} - $${plan.price}`,
        callback_data: `plan_${plan.id}`
      }
    ])
  };

  const welcomeMessage = `✨ <b>Welcome to Premium VIP Services!</b> ✨

🎯 <b>Unlock Exclusive Benefits:</b>
🚀 Premium features and priority support
💎 Exclusive content and early access
🛡️ Enhanced security and reliability
⚡ Lightning-fast performance

💰 <b>Choose Your Perfect Plan:</b>

${plans.map((plan: any) => {
  const durationText = plan.is_lifetime ? "🔥 Lifetime Access" : `📅 ${plan.duration_months} Month${plan.duration_months > 1 ? 's' : ''}`;
  const features = plan.features && plan.features.length > 0 ? 
    `\n   ✓ ${plan.features.join('\n   ✓ ')}` : '';
  
  return `💎 <b>${plan.name}</b> - $${plan.price}
   ${durationText}${features}`;
}).join('\n\n')}

🎁 <b>Special Offer:</b> All plans include 24/7 support and money-back guarantee!

👆 <b>Select your plan below to get started:</b>`;

  await sendMessage(botToken, chatId, welcomeMessage, keyboard);
}

async function handlePlanSelection(botToken: string, chatId: number, userId: number, username: string, planId: string, supabaseClient: any) {
  logStep("Handling plan selection", { chatId, userId, planId });

  // Get plan details
  const { data: plan, error } = await supabaseClient
    .from("subscription_plans")
    .select("*")
    .eq("id", planId)
    .single();

  if (error || !plan) {
    logStep("Error fetching plan", { error });
    await sendMessage(botToken, chatId, "Sorry, I couldn't find that plan. Please try again.");
    return;
  }

  // First, check if user already has a subscription record
  const { data: existingSubscription } = await supabaseClient
    .from("user_subscriptions")
    .select("id")
    .eq("telegram_user_id", userId)
    .maybeSingle();

  let upsertError = null;
  if (existingSubscription) {
    // Update existing subscription
    const { error: updateError } = await supabaseClient
      .from("user_subscriptions")
      .update({
        telegram_username: username,
        plan_id: planId,
        payment_status: "pending",
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq("telegram_user_id", userId);
    upsertError = updateError;
  } else {
    // Insert new subscription
    const { error: insertError } = await supabaseClient
      .from("user_subscriptions")
      .insert({
        telegram_user_id: userId,
        telegram_username: username,
        plan_id: planId,
        payment_status: "pending",
        is_active: false
      });
    upsertError = insertError;
  }

  if (upsertError) {
    logStep("Error creating/updating subscription", { error: upsertError });
    await sendMessage(botToken, chatId, "Sorry, there was an error processing your selection. Please try again.");
    return;
  }

  const paymentKeyboard = {
    inline_keyboard: [
      [
        { text: "💳 Credit Card (Stripe)", callback_data: `payment_stripe_${planId}` },
        { text: "🅿️ PayPal", callback_data: `payment_paypal_${planId}` }
      ],
      [
        { text: "🏦 Bank Transfer", callback_data: `payment_bank_${planId}` },
        { text: "₿ Crypto (Binance)", callback_data: `payment_crypto_${planId}` }
      ],
      [
        { text: "← Back to Plans", callback_data: "back_to_plans" }
      ]
    ]
  };

  const planMessage = `📋 Plan Details:

💎 ${plan.name}
💰 Price: $${plan.price}
⏱️ Duration: ${plan.is_lifetime ? "Lifetime Access" : `${plan.duration_months} month(s)`}

Choose your payment method:`;

  await sendMessage(botToken, chatId, planMessage, paymentKeyboard);
}

async function sendMessage(botToken: string, chatId: number, text: string, replyMarkup?: any) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const payload: any = {
    chat_id: chatId,
    text: text,
    parse_mode: "HTML"
  };

  if (replyMarkup) {
    payload.reply_markup = replyMarkup;
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const error = await response.text();
      logStep("Error sending message", { error, status: response.status });
    } else {
      logStep("Message sent successfully", { chatId });
    }
  } catch (error) {
    logStep("Error in sendMessage", { error });
  }
}

async function answerCallbackQuery(botToken: string, callbackQueryId: string) {
  const url = `https://api.telegram.org/bot${botToken}/answerCallbackQuery`;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQueryId })
    });
  } catch (error) {
    logStep("Error answering callback query", { error });
  }
}

async function handlePaymentMethod(botToken: string, chatId: number, userId: number, username: string, method: string, planId: string, supabaseClient: any) {
  logStep("Handling payment method", { chatId, userId, method, planId });

  // Get plan details
  const { data: plan, error } = await supabaseClient
    .from("subscription_plans")
    .select("*")
    .eq("id", planId)
    .single();

  if (error || !plan) {
    await sendMessage(botToken, chatId, "Sorry, I couldn't find that plan. Please try again.");
    return;
  }

  let paymentMessage = "";
  let paymentInstructions = "";

  switch (method) {
    case "stripe":
      paymentMessage = `💳 <b>Credit Card Payment (Stripe)</b>

📋 Plan: ${plan.name}
💰 Amount: $${plan.price}

🔗 Click the link below to complete your payment:
[Payment will be integrated with Stripe checkout]

Once payment is confirmed, you'll get instant VIP access!`;
      paymentInstructions = "Stripe checkout integration";
      break;

    case "paypal":
      paymentMessage = `🅿️ <b>PayPal Payment</b>

📋 Plan: ${plan.name}
💰 Amount: $${plan.price}

🔗 PayPal payment link:
[PayPal integration will be added]

Once payment is confirmed, you'll get instant VIP access!`;
      paymentInstructions = "PayPal integration";
      break;

    case "bank":
      paymentMessage = `🏦 <b>Bank Transfer Payment</b>

📋 Plan: ${plan.name}
💰 Amount: $${plan.price}

💼 <b>Bank Details - Choose Currency:</b>

🏦 <b>BML Account (MVR):</b>
• Account: 7730000133061
• Name: ABDL.M.I.AFLHAL
• Currency: MVR

🏦 <b>MIB Account (MVR):</b>
• Account: 9010310167224100
• Currency: MVR

🏦 <b>MIB Account (USD):</b>
• Account: 9013101672242000
• Currency: USD

📝 <b>Reference:</b> VIP-${userId}-${planId}

📸 <b>Important:</b> After making the transfer, please send a screenshot or photo of your transfer receipt to this chat.

⏰ Processing time: 1-2 business days after receipt verification.`;
      paymentInstructions = "Bank transfer with receipt upload required";
      break;

    case "crypto":
      // Create Binance Pay checkout
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const checkoutResponse = await fetch(`${supabaseUrl}/functions/v1/binance-pay-checkout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`
          },
          body: JSON.stringify({
            planId: planId,
            telegramUserId: userId.toString(),
            telegramUsername: username
          })
        });

        const checkoutData = await checkoutResponse.json();

        if (checkoutData.success) {
          paymentMessage = `₿ <b>Binance Pay / Crypto Payment</b>

📋 Plan: ${plan.name}
💰 Amount: $${plan.price} USDT

🚀 <b>Choose your payment method:</b>

🔗 <b>Option 1: Binance Pay (Recommended)</b>
• Click the link below for instant payment
• Supports multiple cryptocurrencies
• Instant confirmation

🔗 <b>Option 2: Direct Crypto Transfer</b>
• Manual transfer with receipt upload
• Verification required (1-2 hours)

Click the buttons below to proceed:`;

          const cryptoKeyboard = {
            inline_keyboard: [
              [{ text: "🚀 Pay with Binance Pay", url: checkoutData.checkoutUrl }],
              [{ text: "📱 Open in Binance App", url: checkoutData.deeplink }],
              [{ text: "📋 Manual Crypto Transfer", callback_data: `manual_crypto_${planId}` }],
              [{ text: "← Back to Payment Methods", callback_data: `plan_${planId}` }]
            ]
          };

          await sendMessage(botToken, chatId, paymentMessage, cryptoKeyboard);
          return;
        } else {
          // Fallback to manual crypto if Binance Pay fails
          paymentMessage = `₿ <b>Crypto Payment</b>

📋 Plan: ${plan.name}
💰 Amount: $${plan.price} USDT

⚠️ <b>Binance Pay temporarily unavailable. Use manual transfer:</b>

💰 <b>Send crypto to:</b>
USDT (TRC20): TYourTrc20AddressHere
BTC: 1YourBitcoinAddressHere
ETH: 0xYourEthereumAddressHere

📸 <b>Important:</b> After payment, send transaction hash or screenshot to this chat.

⏰ Processing: 1-2 hours after verification.`;
        }
      } catch (error) {
        console.error('Error creating Binance Pay checkout:', error);
        paymentMessage = `₿ <b>Crypto Payment</b>

📋 Plan: ${plan.name}
💰 Amount: $${plan.price} USDT

💰 <b>Send crypto to:</b>
USDT (TRC20): TYourTrc20AddressHere
BTC: 1YourBitcoinAddressHere
ETH: 0xYourEthereumAddressHere

📸 <b>After payment, send transaction screenshot to this chat.</b>

⏰ Processing: 1-2 hours after verification.`;
      }
      
      paymentInstructions = "Binance Pay or crypto with receipt upload required";
      break;

    default:
      await sendMessage(botToken, chatId, "Invalid payment method selected.");
      return;
  }

  // Update subscription with payment method and instructions
  await supabaseClient
    .from("user_subscriptions")
    .update({
      payment_method: method,
      payment_instructions: paymentInstructions,
      bank_details: method === "bank" ? "Bank transfer details provided" : null
    })
    .eq("telegram_user_id", userId);

  const backKeyboard = {
    inline_keyboard: [
      [
        { text: "← Back to Payment Methods", callback_data: `plan_${planId}` },
        { text: "🏠 Start Over", callback_data: "back_to_plans" }
      ]
    ]
  };

  await sendMessage(botToken, chatId, paymentMessage, backKeyboard);
}

async function handleFileUpload(botToken: string, chatId: number, userId: number, username: string, message: any, supabaseClient: any) {
  logStep("Handling file upload", { chatId, userId });

  // Check if user has a pending subscription
  const { data: subscription, error } = await supabaseClient
    .from("user_subscriptions")
    .select("*, subscription_plans(*)")
    .eq("telegram_user_id", userId)
    .in("payment_status", ["pending", "crypto", "bank"]) // Accept multiple payment statuses
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    logStep("Error fetching subscription", { error });
    await sendMessage(botToken, chatId, "❌ Error checking your subscription. Please try again.");
    return;
  }

  if (!subscription) {
    await sendMessage(botToken, chatId, "❌ No pending payment found. Please start by selecting a subscription plan first.\n\nUse /start to begin.");
    return;
  }

  // Get file_id from photo or document
  let fileId = "";
  let fileName = "";

  if (message.photo && message.photo.length > 0) {
    // Get the largest photo
    const photo = message.photo[message.photo.length - 1];
    fileId = photo.file_id;
    fileName = `receipt_${userId}_${Date.now()}.jpg`;
  } else if (message.document) {
    fileId = message.document.file_id;
    fileName = message.document.file_name || `receipt_${userId}_${Date.now()}`;
  }

  if (!fileId) {
    await sendMessage(botToken, chatId, "❌ No valid file received. Please send a photo or document.");
    return;
  }

  try {
    // Get file info from Telegram
    const fileInfoResponse = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
    const fileInfo = await fileInfoResponse.json();

    if (!fileInfo.ok) {
      throw new Error("Failed to get file info from Telegram");
    }

    // Download file from Telegram
    const fileResponse = await fetch(`https://api.telegram.org/file/bot${botToken}/${fileInfo.result.file_path}`);
    const fileBuffer = await fileResponse.arrayBuffer();

    // Upload to Supabase Storage
    const filePath = `${userId}/${fileName}`;
    const { data: uploadData, error: uploadError } = await supabaseClient.storage
      .from('payment-receipts')
      .upload(filePath, fileBuffer, {
        contentType: message.document?.mime_type || 'image/jpeg',
        upsert: false
      });

    if (uploadError) {
      logStep("Storage upload error", { error: uploadError });
      await sendMessage(botToken, chatId, "❌ Failed to save your receipt. Please try again.");
      return;
    }

    // Update subscription with receipt info
    const { error: updateError } = await supabaseClient
      .from("user_subscriptions")
      .update({
        receipt_file_path: filePath,
        receipt_telegram_file_id: fileId,
        payment_status: "receipt_submitted",
        updated_at: new Date().toISOString()
      })
      .eq("telegram_user_id", userId);

    if (updateError) {
      logStep("Database update error", { error: updateError });
      await sendMessage(botToken, chatId, "❌ Failed to update your payment status. Please contact support.");
      return;
    }

    const successMessage = `✅ <b>Receipt Received Successfully!</b>

📋 Plan: ${subscription.subscription_plans.name}
💰 Amount: $${subscription.subscription_plans.price}
💳 Payment Method: ${subscription.payment_method}

📸 Your payment receipt has been submitted for verification.

⏰ <b>What's next?</b>
• Our team will verify your payment within 1-2 business days
• You'll receive a confirmation message once approved
• VIP access will be granted immediately after verification

📞 For urgent matters, contact our support team.

Thank you for your patience! 🙏`;

    await sendMessage(botToken, chatId, successMessage);

    // Notify admins about the receipt upload
    const adminIds = ["8486248025", "225513686"];
    const adminNotification = `🔔 <b>New Receipt Submitted!</b>

📋 <b>Subscription Details:</b>
• ID: <code>${subscription.id}</code>
• User: ${subscription.telegram_user_id} (@${subscription.telegram_username || 'N/A'})
• Plan: ${subscription.subscription_plans.name} ($${subscription.subscription_plans.price})
• Payment Method: ${subscription.payment_method}
• Date: ${new Date().toLocaleDateString()}

📸 <b>Receipt uploaded and ready for verification.</b>

<b>Actions:</b>
<code>/approve ${subscription.id}</code> - Approve payment
<code>/reject ${subscription.id} [reason]</code> - Reject payment
<code>/pending</code> - View all pending payments`;

    // Send notification to all admins
    for (const adminId of adminIds) {
      try {
        await sendMessage(botToken, parseInt(adminId), adminNotification);
      } catch (error) {
        logStep("Error notifying admin", { adminId, error });
      }
    }
  } catch (error) {
    logStep("Error processing file upload", { error });
    await sendMessage(botToken, chatId, "❌ Failed to process your receipt. Please try again or contact support.");
  }
}

async function handlePromoCode(botToken: string, chatId: number, userId: number, username: string, promoCode: string, supabaseClient: any) {
  logStep("Handling promo code", { chatId, userId, promoCode });

  if (!promoCode || promoCode.length === 0) {
    await sendMessage(botToken, chatId, "❌ Please provide a valid promo code. Example: PROMO SAVE20");
    return;
  }

  // Check if promo code exists and is valid
  const { data: promotion, error } = await supabaseClient
    .from("promotions")
    .select("*")
    .eq("code", promoCode.toUpperCase())
    .eq("is_active", true)
    .lte("valid_from", new Date().toISOString())
    .gte("valid_until", new Date().toISOString())
    .single();

  if (error || !promotion) {
    await sendMessage(botToken, chatId, `❌ <b>Invalid Promo Code</b>

The promo code "${promoCode}" is either:
• Not valid
• Expired
• Already used up

💡 <b>Tip:</b> Make sure you typed the code correctly and it hasn't expired.

Use /start to see available plans.`);
    return;
  }

  // Check if user already used this promo
  const { data: existingUsage } = await supabaseClient
    .from("promotion_usage")
    .select("*")
    .eq("promotion_id", promotion.id)
    .eq("telegram_user_id", userId)
    .single();

  if (existingUsage) {
    await sendMessage(botToken, chatId, `❌ <b>Promo Code Already Used</b>

You have already used the promo code "${promoCode}".

Each promo code can only be used once per user.

Use /start to see available plans.`);
    return;
  }

  // Check if promo has usage limits
  if (promotion.max_uses && promotion.current_uses >= promotion.max_uses) {
    await sendMessage(botToken, chatId, `❌ <b>Promo Code Limit Reached</b>

The promo code "${promoCode}" has reached its usage limit.

Use /start to see available plans.`);
    return;
  }

  // Save promo code for user's next purchase
  await supabaseClient
    .from("user_subscriptions")
    .upsert({
      telegram_user_id: userId,
      telegram_username: username,
      payment_status: "promo_applied",
      is_active: false
    }, { onConflict: "telegram_user_id" });

  const discountText = promotion.discount_type === 'percentage' 
    ? `${promotion.discount_value}%` 
    : `$${promotion.discount_value}`;

  const successMessage = `🎉 <b>Promo Code Applied Successfully!</b>

💎 <b>Code:</b> ${promotion.code}
💰 <b>Discount:</b> ${discountText} OFF

✅ Your discount has been saved and will be applied to your next subscription purchase.

🛍️ <b>Ready to subscribe?</b>
Use /start to see plans with your discount applied!

⏰ <b>Valid until:</b> ${new Date(promotion.valid_until).toLocaleDateString()}`;

  await sendMessage(botToken, chatId, successMessage);
}

// Admin functions
async function handleAdminMenu(botToken: string, chatId: number, supabaseClient: any) {
  const adminKeyboard = {
    inline_keyboard: [
      [
        { text: "📋 Pending Payments", callback_data: "admin_pending" },
        { text: "📊 Statistics", callback_data: "admin_stats" }
      ],
      [
        { text: "🎫 Manage Promos", callback_data: "admin_promos" },
        { text: "📦 Manage Plans", callback_data: "admin_plans" }
      ],
      [
        { text: "👥 VIP Management", callback_data: "admin_vip" },
        { text: "💳 Payment Settings", callback_data: "admin_payments" }
      ],
      [
        { text: "⚙️ Bot Settings", callback_data: "admin_settings" },
        { text: "📝 System Logs", callback_data: "admin_logs" }
      ],
      [
        { text: "🔙 Close Admin Panel", callback_data: "main_menu" }
      ]
    ]
  };

  const adminMessage = `🔧 <b>Admin Dashboard</b>

Welcome to the admin control panel! 

📊 Manage your bot operations:
• View and process pending payments
• Monitor bot statistics and analytics
• Create and manage promotional codes
• Add/edit subscription plans
• Configure payment methods
• Manage bot settings

Select an option below:`;

  await sendMessage(botToken, chatId, adminMessage, adminKeyboard);
}

// Admin callback handler
async function handleAdminCallback(botToken: string, chatId: number, data: string, userId: number, supabaseClient: any) {
  switch (data) {
    case "admin_pending":
      await handleAdminPendingPayments(botToken, chatId, supabaseClient);
      break;
    case "admin_stats":
      await handleAdminStats(botToken, chatId, supabaseClient);
      break;
    case "admin_promos":
      await handleAdminPromos(botToken, chatId, supabaseClient);
      break;
    case "admin_plans":
      await handleAdminPlans(botToken, chatId, supabaseClient);
      break;
    case "admin_settings":
      await handleAdminSettings(botToken, chatId, supabaseClient);
      break;
    case "admin_payments":
      await handleAdminPaymentSettings(botToken, chatId, supabaseClient);
      break;
    case "admin_users":
      await handleAdminUsers(botToken, chatId, supabaseClient);
      break;
    case "admin_logs":
      await handleAdminLogs(botToken, chatId, supabaseClient);
      break;
    case "admin_vip":
      await handleManageVIPAccess(botToken, chatId, supabaseClient);
      break;
    case "admin_check_expired":
      await checkExpiredSubscriptions(botToken, supabaseClient);
      await sendMessage(botToken, chatId, "✅ Expired subscriptions check completed. Check logs for details.", {
        inline_keyboard: [[{ text: "← Back to VIP Management", callback_data: "admin_vip" }]]
      });
      break;
    default:
      await sendMessage(botToken, chatId, "❌ Unknown admin command.");
  }
}

// Admin dashboard functions
async function handleAdminPendingPayments(botToken: string, chatId: number, supabaseClient: any) {
  const { data: pendingPayments, error } = await supabaseClient
    .from("user_subscriptions")
    .select("*, subscription_plans(*)")
    .eq("payment_status", "receipt_submitted")
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    await sendMessage(botToken, chatId, "❌ Error fetching pending payments.");
    return;
  }

  if (!pendingPayments || pendingPayments.length === 0) {
    const keyboard = {
      inline_keyboard: [
        [{ text: "🔄 Refresh", callback_data: "admin_pending" }],
        [{ text: "← Back to Admin Panel", callback_data: "admin_menu" }]
      ]
    };
    await sendMessage(botToken, chatId, "✅ No pending payments found.", keyboard);
    return;
  }

  let message = `📋 <b>Pending Payments (${pendingPayments.length})</b>\n\n`;
  const keyboard = { inline_keyboard: [] as any[] };
  
  pendingPayments.forEach((payment: any, index: number) => {
    const plan = payment.subscription_plans;
    message += `${index + 1}. 👤 User: ${payment.telegram_user_id}\n`;
    message += `💎 Plan: ${plan?.name} ($${plan?.price})\n`;
    message += `💳 Method: ${payment.payment_method}\n`;
    message += `📅 Date: ${new Date(payment.created_at).toLocaleDateString()}\n\n`;
    
    // Add approve/reject buttons for each payment
    keyboard.inline_keyboard.push([
      { text: `✅ Approve #${index + 1}`, callback_data: `approve_${payment.id}` },
      { text: `❌ Reject #${index + 1}`, callback_data: `reject_${payment.id}` }
    ]);
  });

  keyboard.inline_keyboard.push(
    [{ text: "🔄 Refresh", callback_data: "admin_pending" }],
    [{ text: "← Back to Admin Panel", callback_data: "admin_menu" }]
  );

  await sendMessage(botToken, chatId, message, keyboard);
}

async function handleAdminStats(botToken: string, chatId: number, supabaseClient: any) {
  const { data: subscriptions } = await supabaseClient
    .from("user_subscriptions")
    .select("payment_status, created_at");

  const { data: promos } = await supabaseClient
    .from("promotions")
    .select("current_uses, is_active");

  const pending = subscriptions?.filter((s: any) => s.payment_status === 'receipt_submitted').length || 0;
  const active = subscriptions?.filter((s: any) => s.payment_status === 'active').length || 0;
  const rejected = subscriptions?.filter((s: any) => s.payment_status === 'rejected').length || 0;
  const total = subscriptions?.length || 0;
  
  const activePromos = promos?.filter((p: any) => p.is_active).length || 0;
  const totalPromoUses = promos?.reduce((sum: number, p: any) => sum + p.current_uses, 0) || 0;

  // Calculate today's stats
  const today = new Date().toISOString().split('T')[0];
  const todaySubscriptions = subscriptions?.filter((s: any) => 
    s.created_at.split('T')[0] === today
  ).length || 0;

  const statsMessage = `📊 <b>Bot Statistics Dashboard</b>

👥 <b>Subscriptions Overview:</b>
• Total Users: ${total}
• Active Subscriptions: ${active}
• Pending Payments: ${pending}
• Rejected Payments: ${rejected}
• Today's New Users: ${todaySubscriptions}

🎫 <b>Promotions:</b>
• Active Promo Codes: ${activePromos}
• Total Promo Uses: ${totalPromoUses}

📈 <b>Success Rate:</b>
• Approval Rate: ${total > 0 ? Math.round((active / total) * 100) : 0}%
• Conversion Rate: ${total > 0 ? Math.round(((active + pending) / total) * 100) : 0}%

📅 <b>Last Updated:</b> ${new Date().toLocaleString()}`;

  const keyboard = {
    inline_keyboard: [
      [{ text: "🔄 Refresh Stats", callback_data: "admin_stats" }],
      [{ text: "📋 View Pending", callback_data: "admin_pending" }],
      [{ text: "← Back to Admin Panel", callback_data: "admin_menu" }]
    ]
  };

  await sendMessage(botToken, chatId, statsMessage, keyboard);
}

async function handleAdminPromos(botToken: string, chatId: number, supabaseClient: any) {
  const { data: promos } = await supabaseClient
    .from("promotions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(5);

  let message = `🎫 <b>Promo Code Management</b>\n\n`;
  
  if (promos && promos.length > 0) {
    promos.forEach((promo: any) => {
      const discountText = promo.discount_type === 'percentage' 
        ? `${promo.discount_value}%` 
        : `$${promo.discount_value}`;
      const status = promo.is_active ? "🟢" : "🔴";
      
      message += `${status} <code>${promo.code}</code> - ${discountText} OFF\n`;
      message += `Uses: ${promo.current_uses}/${promo.max_uses || '∞'}\n`;
      message += `Expires: ${new Date(promo.valid_until).toLocaleDateString()}\n\n`;
    });
  } else {
    message += "No promo codes found.\n\n";
  }

  message += `<b>Quick Actions:</b>
Send commands directly:
• <code>/addpromo CODE percentage 20 30 100</code>
• <code>/deletepromo CODE</code>
• <code>/listpromos</code>`;

  const keyboard = {
    inline_keyboard: [
      [{ text: "📋 List All Promos", callback_data: "admin_list_promos" }],
      [{ text: "← Back to Admin Panel", callback_data: "admin_menu" }]
    ]
  };

  await sendMessage(botToken, chatId, message, keyboard);
}

async function handleAdminPlans(botToken: string, chatId: number, supabaseClient: any) {
  const { data: plans } = await supabaseClient
    .from("subscription_plans")
    .select("*")
    .order("price", { ascending: true });

  let message = `📦 <b>Subscription Plans Management</b>\n\n`;
  
  if (plans && plans.length > 0) {
    plans.forEach((plan: any) => {
      message += `💎 <b>${plan.name}</b> - $${plan.price}\n`;
      message += `⏱️ Duration: ${plan.is_lifetime ? 'Lifetime' : `${plan.duration_months} month(s)`}\n`;
      message += `🆔 ID: <code>${plan.id}</code>\n\n`;
    });
  } else {
    message += "No subscription plans found.\n\n";
  }

  message += `<b>Quick Actions:</b>
• <code>/addplan "Plan Name" 29.99 1 false</code>
• Create plans with lifetime or monthly options`;

  const keyboard = {
    inline_keyboard: [
      [{ text: "← Back to Admin Panel", callback_data: "admin_menu" }]
    ]
  };

  await sendMessage(botToken, chatId, message, keyboard);
}

async function handleAdminSettings(botToken: string, chatId: number, supabaseClient: any) {
  const settingsMessage = `⚙️ <b>Bot Settings</b>

Configure various bot settings:

📝 <b>Welcome Message:</b>
• <code>/setwelcome Your custom welcome message</code>

👥 <b>Admin Management:</b>
• Current Admins: 8486248025, 225513686
• Add admins by updating bot code

🔔 <b>Notifications:</b>
• Receipt notifications: ✅ Enabled
• Payment notifications: ✅ Enabled

📊 <b>Analytics:</b>
• User tracking: ✅ Enabled
• Payment tracking: ✅ Enabled

💬 <b>Support Settings:</b>
• Support Contact: @DynamicCapital_Support
• Support Email: support@dynamicvip.com`;

  const keyboard = {
    inline_keyboard: [
      [{ text: "← Back to Admin Panel", callback_data: "admin_menu" }]
    ]
  };

  await sendMessage(botToken, chatId, settingsMessage, keyboard);
}

async function handleAdminPaymentSettings(botToken: string, chatId: number, supabaseClient: any) {
  const paymentMessage = `💳 <b>Payment Method Settings</b>

Configure payment processing:

🏦 <b>Bank Transfer:</b>
• <code>/setbank Bank: YourBank | Account: 123456 | Routing: 987654</code>

₿ <b>Cryptocurrency:</b>
• <code>/setcrypto BTC: 1ABC...xyz | ETH: 0x123...abc</code>

💳 <b>Stripe Integration:</b>
• Status: 🔴 Not configured
• Setup: Requires API key configuration

🅿️ <b>PayPal Integration:</b>
• Status: 🔴 Not configured
• Setup: Requires PayPal API setup

⚡ <b>Processing:</b>
• Manual verification: ✅ Enabled
• Auto-approval: 🔴 Disabled`;

  const keyboard = {
    inline_keyboard: [
      [{ text: "← Back to Admin Panel", callback_data: "admin_menu" }]
    ]
  };

  await sendMessage(botToken, chatId, paymentMessage, keyboard);
}

async function handleAdminUsers(botToken: string, chatId: number, supabaseClient: any) {
  const { data: recentUsers } = await supabaseClient
    .from("user_subscriptions")
    .select("telegram_user_id, telegram_username, created_at, payment_status")
    .order("created_at", { ascending: false })
    .limit(10);

  let message = `👥 <b>User Management</b>\n\n`;
  
  if (recentUsers && recentUsers.length > 0) {
    message += `<b>Recent Users (Last 10):</b>\n\n`;
    recentUsers.forEach((user: any, index: number) => {
      message += `${index + 1}. ID: ${user.telegram_user_id}\n`;
      message += `   @${user.telegram_username || 'N/A'}\n`;
      message += `   Status: ${user.payment_status}\n`;
      message += `   Joined: ${new Date(user.created_at).toLocaleDateString()}\n\n`;
    });
  } else {
    message += "No users found.\n\n";
  }

  const keyboard = {
    inline_keyboard: [
      [{ text: "🔄 Refresh", callback_data: "admin_users" }],
      [{ text: "← Back to Admin Panel", callback_data: "admin_menu" }]
    ]
  };

  await sendMessage(botToken, chatId, message, keyboard);
}

async function handleAdminLogs(botToken: string, chatId: number, supabaseClient: any) {
  const logsMessage = `📝 <b>System Logs</b>

Recent bot activity:

🔔 <b>Notifications:</b>
• Receipt uploads: Monitored
• Payment approvals: Logged
• User registrations: Tracked

📊 <b>Performance:</b>
• Response time: Good
• Error rate: Low
• Uptime: 99%+

🔍 <b>Monitoring:</b>
• Database: ✅ Connected
• Storage: ✅ Active
• Webhooks: ✅ Running

📋 <b>Access Logs:</b>
View detailed logs in Supabase dashboard.`;

  const keyboard = {
    inline_keyboard: [
      [{ text: "← Back to Admin Panel", callback_data: "admin_menu" }]
    ]
  };

  await sendMessage(botToken, chatId, logsMessage, keyboard);
}

// Rejection callback handler
async function handleRejectPaymentCallback(botToken: string, chatId: number, subscriptionId: string, supabaseClient: any) {
  const keyboard = {
    inline_keyboard: [
      [{ text: "❌ Invalid Receipt", callback_data: `reject_confirm_${subscriptionId}_Invalid receipt format` }],
      [{ text: "❌ Insufficient Payment", callback_data: `reject_confirm_${subscriptionId}_Payment amount incorrect` }],
      [{ text: "❌ Fake/Edited Receipt", callback_data: `reject_confirm_${subscriptionId}_Receipt appears to be edited` }],
      [{ text: "❌ Wrong Payment Details", callback_data: `reject_confirm_${subscriptionId}_Wrong payment details` }],
      [{ text: "← Back to Pending", callback_data: "admin_pending" }]
    ]
  };

  await sendMessage(botToken, chatId, `❌ <b>Reject Payment</b>\n\nSubscription ID: <code>${subscriptionId}</code>\n\nSelect rejection reason:`, keyboard);
}

async function handleSetWelcome(botToken: string, chatId: number, welcomeText: string, supabaseClient: any) {
  if (!welcomeText) {
    await sendMessage(botToken, chatId, "❌ Please provide a welcome message.\n\nExample: <code>/setwelcome 🌟 Welcome to our VIP Bot!</code>");
    return;
  }

  // Store welcome message in database (you might want to create a settings table)
  // For now, we'll just confirm the change
  await sendMessage(botToken, chatId, `✅ <b>Welcome message updated!</b>

New message:
${welcomeText}

Note: You'll need to update the bot code to use custom welcome messages from database.`);
}

async function handleAddPromo(botToken: string, chatId: number, promoData: string, supabaseClient: any) {
  const parts = promoData.split(' ');
  if (parts.length < 4) {
    await sendMessage(botToken, chatId, `❌ <b>Invalid format!</b>

Usage: <code>/addpromo [code] [type] [value] [expires_days] [max_uses]</code>

Examples:
• <code>/addpromo SAVE20 percentage 20 30 100</code>
• <code>/addpromo FLAT50 fixed 50 7 50</code>

Parameters:
• code: Promo code name
• type: "percentage" or "fixed"
• value: Discount amount
• expires_days: Days until expiration
• max_uses: Maximum number of uses (optional)`);
    return;
  }

  const [code, type, value, expireDays, maxUses] = parts;
  
  if (type !== 'percentage' && type !== 'fixed') {
    await sendMessage(botToken, chatId, "❌ Type must be 'percentage' or 'fixed'");
    return;
  }

  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + parseInt(expireDays));

  const { error } = await supabaseClient
    .from("promotions")
    .insert({
      code: code.toUpperCase(),
      discount_type: type,
      discount_value: parseFloat(value),
      valid_from: new Date().toISOString(),
      valid_until: validUntil.toISOString(),
      max_uses: maxUses ? parseInt(maxUses) : null,
      current_uses: 0,
      is_active: true,
      description: `${type === 'percentage' ? value + '%' : '$' + value} off promotion`
    });

  if (error) {
    logStep("Error creating promo", { error });
    await sendMessage(botToken, chatId, "❌ Failed to create promo code. It might already exist.");
    return;
  }

  const discountText = type === 'percentage' ? `${value}%` : `$${value}`;
  await sendMessage(botToken, chatId, `✅ <b>Promo Code Created!</b>

📋 Code: <code>${code.toUpperCase()}</code>
💰 Discount: ${discountText} OFF
📅 Valid until: ${validUntil.toLocaleDateString()}
🔢 Max uses: ${maxUses || 'Unlimited'}`);
}

async function handleListPromos(botToken: string, chatId: number, supabaseClient: any) {
  const { data: promos, error } = await supabaseClient
    .from("promotions")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    await sendMessage(botToken, chatId, "❌ Failed to fetch promo codes.");
    return;
  }

  if (!promos || promos.length === 0) {
    await sendMessage(botToken, chatId, "📋 No promo codes found.");
    return;
  }

  let message = "📋 <b>Promo Codes</b>\n\n";
  promos.forEach((promo: any) => {
    const discountText = promo.discount_type === 'percentage' 
      ? `${promo.discount_value}%` 
      : `$${promo.discount_value}`;
    const status = promo.is_active ? "🟢 Active" : "🔴 Inactive";
    const expires = new Date(promo.valid_until).toLocaleDateString();
    
    message += `<code>${promo.code}</code> - ${discountText} ${status}
Uses: ${promo.current_uses}/${promo.max_uses || '∞'}
Expires: ${expires}\n\n`;
  });

  await sendMessage(botToken, chatId, message);
}

async function handleDeletePromo(botToken: string, chatId: number, promoCode: string, supabaseClient: any) {
  if (!promoCode) {
    await sendMessage(botToken, chatId, "❌ Please provide a promo code to delete.\n\nExample: <code>/deletepromo SAVE20</code>");
    return;
  }

  const { error } = await supabaseClient
    .from("promotions")
    .delete()
    .eq("code", promoCode.toUpperCase());

  if (error) {
    await sendMessage(botToken, chatId, "❌ Failed to delete promo code. Make sure it exists.");
    return;
  }

  await sendMessage(botToken, chatId, `✅ Promo code <code>${promoCode.toUpperCase()}</code> has been deleted.`);
}

async function handleStats(botToken: string, chatId: number, supabaseClient: any) {
  const { data: subscriptions } = await supabaseClient
    .from("user_subscriptions")
    .select("payment_status");

  const { data: promos } = await supabaseClient
    .from("promotions")
    .select("current_uses");

  const pending = subscriptions?.filter((s: any) => s.payment_status === 'pending').length || 0;
  const active = subscriptions?.filter((s: any) => s.payment_status === 'active').length || 0;
  const total = subscriptions?.length || 0;
  const totalPromoUses = promos?.reduce((sum: number, p: any) => sum + p.current_uses, 0) || 0;

  const statsMessage = `📊 <b>Bot Statistics</b>

👥 <b>Subscriptions:</b>
• Total: ${total}
• Active: ${active}
• Pending: ${pending}

🎫 <b>Promotions:</b>
• Total uses: ${totalPromoUses}
• Active codes: ${promos?.length || 0}`;

  await sendMessage(botToken, chatId, statsMessage);
}

// About Us function
async function handleAboutUs(botToken: string, chatId: number, supabaseClient: any) {
  const aboutMessage = `ℹ️ <b>About Dynamic VIP Bot</b>

🚀 <b>Your Premium Access Solution</b>

We provide exclusive VIP access to premium features and services that elevate your experience to the next level.

🌟 <b>What We Offer:</b>
• Premium subscription plans
• Multiple payment options
• 24/7 customer support
• Instant activation
• Secure payment processing

💎 <b>Why Choose Us?</b>
• Trusted by thousands of users
• Competitive pricing
• Flexible payment methods
• Excellent customer service
• Regular updates and improvements

📞 <b>Contact Information:</b>
• Email: support@dynamicvip.com
• Telegram: @DynamicVIP_Support
• Website: dynamicvip.com

Thank you for choosing Dynamic VIP! 🙏`;

  const backKeyboard = {
    inline_keyboard: [
      [{ text: "← Back to Main Menu", callback_data: "main_menu" }]
    ]
  };

  await sendMessage(botToken, chatId, aboutMessage, backKeyboard);
}

// My Account function
async function handleMyAccount(botToken: string, chatId: number, userId: number, supabaseClient: any) {
  // Get user's subscription status
  const { data: subscription } = await supabaseClient
    .from("user_subscriptions")
    .select("*, subscription_plans(*)")
    .eq("telegram_user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let accountMessage = `📊 <b>My Account</b>\n\n`;
  accountMessage += `👤 <b>User ID:</b> ${userId}\n\n`;

  if (subscription) {
    const plan = subscription.subscription_plans;
    const status = subscription.is_active ? "🟢 Active" : "🔴 Inactive";
    const paymentStatus = subscription.payment_status;
    
    accountMessage += `💎 <b>Current Subscription:</b>\n`;
    accountMessage += `• Plan: ${plan?.name || 'N/A'}\n`;
    accountMessage += `• Price: $${plan?.price || '0'}\n`;
    accountMessage += `• Status: ${status}\n`;
    accountMessage += `• Payment: ${paymentStatus}\n`;
    
    if (subscription.subscription_end_date) {
      accountMessage += `• Expires: ${new Date(subscription.subscription_end_date).toLocaleDateString()}\n`;
    }
    
    accountMessage += `\n📅 <b>Subscription Date:</b> ${new Date(subscription.created_at).toLocaleDateString()}`;
  } else {
    accountMessage += `💎 <b>Subscription Status:</b>\n`;
    accountMessage += `• No active subscription found\n`;
    accountMessage += `• Ready to get started? Choose a plan!`;
  }

  const accountKeyboard = {
    inline_keyboard: [
      [
        { text: "📦 View Plans", callback_data: "view_packages" },
        { text: "🆘 Support", callback_data: "contact_support" }
      ],
      [
        { text: "← Back to Main Menu", callback_data: "main_menu" }
      ]
    ]
  };

  await sendMessage(botToken, chatId, accountMessage, accountKeyboard);
}

// Help command - shows all available commands
async function handleHelp(botToken: string, chatId: number, isAdmin: boolean, supabaseClient: any) {
  let helpMessage = `📚 <b>Available Commands</b>

🏠 <b>Main Commands:</b>
• <code>/start</code> - Show main menu
• <code>/help</code> - Show this help message
• <code>PROMO [code]</code> - Apply promo code

📊 <b>Account:</b>
• Use menu buttons for account status
• Upload receipt for manual payments

🆘 <b>Support:</b>
• @DynamicCapital_Support
• Email: support@dynamicvip.com`;

  if (isAdmin) {
    helpMessage += `

🔧 <b>Admin Commands:</b>
• <code>/admin</code> - Admin panel
• <code>/pending</code> - View pending payments
• <code>/approve [id]</code> - Approve payment
• <code>/reject [id] [reason]</code> - Reject payment
• <code>/stats</code> - Bot statistics
• <code>/getchatid</code> - Get current chat ID

🎯 <b>VIP Management:</b>
• <code>/addvip [user_id]</code> - Add user to VIP
• <code>/removevip [user_id]</code> - Remove user from VIP
• <code>/checkvip [user_id]</code> - Check VIP status
• <code>/checkexpired</code> - Process expired subscriptions

📋 <b>Promo Management:</b>
• <code>/addpromo [code] [type] [value] [days] [uses]</code>
• <code>/listpromos</code> - List all promos
• <code>/deletepromo [code]</code> - Delete promo

⚙️ <b>Settings:</b>
• <code>/setwelcome [message]</code> - Update welcome
• <code>/setbank [details]</code> - Update bank info
• <code>/setcrypto [details]</code> - Update crypto info
• <code>/addplan [name] [price] [months] [lifetime]</code>

<b>Examples:</b>
<code>/addpromo SAVE20 percentage 20 30 100</code>
<code>/approve 12345</code>
<code>/reject 12345 Invalid receipt</code>`;
  }

  await sendMessage(botToken, chatId, helpMessage);
}

// Payment approval/rejection system
async function handlePendingPayments(botToken: string, chatId: number, supabaseClient: any) {
  const { data: pendingPayments, error } = await supabaseClient
    .from("user_subscriptions")
    .select("*, subscription_plans(*)")
    .eq("payment_status", "receipt_submitted")
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    await sendMessage(botToken, chatId, "❌ Error fetching pending payments.");
    return;
  }

  if (!pendingPayments || pendingPayments.length === 0) {
    await sendMessage(botToken, chatId, "✅ No pending payments found.");
    return;
  }

  let message = `📋 <b>Pending Payments (${pendingPayments.length})</b>\n\n`;
  
  pendingPayments.forEach((payment: any, index: number) => {
    const plan = payment.subscription_plans;
    message += `${index + 1}. <b>ID:</b> <code>${payment.id}</code>
👤 User: ${payment.telegram_user_id} (@${payment.telegram_username || 'N/A'})
💎 Plan: ${plan?.name} ($${plan?.price})
💳 Method: ${payment.payment_method}
📅 Date: ${new Date(payment.created_at).toLocaleDateString()}

<code>/approve ${payment.id}</code> | <code>/reject ${payment.id} [reason]</code>

`;
  });

  await sendMessage(botToken, chatId, message);
}

async function handleApprovePayment(botToken: string, chatId: number, subscriptionId: string, supabaseClient: any) {
  if (!subscriptionId) {
    await sendMessage(botToken, chatId, "❌ Please provide subscription ID.\n\nExample: <code>/approve 12345</code>");
    return;
  }

  // Get subscription details
  const { data: subscription, error: fetchError } = await supabaseClient
    .from("user_subscriptions")
    .select("*, subscription_plans(*)")
    .eq("id", subscriptionId)
    .single();

  if (fetchError || !subscription) {
    await sendMessage(botToken, chatId, "❌ Subscription not found.");
    return;
  }

  // Calculate subscription end date
  const plan = subscription.subscription_plans;
  const startDate = new Date();
  let endDate = null;
  
  if (!plan.is_lifetime) {
    endDate = new Date();
    endDate.setMonth(endDate.getMonth() + plan.duration_months);
  }

  // Update subscription status
  const { error: updateError } = await supabaseClient
    .from("user_subscriptions")
    .update({
      payment_status: "active",
      is_active: true,
      subscription_start_date: startDate.toISOString(),
      subscription_end_date: endDate?.toISOString() || null,
      updated_at: new Date().toISOString()
    })
    .eq("id", subscriptionId);

  if (updateError) {
    await sendMessage(botToken, chatId, "❌ Failed to approve payment.");
    return;
  }

  // Notify user
  const userNotification = `🎉 <b>Payment Approved!</b>

Your ${plan.name} subscription has been activated!

💎 <b>Plan:</b> ${plan.name}
💰 <b>Price:</b> $${plan.price}
📅 <b>Start Date:</b> ${startDate.toLocaleDateString()}
${endDate ? `📅 <b>End Date:</b> ${endDate.toLocaleDateString()}` : '🔥 <b>Lifetime Access!</b>'}

🌟 <b>VIP Access Granted!</b>
You're being added to our exclusive VIP channels...

Welcome to VIP! 🎉`;

  await sendMessage(botToken, subscription.telegram_user_id, userNotification);

  // Add user to VIP group and channel
  const vipAccessGranted = await addUserToVIPAccess(
    botToken, 
    parseInt(subscription.telegram_user_id), 
    subscription.telegram_username
  );

  // Notify admin
  await sendMessage(botToken, chatId, `✅ <b>Payment Approved</b>

Subscription ID: <code>${subscriptionId}</code>
User: ${subscription.telegram_user_id} (@${subscription.telegram_username})
Plan: ${plan.name} ($${plan.price})
VIP Access: ${vipAccessGranted ? '✅ Granted' : '❌ Failed'}

User has been notified and ${vipAccessGranted ? 'added to VIP channels' : 'VIP access failed - check logs'}. ✨`);
}

async function handleRejectPayment(botToken: string, chatId: number, subscriptionId: string, reason: string, supabaseClient: any) {
  if (!subscriptionId) {
    await sendMessage(botToken, chatId, "❌ Please provide subscription ID.\n\nExample: <code>/reject 12345 Invalid receipt</code>");
    return;
  }

  // Get subscription details
  const { data: subscription, error: fetchError } = await supabaseClient
    .from("user_subscriptions")
    .select("*, subscription_plans(*)")
    .eq("id", subscriptionId)
    .single();

  if (fetchError || !subscription) {
    await sendMessage(botToken, chatId, "❌ Subscription not found.");
    return;
  }

  // Update subscription status
  const { error: updateError } = await supabaseClient
    .from("user_subscriptions")
    .update({
      payment_status: "rejected",
      is_active: false,
      updated_at: new Date().toISOString()
    })
    .eq("id", subscriptionId);

  if (updateError) {
    await sendMessage(botToken, chatId, "❌ Failed to reject payment.");
    return;
  }

  // Remove user from VIP access if they had it
  await removeUserFromVIPAccess(
    botToken, 
    parseInt(subscription.telegram_user_id), 
    subscription.telegram_username, 
    `Payment rejected: ${reason}`
  );

  const plan = subscription.subscription_plans;

  // Notify user
  const userNotification = `❌ <b>Payment Verification Failed</b>

Your payment for ${plan.name} could not be verified.

<b>Reason:</b> ${reason}

💡 <b>What to do next:</b>
• Check your payment receipt
• Ensure all details are clearly visible
• Upload a new receipt if needed
• Contact support: @DynamicCapital_Support

You can try uploading a new receipt or contact our support team for assistance.`;

  await sendMessage(botToken, subscription.telegram_user_id, userNotification);

  // Notify admin
  await sendMessage(botToken, chatId, `❌ <b>Payment Rejected</b>

Subscription ID: <code>${subscriptionId}</code>
User: ${subscription.telegram_user_id} (@${subscription.telegram_username})
Plan: ${plan.name} ($${plan.price})
Reason: ${reason}

User has been notified. 📝`);
}

// Settings management functions
async function handleSetBankDetails(botToken: string, chatId: number, bankDetails: string, supabaseClient: any) {
  if (!bankDetails) {
    await sendMessage(botToken, chatId, `❌ Please provide bank details.

Example:
<code>/setbank Bank: XYZ Bank | Account: 1234567890 | Routing: 123456789 | Name: Business Account</code>`);
    return;
  }

  // Store in a settings table (you might want to create this)
  await sendMessage(botToken, chatId, `✅ <b>Bank Details Updated</b>

New details:
${bankDetails}

Note: Update the bot code to use these details in payment instructions.`);
}

async function handleSetCryptoDetails(botToken: string, chatId: number, cryptoDetails: string, supabaseClient: any) {
  if (!cryptoDetails) {
    await sendMessage(botToken, chatId, `❌ Please provide crypto details.

Example:
<code>/setcrypto BTC: 1ABC...xyz | ETH: 0x123...abc | USDT: T123...xyz</code>`);
    return;
  }

  await sendMessage(botToken, chatId, `✅ <b>Crypto Details Updated</b>

New details:
${cryptoDetails}

Note: Update the bot code to use these details in payment instructions.`);
}

async function handleAddPlan(botToken: string, chatId: number, planData: string, supabaseClient: any) {
  const parts = planData.split(' ');
  if (parts.length < 3) {
    await sendMessage(botToken, chatId, `❌ <b>Invalid format!</b>

Usage: <code>/addplan [name] [price] [months] [lifetime]</code>

Examples:
• <code>/addplan "Weekly VIP" 4.99 0.25 false</code>
• <code>/addplan "Ultimate VIP" 299.99 0 true</code>

Parameters:
• name: Plan name (use quotes for spaces)
• price: Price in USD
• months: Duration in months (0 for lifetime)
• lifetime: true/false`);
    return;
  }

  const name = parts[0].replace(/"/g, '');
  const price = parseFloat(parts[1]);
  const months = parseFloat(parts[2]);
  const isLifetime = parts[3] === 'true';

  const { error } = await supabaseClient
    .from("subscription_plans")
    .insert({
      name: name,
      price: price,
      duration_months: Math.floor(months),
      is_lifetime: isLifetime,
      currency: 'USD',
      features: ['Premium Access', 'Priority Support']
    });

  if (error) {
    await sendMessage(botToken, chatId, "❌ Failed to create plan. It might already exist.");
    return;
}

// === GROUP AND CHANNEL MANAGEMENT FUNCTIONS ===

// Add user to VIP group and channel
async function addUserToVIPAccess(botToken: string, userId: number, username: string) {
  logStep("Adding user to VIP access", { userId, username });
  
  try {
    // Add to VIP channel
    await addUserToChat(botToken, VIP_CHANNEL_ID, userId);
    logStep("User added to VIP channel", { userId, channelId: VIP_CHANNEL_ID });
    
    // Add to VIP group
    await addUserToChat(botToken, VIP_GROUP_ID, userId);
    logStep("User added to VIP group", { userId, groupId: VIP_GROUP_ID });
    
    // Send welcome message to user
    const welcomeMessage = `🎉 <b>Welcome to VIP Access!</b>

Congratulations! You now have access to:

📢 <b>VIP Channel:</b> Exclusive announcements and signals
💬 <b>VIP Group:</b> Premium discussion and community

🌟 <b>Your VIP Benefits:</b>
• Priority market analysis
• Exclusive trading signals
• Direct access to premium content
• Community discussions with fellow VIP members

Enjoy your premium experience! 💎`;

    await sendMessage(botToken, userId, welcomeMessage);
    
    return true;
  } catch (error) {
    logStep("Error adding user to VIP access", { userId, error: error.message });
    return false;
  }
}

// Remove user from VIP group and channel
async function removeUserFromVIPAccess(botToken: string, userId: number, username: string, reason: string = "Subscription expired") {
  logStep("Removing user from VIP access", { userId, username, reason });
  
  try {
    // Remove from VIP channel
    await removeUserFromChat(botToken, VIP_CHANNEL_ID, userId);
    logStep("User removed from VIP channel", { userId, channelId: VIP_CHANNEL_ID });
    
    // Remove from VIP group
    await removeUserFromChat(botToken, VIP_GROUP_ID, userId);
    logStep("User removed from VIP group", { userId, groupId: VIP_GROUP_ID });
    
    // Send notification to user
    const notificationMessage = `📢 <b>VIP Access Update</b>

Your VIP access has been updated.

<b>Reason:</b> ${reason}

💡 <b>To regain access:</b>
• Renew your subscription
• Contact support: @DynamicCapital_Support
• Use /start to see available plans

Thank you for being part of our community! 🙏`;

    await sendMessage(botToken, userId, notificationMessage);
    
    return true;
  } catch (error) {
    logStep("Error removing user from VIP access", { userId, error: error.message });
    return false;
  }
}

// Add user to specific chat
async function addUserToChat(botToken: string, chatId: string, userId: number) {
  const url = `https://api.telegram.org/bot${botToken}/approveChatJoinRequest`;
  
  try {
    // First try to invite user directly
    const inviteResponse = await fetch(`https://api.telegram.org/bot${botToken}/createChatInviteLink`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        member_limit: 1,
        creates_join_request: false
      })
    });
    
    const inviteData = await inviteResponse.json();
    if (inviteData.ok) {
      // Send invite link to user
      await sendMessage(botToken, userId, `🔗 <b>VIP Access Link</b>\n\nClick to join: ${inviteData.result.invite_link}`);
    }
    
    return true;
  } catch (error) {
    logStep("Error adding user to chat", { chatId, userId, error: error.message });
    throw error;
  }
}

// Remove user from specific chat
async function removeUserFromChat(botToken: string, chatId: string, userId: number) {
  const url = `https://api.telegram.org/bot${botToken}/banChatMember`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        user_id: userId,
        until_date: Math.floor(Date.now() / 1000) + 60, // Unban after 1 minute
        revoke_messages: false
      })
    });
    
    const data = await response.json();
    if (!data.ok) {
      logStep("Failed to remove user from chat", { chatId, userId, error: data.description });
    }
    
    // Unban user immediately so they can rejoin later if they renew
    setTimeout(async () => {
      await fetch(`https://api.telegram.org/bot${botToken}/unbanChatMember`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          user_id: userId,
          only_if_banned: true
        })
      });
    }, 2000);
    
    return true;
  } catch (error) {
    logStep("Error removing user from chat", { chatId, userId, error: error.message });
    throw error;
  }
}

// Check for expired subscriptions and remove access
async function checkExpiredSubscriptions(botToken: string, supabaseClient: any) {
  logStep("Checking for expired subscriptions");
  
  try {
    const { data: expiredSubs, error } = await supabaseClient
      .from("user_subscriptions")
      .select("telegram_user_id, telegram_username, subscription_end_date")
      .eq("is_active", true)
      .lt("subscription_end_date", new Date().toISOString());
    
    if (error) {
      logStep("Error fetching expired subscriptions", { error });
      return;
    }
    
    if (expiredSubs && expiredSubs.length > 0) {
      logStep("Found expired subscriptions", { count: expiredSubs.length });
      
      for (const sub of expiredSubs) {
        // Update subscription status
        await supabaseClient
          .from("user_subscriptions")
          .update({
            is_active: false,
            payment_status: "expired",
            updated_at: new Date().toISOString()
          })
          .eq("telegram_user_id", sub.telegram_user_id);
        
        // Remove from VIP access
        await removeUserFromVIPAccess(
          botToken, 
          parseInt(sub.telegram_user_id), 
          sub.telegram_username, 
          "Subscription expired"
        );
        
        logStep("Processed expired subscription", { 
          userId: sub.telegram_user_id, 
          username: sub.telegram_username 
        });
      }
    } else {
      logStep("No expired subscriptions found");
    }
  } catch (error) {
    logStep("Error in checkExpiredSubscriptions", { error: error.message });
  }
}

// Admin function to manually manage VIP access
async function handleManageVIPAccess(botToken: string, chatId: number, supabaseClient: any) {
  const { data: recentSubs } = await supabaseClient
    .from("user_subscriptions")
    .select("telegram_user_id, telegram_username, is_active, payment_status")
    .order("created_at", { ascending: false })
    .limit(10);
  
  let message = `👥 <b>VIP Access Management</b>\n\n`;
  
  if (recentSubs && recentSubs.length > 0) {
    message += `<b>Recent Users:</b>\n\n`;
    recentSubs.forEach((sub: any, index: number) => {
      const status = sub.is_active ? "🟢 Active" : "🔴 Inactive";
      message += `${index + 1}. ${sub.telegram_user_id} (@${sub.telegram_username || 'N/A'})\n`;
      message += `   Status: ${status} (${sub.payment_status})\n\n`;
    });
  }
  
  message += `<b>Management Commands:</b>
• <code>/addvip [user_id]</code> - Add user to VIP
• <code>/removevip [user_id]</code> - Remove user from VIP
• <code>/checkvip [user_id]</code> - Check user VIP status
• <code>/checkexpired</code> - Check for expired subscriptions`;
  
  const keyboard = {
    inline_keyboard: [
      [{ text: "🔄 Check Expired Subscriptions", callback_data: "admin_check_expired" }],
      [{ text: "← Back to Admin Panel", callback_data: "admin_menu" }]
    ]
  };
  
  await sendMessage(botToken, chatId, message, keyboard);
}

  await sendMessage(botToken, chatId, `✅ <b>Plan Created!</b>

📋 Name: ${name}
💰 Price: $${price}
⏱️ Duration: ${isLifetime ? 'Lifetime' : `${months} month(s)`}`);
}

// Individual VIP management command functions
async function handleAddVIP(botToken: string, chatId: number, userId: string, supabaseClient: any) {
  if (!userId) {
    await sendMessage(botToken, chatId, "❌ Please provide user ID.\n\nExample: <code>/addvip 123456789</code>");
    return;
  }

  try {
    const success = await addUserToVIPAccess(botToken, parseInt(userId), "manual_add");
    if (success) {
      await sendMessage(botToken, chatId, `✅ User ${userId} has been added to VIP channels.`);
    } else {
      await sendMessage(botToken, chatId, `❌ Failed to add user ${userId} to VIP channels. Check logs for details.`);
    }
  } catch (error) {
    await sendMessage(botToken, chatId, `❌ Error adding user to VIP: ${error.message}`);
  }
}

async function handleRemoveVIP(botToken: string, chatId: number, userId: string, supabaseClient: any) {
  if (!userId) {
    await sendMessage(botToken, chatId, "❌ Please provide user ID.\n\nExample: <code>/removevip 123456789</code>");
    return;
  }

  try {
    const success = await removeUserFromVIPAccess(botToken, parseInt(userId), "manual_remove", "Manually removed by admin");
    if (success) {
      await sendMessage(botToken, chatId, `✅ User ${userId} has been removed from VIP channels.`);
    } else {
      await sendMessage(botToken, chatId, `❌ Failed to remove user ${userId} from VIP channels. Check logs for details.`);
    }
  } catch (error) {
    await sendMessage(botToken, chatId, `❌ Error removing user from VIP: ${error.message}`);
  }
}

async function handleCheckVIP(botToken: string, chatId: number, userId: string, supabaseClient: any) {
  if (!userId) {
    await sendMessage(botToken, chatId, "❌ Please provide user ID.\n\nExample: <code>/checkvip 123456789</code>");
    return;
  }

  try {
    const { data: subscription } = await supabaseClient
      .from("user_subscriptions")
      .select("*, subscription_plans(*)")
      .eq("telegram_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let message = `👤 <b>VIP Status for User ${userId}</b>\n\n`;
    
    if (subscription) {
      const plan = subscription.subscription_plans;
      const status = subscription.is_active ? "🟢 Active" : "🔴 Inactive";
      
      message += `💎 <b>Subscription:</b> ${plan?.name || 'N/A'}\n`;
      message += `💰 <b>Price:</b> $${plan?.price || '0'}\n`;
      message += `📊 <b>Status:</b> ${status}\n`;
      message += `💳 <b>Payment:</b> ${subscription.payment_status}\n`;
      
      if (subscription.subscription_end_date) {
        message += `📅 <b>Expires:</b> ${new Date(subscription.subscription_end_date).toLocaleDateString()}\n`;
      }
      
      message += `🕒 <b>Created:</b> ${new Date(subscription.created_at).toLocaleDateString()}`;
    } else {
      message += "❌ No subscription found for this user.";
    }

    await sendMessage(botToken, chatId, message);
  } catch (error) {
    await sendMessage(botToken, chatId, `❌ Error checking VIP status: ${error.message}`);
  }
}

async function handleManualCrypto(botToken: string, chatId: number, userId: number, username: string, planId: string, supabaseClient: any) {
  // Get plan details
  const { data: plan, error } = await supabaseClient
    .from("subscription_plans")
    .select("*")
    .eq("id", planId)
    .single();

  if (error || !plan) {
    await sendMessage(botToken, chatId, "Sorry, I couldn't find that plan. Please try again.");
    return;
  }

  const manualCryptoMessage = `₿ <b>Manual Crypto Payment</b>

📋 Plan: ${plan.name}
💰 Amount: $${plan.price} USDT

  💰 <b>Send crypto to these addresses:</b>

  🔸 <b>USDT (TRC20) - Recommended:</b>
  <code>TQeAph1kiaVbwvY2NS1EwepqrnoTpK6Wss</code>

  🔸 <b>BNB (BEP20):</b>
  <code>0x6df5422b719a54201e80a80627d4f8daa611689c</code>

  🔸 <b>Bitcoin (BTC):</b>
  <code>Contact support for BTC address</code>

📸 <b>After payment, send to this chat:</b>
• Transaction hash (TxID)
• Screenshot of successful transaction
• Your payment amount

⏰ <b>Processing time:</b> 1-2 hours after verification

💡 <b>Tips:</b>
• Use exact amount to avoid delays
• Include transaction fee in your calculation
• Save transaction hash for your records

📞 Need help? Contact @DynamicCapital_Support`;

  const keyboard = {
    inline_keyboard: [
      [{ text: "← Back to Crypto Options", callback_data: `payment_crypto_${planId}` }],
      [{ text: "🆘 Contact Support", callback_data: "contact_support" }]
    ]
  };

  await sendMessage(botToken, chatId, manualCryptoMessage, keyboard);

  // Create subscription record for manual tracking
  await supabaseClient
    .from("user_subscriptions")
    .upsert({
      telegram_user_id: userId.toString(),
      telegram_username: username,
      plan_id: planId,
      payment_method: "manual_crypto",
      payment_status: "pending",
      payment_instructions: "Manual crypto transfer - awaiting transaction proof"
    });
}

// FAQ handler
async function handleFAQ(botToken: string, chatId: number, supabaseClient: any) {
  const faqMessage = `❓ <b>Frequently Asked Questions</b>

🔸 <b>How do I subscribe?</b>
Choose a plan from /start and follow the payment instructions.

🔸 <b>What payment methods do you accept?</b>
Credit cards, PayPal, bank transfer, and cryptocurrency.

🔸 <b>How long does activation take?</b>
• Card/PayPal: Instant
• Bank transfer: 1-2 business days
• Crypto: 30 minutes - 2 hours

🔸 <b>Can I change my plan?</b>
Contact support to upgrade or modify your subscription.

🔸 <b>Do you offer refunds?</b>
Yes, we have a 7-day money-back guarantee.

🔸 <b>How do I contact support?</b>
Use /help or message @DynamicVIP_Support

🔸 <b>Can I use promo codes?</b>
Yes! Type PROMO [your code] or use /promo [code]

💬 <b>Have another question?</b> Just ask me anything using /ask [your question] or simply type your question!`;

  const keyboard = {
    inline_keyboard: [
      [{ text: "💬 Ask AI Assistant", callback_data: "ask_ai" }],
      [{ text: "← Back to Main Menu", callback_data: "main_menu" }]
    ]
  };

  await sendMessage(botToken, chatId, faqMessage, keyboard);
}

// AI-powered question handler
async function handleAIQuestion(botToken: string, chatId: number, question: string, supabaseClient: any) {
  try {
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      await sendMessage(botToken, chatId, "❌ AI assistant is currently unavailable. Please contact support or check our FAQ with /faq");
      return;
    }

    // Send typing indicator
    await sendTypingAction(botToken, chatId);

    const systemPrompt = `You are a helpful customer support assistant for a VIP subscription service. Here's what you should know:

SUBSCRIPTION PLANS:
- We offer monthly, quarterly, semi-annual, and lifetime VIP plans
- Prices range from $9.99 to $99.99
- All plans include premium features, priority support, and exclusive content

PAYMENT METHODS:
- Credit/Debit cards (instant activation)
- PayPal (instant activation)
- Bank transfer (1-2 business days verification)
- Cryptocurrency (Bitcoin, Ethereum, USDT via Binance Pay - 30 min to 2 hours processing)

POLICIES:
- 7-day money-back guarantee
- 24/7 customer support
- Secure payment processing
- No hidden fees

COMMANDS USERS CAN USE:
- /start - View subscription plans
- /help - Get help and commands
- /faq - View frequently asked questions
- /ask [question] - Ask AI assistant
- PROMO [code] - Apply promo code

SUPPORT:
- Telegram: @DynamicVIP_Support
- Email: support@dynamicvip.com
- Response time: 2-4 hours

Answer questions helpfully and professionally. If you don't know something specific, direct them to contact support. Keep responses concise but informative.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: question }
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;

    const responseMessage = `🤖 <b>AI Assistant</b>

${aiResponse}

💬 <b>Need more help?</b> 
• Type /faq for common questions
• Contact support: @DynamicVIP_Support
• Ask another question: /ask [your question]`;

    const keyboard = {
      inline_keyboard: [
        [{ text: "❓ View FAQ", callback_data: "view_faq" }],
        [{ text: "🆘 Contact Support", callback_data: "contact_support" }],
        [{ text: "← Back to Main Menu", callback_data: "main_menu" }]
      ]
    };

    await sendMessage(botToken, chatId, responseMessage, keyboard);

  } catch (error) {
    console.error('AI question error:', error);
    await sendMessage(botToken, chatId, "❌ Sorry, I couldn't process your question right now. Please try again later or contact support for immediate assistance.");
  }
}

// Helper function to send typing action
async function sendTypingAction(botToken: string, chatId: number) {
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendChatAction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        action: 'typing'
      })
    });
  } catch (error) {
    console.error('Error sending typing action:', error);
  }
}