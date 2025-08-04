import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

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
      const adminIds = ["8486248025"]; // Your admin Telegram user ID (you can add more)
      const isAdmin = adminIds.includes(userId.toString());

      if (text === "/start") {
        await handleMainMenu(botToken, chatId, userId, username, supabaseClient);
      } else if (text === "/admin" && isAdmin) {
        await handleAdminMenu(botToken, chatId, supabaseClient);
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
      } else if (text.startsWith("/promo ") || text.startsWith("PROMO")) {
        const promoCode = text.replace("/promo ", "").replace("PROMO", "").trim();
        await handlePromoCode(botToken, chatId, userId, username, promoCode, supabaseClient);
      } else {
        await sendMessage(botToken, chatId, "I didn't understand that command. Use /start to see available options or send a promo code like: PROMO SAVE20");
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

  const welcomeMessage = `🌟 Welcome to VIP Subscription Bot! 🌟

Choose your subscription plan:

💎 1 Month VIP - $9.99
💎 3 Month VIP - $24.99  
💎 6 Month VIP - $44.99
💎 Lifetime VIP - $99.99

Select a plan below to get started:`;

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

💼 <b>Bank Details:</b>
Bank Name: Your Bank Name
Account Number: 1234567890
Routing Number: 123456789
Account Name: Your Business Name
Reference: VIP-${userId}-${planId}

📸 <b>Important:</b> After making the transfer, please send a screenshot or photo of your transfer receipt to this chat.

⏰ Processing time: 1-2 business days after receipt verification.`;
      paymentInstructions = "Bank transfer with receipt upload required";
      break;

    case "crypto":
      paymentMessage = `₿ <b>Binance Pay / Crypto Payment</b>

📋 Plan: ${plan.name}
💰 Amount: $${plan.price}

🔗 <b>Binance Pay ID:</b> 123456789
💰 <b>Or send crypto to:</b>
BTC: 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa
ETH: 0x742d35Cc7e8Ea3Fc05F5b8A6C4d8F0E5F9F1F1F1
USDT (TRC20): TXxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

📸 <b>Important:</b> After making the payment, please send a screenshot of your transaction to this chat.

⏰ Processing time: Usually within 30 minutes after confirmation.`;
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
  const adminMessage = `🔧 <b>Admin Panel</b>

Available commands:
• <code>/setwelcome [message]</code> - Update welcome message
• <code>/addpromo [code] [type] [value] [expires_days] [max_uses]</code> - Add promo code
• <code>/listpromos</code> - List all promo codes
• <code>/deletepromo [code]</code> - Delete promo code
• <code>/stats</code> - View bot statistics

<b>Example promo creation:</b>
<code>/addpromo SAVE20 percentage 20 30 100</code>
(20% off, valid for 30 days, max 100 uses)`;

  await sendMessage(botToken, chatId, adminMessage);
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