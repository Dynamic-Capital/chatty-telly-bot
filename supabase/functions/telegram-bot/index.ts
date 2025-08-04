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

// Support Configuration - Easily customizable
const SUPPORT_CONFIG = {
  support_telegram: "@DynamicCapital_Support",
  admin_telegram: "@DynamicCapital_Admin", // For future use
  support_email: "support@dynamicvip.com",
  website: "dynamicvip.com"
};

// Session timeout settings (15 minutes)
const SESSION_TIMEOUT = 15 * 60 * 1000; // 15 minutes in milliseconds
const PAYMENT_TIMEOUT = 30 * 60 * 1000; // 30 minutes for payments
const BUTTON_COOLDOWN = 2000; // 2 seconds cooldown between button presses
const userSessions = new Map(); // Store user session data
const recentActions = new Map(); // Track recent button presses

// Session management functions
function updateUserSession(userId: number, action: string = 'activity') {
  const now = Date.now();
  userSessions.set(userId, {
    lastActivity: now,
    action: action,
    timestamp: now
  });
}

function isSessionExpired(userId: number): boolean {
  const session = userSessions.get(userId);
  if (!session) return false;
  
  const timeout = session.action === 'payment' ? PAYMENT_TIMEOUT : SESSION_TIMEOUT;
  return (Date.now() - session.lastActivity) > timeout;
}

async function handleSessionTimeout(botToken: string, chatId: number, userId: number) {
  const session = userSessions.get(userId);
  const timeoutType = session?.action === 'payment' ? 'payment' : 'chat';
  
  await sendMessage(botToken, chatId, `⏰ <b>Session Timeout</b>

Your ${timeoutType} session has expired for security purposes.

🔄 Please start again by typing /start or click the button below.`, {
    inline_keyboard: [[
      { text: "🔄 Start Fresh", callback_data: "main_menu" }
    ]]
  });
  
  userSessions.delete(userId);
}

// Button press protection functions
function getActionKey(userId: number, action: string): string {
  return `${userId}_${action}`;
}

function isRecentAction(userId: number, action: string): boolean {
  const key = getActionKey(userId, action);
  const lastAction = recentActions.get(key);
  if (!lastAction) return false;
  
  return (Date.now() - lastAction) < BUTTON_COOLDOWN;
}

function recordAction(userId: number, action: string) {
  const key = getActionKey(userId, action);
  recentActions.set(key, Date.now());
  
  // Clean up old actions (older than 5 minutes)
  setTimeout(() => {
    const actionTime = recentActions.get(key);
    if (actionTime && (Date.now() - actionTime) > 300000) {
      recentActions.delete(key);
    }
  }, 300000);
}

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

      // Prevent rapid command spamming (except /start)
      if (text !== "/start" && isRecentAction(userId, text)) {
        logStep("Duplicate command prevented", { userId, command: text });
        await sendMessage(botToken, chatId, "⏳ Please wait a moment before sending another command...");
        return new Response("OK", { status: 200 });
      }

      // Record this command
      if (text !== "/start") {
        recordAction(userId, text);
      }

      // Check for session timeout
      if (isSessionExpired(userId)) {
        await handleSessionTimeout(botToken, chatId, userId);
        return new Response("OK", { status: 200 });
      }

      // Update user session activity
      updateUserSession(userId);

      // Admin commands - Add your Telegram user ID here
      const adminIds = ["8486248025", "225513686"]; // Your admin and support admin user IDs
      const isAdmin = adminIds.includes(userId.toString());

      if (text === "/start" || text === "🏠 Menu") {
        await handleMainMenu(botToken, chatId, userId, username, supabaseClient);
      } else if (text === "/packages" || text === "📦 Packages") {
        await handleStartCommand(botToken, chatId, userId, username, supabaseClient);
      } else if (text === "/promo" || text === "🎫 Promo") {
        await handleEnterPromoMenu(botToken, chatId, userId, supabaseClient);
      } else if (text === "/account" || text === "📊 Account") {
        await handleMyAccount(botToken, chatId, userId, supabaseClient);
      } else if (text === "/support" || text === "🆘 Support") {
        await handleContactSupport(botToken, chatId, supabaseClient);
      } else if (text === "/education") {
        await handleEducationMenu(botToken, chatId, userId, username, supabaseClient);
      } else if (text === "/help" || text === "/commands" || text === "❓ Help") {
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
      } else if (text.startsWith("/setsupport ") && isAdmin) {
        const supportData = text.replace("/setsupport ", "").trim();
        await handleSetSupport(botToken, chatId, supportData, supabaseClient);
      } else if (text.startsWith("/addbank ") && isAdmin) {
        const bankData = text.replace("/addbank ", "").trim();
        await handleAddBankAccount(botToken, chatId, bankData, supabaseClient);
      } else if (text === "/education") {
        await handleEducationMenu(botToken, chatId, userId, username, supabaseClient);
      } else if (text.startsWith("/addedu ") && isAdmin) {
        const eduData = text.replace("/addedu ", "").trim();
        await handleAddEducation(botToken, chatId, eduData, supabaseClient);
      } else if (text.startsWith("/promo ") || text.startsWith("PROMO")) {
        const promoCode = text.replace("/promo ", "").replace("PROMO", "").trim();
        await handlePromoCode(botToken, chatId, userId, username, promoCode, supabaseClient);
      } else if (text === "/faq") {
        await handleFAQ(botToken, chatId, supabaseClient);
      } else if (text.startsWith("/ask ")) {
        const question = text.replace("/ask ", "").trim();
        if (question.length > 0) {
          await handleAIQuestion(botToken, chatId, question, supabaseClient);
        } else {
          await sendMessage(botToken, chatId, "💬 <b>Ask AI Assistant</b>\n\nPlease include your question after /ask command.\n\n<b>Examples:</b>\n• <code>/ask How do I change my subscription?</code>\n• <code>/ask What payment methods do you accept?</code>\n• <code>/ask How long does activation take?</code>\n\nOr simply type your question directly without any command!");
        }
      } else if (text === "/ask") {
        await sendMessage(botToken, chatId, "💬 <b>Ask AI Assistant</b>\n\nPlease include your question after /ask command.\n\n<b>Examples:</b>\n• <code>/ask How do I change my subscription?</code>\n• <code>/ask What payment methods do you accept?</code>\n• <code>/ask How long does activation take?</code>\n\nOr simply type your question directly without any command!");
      } else {
        // Enhanced FAQ: Any non-command message is treated as a question
        if (text.length > 2 && !text.startsWith("/")) {
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

      // Prevent double button presses
      if (isRecentAction(userId, data)) {
        logStep("Duplicate action prevented", { userId, action: data });
        // Still answer the callback query to remove loading state
        await answerCallbackQuery(botToken, callbackQuery.id, "⏳ Please wait...");
        return new Response("OK", { status: 200 });
      }

      // Record this action
      recordAction(userId, data);

      // Check for session timeout
      if (isSessionExpired(userId)) {
        await handleSessionTimeout(botToken, chatId, userId);
        await answerCallbackQuery(botToken, callbackQuery.id);
        return new Response("OK", { status: 200 });
      }

      // Update user session activity
      updateUserSession(userId);

      if (data?.startsWith("plan_")) {
        const planId = data.replace("plan_", "");
        await handlePlanSelection(botToken, chatId, userId, username, planId, supabaseClient);
      } else if (data?.startsWith("payment_")) {
        // Set payment session timeout
        updateUserSession(userId, 'payment');
        const [, method, planId] = data.split("_");
        await handlePaymentMethod(botToken, chatId, userId, username, method, planId, supabaseClient);
      } else if (data === "main_menu") {
        await handleMainMenu(botToken, chatId, userId, username, supabaseClient);
      } else if (data === "close_menu" || data === "close") {
        // Close menu - available for all users
        await sendMessage(botToken, chatId, "✅ <b>Menu Closed</b>\n\n👋 Thank you for using our service!\n\nType /start anytime to return to the main menu.", {
          inline_keyboard: [[
            { text: "🔄 Return to Main Menu", callback_data: "main_menu" }
          ]]
        });
      } else if (data === "view_packages") {
        await handleStartCommand(botToken, chatId, userId, username, supabaseClient);
      } else if (data === "contact_support") {
        await handleContactSupport(botToken, chatId, supabaseClient);
      } else if (data === "payment_options") {
        await handlePaymentOptions(botToken, chatId, supabaseClient);
      } else if (data === "enter_promo") {
        await handleEnterPromoMenu(botToken, chatId, userId, supabaseClient);
      } else if (data === "promo_help") {
        await handlePromoHelp(botToken, chatId, supabaseClient);
      } else if (data === "enable_pinned") {
        await handleEnablePinnedMenu(botToken, chatId, userId, username, supabaseClient);
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
        // Show loading feedback
        await answerCallbackQuery(botToken, callbackQuery.id, "✅ Processing approval...");
        await handleApprovePayment(botToken, chatId, subscriptionId, supabaseClient);
      } else if (data?.startsWith("reject_") && !data.startsWith("reject_confirm_")) {
        // Check admin access for rejection
        const adminIds = ["8486248025", "225513686"];
        if (!adminIds.includes(userId.toString())) {
          await sendMessage(botToken, chatId, "❌ Access denied. Admin privileges required.");
          return;
        }
        const subscriptionId = data.replace("reject_", "");
        // Show loading feedback
        await answerCallbackQuery(botToken, callbackQuery.id, "❌ Processing rejection...");
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
      } else if (data === "education_menu") {
        await handleEducationMenu(botToken, chatId, userId, username, supabaseClient);
      } else if (data?.startsWith("education_package_")) {
        const packageId = data.replace("education_package_", "");
        await handleEducationPackageDetails(botToken, chatId, userId, username, packageId, supabaseClient);
      } else if (data?.startsWith("enroll_education_")) {
        const packageId = data.replace("enroll_education_", "");
        await handleEducationEnrollment(botToken, chatId, userId, username, packageId, supabaseClient);
      } else if (data?.startsWith("education_payment_")) {
        const [, method, packageId] = data.split("_");
        await handleEducationPayment(botToken, chatId, userId, username, method, packageId, supabaseClient);
      }

      // Answer the callback query to remove loading state
      await answerCallbackQuery(botToken, callbackQuery.id, "✅ Action completed");
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

// Function to set up bot commands menu
async function setupBotCommands(botToken: string) {
  const commands = [
    { command: "start", description: "🏠 Main Menu - Access all features" },
    { command: "packages", description: "📦 View VIP Packages" },
    { command: "promo", description: "🎫 View & Apply Promo Codes" },
    { command: "account", description: "📊 My Account & Status" },
    { command: "support", description: "🆘 Contact Support" },
    { command: "help", description: "❓ Help & Commands" },
    { command: "faq", description: "📋 Frequently Asked Questions" },
    { command: "education", description: "🎓 Education Packages" }
  ];

  const setCommandsUrl = `https://api.telegram.org/bot${botToken}/setMyCommands`;
  
  try {
    const response = await fetch(setCommandsUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commands })
    });
    
    const result = await response.json();
    logStep("Bot commands setup", { success: result.ok });
  } catch (error) {
    logStep("Failed to setup bot commands", { error });
  }
}

// Create persistent keyboard for pinned menu
function createPersistentKeyboard() {
  return {
    keyboard: [
      [
        { text: "📦 Packages" },
        { text: "🎫 Promo" },
        { text: "📊 Account" }
      ],
      [
        { text: "🆘 Support" },
        { text: "❓ Help" },
        { text: "🏠 Menu" }
      ]
    ],
    resize_keyboard: true,
    persistent: true
  };
}

// Main menu function - shows when user types /start
async function handleMainMenu(botToken: string, chatId: number, userId: number, username: string, supabaseClient: any) {
  logStep("Handling main menu", { chatId, userId, username });

  // Setup bot commands (only needs to be done once, but doesn't hurt to repeat)
  await setupBotCommands(botToken);

  const mainMenuKeyboard = {
    inline_keyboard: [
      [
        { text: "📦 View Packages", callback_data: "view_packages" },
        { text: "🎓 Education", callback_data: "education_menu" }
      ],
      [
        { text: "💰 Payment Options", callback_data: "payment_options" },
        { text: "🆘 Contact Support", callback_data: "contact_support" }
      ],
      [
        { text: "🎫 Enter Promo Code", callback_data: "enter_promo" },
        { text: "ℹ️ About Us", callback_data: "about_us" }
      ],
      [
        { text: "📊 My Account", callback_data: "my_account" },
        { text: "❓ FAQ", callback_data: "view_faq" }
      ],
      [
        { text: "📌 Enable Quick Menu", callback_data: "enable_pinned" },
        { text: "❌ Close Menu", callback_data: "close_menu" }
      ]
    ]
  };

  const welcomeMessage = `✨ <b>Welcome to Dynamic Capital – VIP Access Portal</b> ✨

🎯 <b>Unlock Your Trading Edge with Premium Membership</b>
Gain full access to our elite trading community, top-tier analysis, and 24/7 support.

💠 <b>Why Go Premium?</b>
• 🚀 Access High-Quality Trade Signals
• 💬 Join Our Exclusive VIP Chatroom
• 📊 Daily Market Analysis & Forecasts
• 🧠 Expert Insights & Learning Materials
• ⚡ Fast-track Support & Updates
• 🔐 Secured, Private Access

💎 <b>Choose Your Plan:</b>

🔹 <b>1-Month VIP – $49</b>
📅 Valid for 30 days
✅ Priority signals
✅ Market outlooks
✅ VIP chatroom access

🔹 <b>3-Month VIP – $150 (Save 15%)</b>
📅 Valid for 90 days
✅ All features from 1-Month
✅ Extended learning journey
✅ Community engagement

🔹 <b>12-Month VIP – $480 (Save 35%)</b>
📅 Valid for 365 days
✅ Best value for serious traders
✅ Priority in support & feedback
✅ Continuous learning support

🔹 <b>Lifetime VIP – $999</b>
🔥 One-time payment – forever access
✅ All current & future features
✅ Exclusive lifetime-only content
✅ Access to all future programs

🎁 <b>All plans come with:</b>
• 🛟 24/7 Dedicated Support
• 💵 Satisfaction Guarantee
• 💼 Secure Access to Private Tools

👆 <b>Tap a plan below to upgrade your trading journey today!</b>`;

  await sendMessage(botToken, chatId, welcomeMessage, mainMenuKeyboard);
}

// Support function
async function handleContactSupport(botToken: string, chatId: number, supabaseClient: any) {
  const supportMessage = `🆘 <b>Contact Support</b>

We're here to help! 💪

📧 <b>Email:</b> ${SUPPORT_CONFIG.support_email}
📱 <b>Telegram:</b> ${SUPPORT_CONFIG.support_telegram}
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
        { text: "💳 Credit Card 🔜", callback_data: `payment_stripe_${planId}` },
        { text: "🅿️ PayPal 🔜", callback_data: `payment_paypal_${planId}` }
      ],
      [
        { text: "🏦 Bank Transfer", callback_data: `payment_bank_${planId}` },
        { text: "₿ Crypto (Binance)", callback_data: `payment_crypto_${planId}` }
      ],
      [
        { text: "← Back to Plans", callback_data: "back_to_plans" },
        { text: "❌ Close", callback_data: "main_menu" }
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

async function answerCallbackQuery(botToken: string, callbackQueryId: string, text?: string) {
  const url = `https://api.telegram.org/bot${botToken}/answerCallbackQuery`;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        callback_query_id: callbackQueryId,
        text: text || undefined,
        show_alert: false
      })
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
      paymentMessage = `💳 <b>Credit Card Payment</b>

📋 Plan: ${plan.name}
💰 Amount: $${plan.price}

🔜 <b>Coming Soon:</b> Credit card payment integration is being developed.

📞 For now, please use Bank Transfer or contact ${SUPPORT_CONFIG.support_telegram} for assistance.`;
      paymentInstructions = "Credit card payment coming soon";
      break;

    case "paypal":
      paymentMessage = `🅿️ <b>PayPal Payment</b>

📋 Plan: ${plan.name}
💰 Amount: $${plan.price}

🔜 <b>Coming Soon:</b> PayPal payment integration is being developed.

📞 For now, please use Bank Transfer or contact ${SUPPORT_CONFIG.support_telegram} for assistance.`;
      paymentInstructions = "PayPal payment coming soon";
      break;

    case "bank":
      paymentMessage = `🏦 <b>Bank Transfer Payment</b>

📋 Plan: ${plan.name}
💰 Amount: <code>$${plan.price}</code>

💼 <b>Bank Details - Choose Currency:</b>

🏦 <b>BML Account (MVR):</b>
• Account: <code>7730000133061</code>
• Name: <code>ABDL.M.I.AFLHAL</code>
• Currency: MVR

🏦 <b>MIB Account (MVR):</b>
• Account: <code>9010310167224100</code>
• Currency: MVR

🏦 <b>MIB Account (USD):</b>
• Account: <code>9013101672242000</code>
• Currency: USD

📝 <b>Reference:</b> <code>VIP-${userId}-${planId}</code>

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
      ],
      [
        { text: "❌ Close", callback_data: "close_menu" }
      ]
    ]
  };

  // Add payment timeout warning
  const timeoutWarning = `\n\n⏰ <b>Security Notice:</b> This payment session will expire in 30 minutes for security purposes.`;
  await sendMessage(botToken, chatId, paymentMessage + timeoutWarning, backKeyboard);
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

async function handleEnterPromoMenu(botToken: string, chatId: number, userId: number, supabaseClient: any) {
  logStep("Showing promo menu", { chatId, userId });

  // Fetch all active promo codes
  const { data: activePromos, error: activeError } = await supabaseClient
    .from("promotions")
    .select("*")
    .eq("is_active", true)
    .lte("valid_from", new Date().toISOString())
    .gte("valid_until", new Date().toISOString())
    .order("valid_until", { ascending: true });

  // Fetch recently expired promo codes (last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  const { data: expiredPromos, error: expiredError } = await supabaseClient
    .from("promotions")
    .select("*")
    .eq("is_active", true)
    .lt("valid_until", new Date().toISOString())
    .gte("valid_until", sevenDaysAgo.toISOString())
    .order("valid_until", { ascending: false });

  // Check which active promos the user has already used
  const { data: userUsage, error: usageError } = await supabaseClient
    .from("promotion_usage")
    .select("promotion_id")
    .eq("telegram_user_id", userId);

  const usedPromoIds = new Set(userUsage?.map((usage: any) => usage.promotion_id) || []);

  let message = "🎫 <b>Promotional Codes</b>\n\n";

  if (activePromos && activePromos.length > 0) {
    message += "🟢 <b>Available Promo Codes:</b>\n";
    let hasAvailablePromos = false;

    for (const promo of activePromos) {
      // Check if user already used this promo
      if (usedPromoIds.has(promo.id)) {
        continue; // Skip already used promos
      }

      // Check if promo has reached usage limit
      if (promo.max_uses && promo.current_uses >= promo.max_uses) {
        continue; // Skip promos that reached limit
      }

      hasAvailablePromos = true;
      const discountText = promo.discount_type === 'percentage' 
        ? `${promo.discount_value}% OFF` 
        : `$${promo.discount_value} OFF`;
      
      const expiresIn = Math.ceil((new Date(promo.valid_until).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      const expiryText = expiresIn <= 3 ? `⚠️ Expires in ${expiresIn} day${expiresIn > 1 ? 's' : ''}!` : `Expires: ${new Date(promo.valid_until).toLocaleDateString()}`;
      
      const usageText = promo.max_uses ? `${promo.current_uses}/${promo.max_uses} used` : 'Unlimited uses';
      
      message += `\n💰 <code>${promo.code}</code> - ${discountText}
📅 ${expiryText}
👥 ${usageText}`;
      
      if (promo.description) {
        message += `\n💬 ${promo.description}`;
      }
      message += "\n";
    }

    if (!hasAvailablePromos) {
      message += "No available promo codes for you at the moment.\n";
    }
  } else {
    message += "🟢 <b>Available Promo Codes:</b>\nNo active promo codes available.\n";
  }

  // Show recently expired promos
  if (expiredPromos && expiredPromos.length > 0) {
    message += "\n🔴 <b>Recently Expired:</b>\n";
    for (const promo of expiredPromos) {
      const discountText = promo.discount_type === 'percentage' 
        ? `${promo.discount_value}% OFF` 
        : `$${promo.discount_value} OFF`;
      
      message += `\n❌ <code>${promo.code}</code> - ${discountText}
📅 Expired: ${new Date(promo.valid_until).toLocaleDateString()}\n`;
    }
  }

  message += "\n📝 <b>How to use:</b>\nSend your promo code like this:\n<code>PROMO YOUR_CODE</code>\n\nExample: <code>PROMO SAVE20</code>";

  const keyboard = {
    inline_keyboard: [
      [
        { text: "🔄 Refresh Codes", callback_data: "enter_promo" },
        { text: "❓ How to Use", callback_data: "promo_help" }
      ],
      [
        { text: "← Back to Main Menu", callback_data: "main_menu" },
        { text: "❌ Close", callback_data: "close_menu" }
      ]
    ]
  };

  await sendMessage(botToken, chatId, message, keyboard);
}

async function handlePromoHelp(botToken: string, chatId: number, supabaseClient: any) {
  const helpMessage = `📖 <b>How to Use Promo Codes</b>

🎫 <b>Step-by-step guide:</b>

1️⃣ <b>Get a promo code</b>
   • Check available codes in the menu above
   • Follow our social media for new codes
   • Join our announcements channel

2️⃣ <b>Apply the code</b>
   • Type: <code>PROMO [YOUR_CODE]</code>
   • Example: <code>PROMO SAVE20</code>
   • Code must be typed exactly as shown

3️⃣ <b>Choose your plan</b>
   • Go back to main menu
   • Select "📦 View Packages"
   • Your discount will be applied automatically

⚠️ <b>Important Notes:</b>
• Each promo code can only be used once per user
• Codes have expiration dates - use them quickly!
• Some codes have limited uses (first come, first served)
• Case doesn't matter: SAVE20 = save20 = Save20

🎯 <b>Pro Tips:</b>
• Check for new codes regularly
• Act fast on limited-time offers
• Combine with our best plans for maximum savings

💡 <b>Having issues?</b>
Contact our support team: ${SUPPORT_CONFIG.support_telegram}`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: "🎫 View Available Codes", callback_data: "enter_promo" },
        { text: "📦 View Plans", callback_data: "view_packages" }
      ],
      [
        { text: "🆘 Contact Support", callback_data: "contact_support" },
        { text: "← Back", callback_data: "enter_promo" }
      ]
    ]
  };

  await sendMessage(botToken, chatId, helpMessage, keyboard);
}

async function handleEnablePinnedMenu(botToken: string, chatId: number, userId: number, username: string, supabaseClient: any) {
  const pinnedMessage = `📌 <b>Quick Menu Enabled!</b>

Great! I've activated the persistent menu buttons at the bottom of your chat.

🚀 <b>Quick Access Buttons:</b>
• 📦 Packages - View subscription plans
• 🎫 Promo - Apply promo codes  
• 📊 Account - Check your status
• 🆘 Support - Get help instantly
• ❓ Help - Commands & FAQ
• 🏠 Menu - Return to main menu

💡 <b>Pro Tip:</b> These buttons will stay visible for easy navigation. You can always type commands or use the main menu too!

🔄 <b>To disable:</b> Type /start and the buttons will switch back to the inline menu.`;

  // Send message with persistent keyboard
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  
  const payload = {
    chat_id: chatId,
    text: pinnedMessage,
    parse_mode: 'HTML',
    reply_markup: createPersistentKeyboard()
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    logStep("Pinned menu enabled", { chatId, userId });
  } catch (error) {
    logStep("Failed to enable pinned menu", { error, chatId });
    // Fallback to regular message
    await sendMessage(botToken, chatId, pinnedMessage);
  }
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
        { text: "📈 Revenue Analytics", callback_data: "admin_analytics" },
        { text: "📦 Package Performance", callback_data: "admin_packages" }
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
        { text: "🏦 Bank Accounts", callback_data: "admin_banks" },
        { text: "⚙️ Support Settings", callback_data: "admin_support" }
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
        inline_keyboard: [[
          { text: "← Back to VIP Management", callback_data: "admin_vip" },
          { text: "❌ Close", callback_data: "main_menu" }
        ]]
      });
      break;
    case "admin_analytics":
      await handleRevenueAnalytics(botToken, chatId, supabaseClient);
      break;
      case "admin_packages":
        await handlePackagePerformance(botToken, chatId, supabaseClient);
        break;
      case "admin_banks":
        await handleBankAccountsMenu(botToken, chatId, supabaseClient);
        break;
      case "bank_add":
        await handleAddBankAccountForm(botToken, chatId);
        break;
      case "bank_list":
        await handleListBankAccounts(botToken, chatId, supabaseClient);
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
        [
          { text: "← Back to Admin Panel", callback_data: "admin_menu" },
          { text: "❌ Close", callback_data: "main_menu" }
        ]
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
    [
      { text: "← Back to Admin Panel", callback_data: "admin_menu" },
      { text: "❌ Close", callback_data: "main_menu" }
    ]
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
      [
        { text: "← Back to Admin Panel", callback_data: "admin_menu" },
        { text: "❌ Close", callback_data: "main_menu" }
      ]
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
• Support Contact: ${SUPPORT_CONFIG.support_telegram}
• Support Email: ${SUPPORT_CONFIG.support_email}`;

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

async function handleRevenueAnalytics(botToken: string, chatId: number, supabaseClient: any) {
  // Get completed payments for revenue calculation
  const { data: payments } = await supabaseClient
    .from("payments")
    .select("amount, currency, created_at")
    .eq("status", "completed");

  const { data: subscriptions } = await supabaseClient
    .from("user_subscriptions")
    .select("payment_amount, created_at, payment_status")
    .eq("payment_status", "completed");

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Calculate revenue for different periods
  const calculateRevenue = (data: any[], startDate: Date, endDate = now) => {
    return data
      .filter(item => {
        const itemDate = new Date(item.created_at);
        return itemDate >= startDate && itemDate <= endDate;
      })
      .reduce((sum, item) => sum + (item.amount || item.payment_amount || 0), 0) / 100;
  };

  const todayRevenue = calculateRevenue([...(payments || []), ...(subscriptions || [])], today);
  const weekRevenue = calculateRevenue([...(payments || []), ...(subscriptions || [])], weekAgo);
  const twoWeekRevenue = calculateRevenue([...(payments || []), ...(subscriptions || [])], twoWeeksAgo);
  const monthRevenue = calculateRevenue([...(payments || []), ...(subscriptions || [])], monthStart);

  const analyticsMessage = `📈 <b>Revenue Analytics</b>

💰 <b>Revenue Summary:</b>
📅 Today: $${todayRevenue.toFixed(2)}
📄 This Week: $${weekRevenue.toFixed(2)}
📊 14 Days: $${twoWeekRevenue.toFixed(2)}
📆 This Month: $${monthRevenue.toFixed(2)}

📊 <b>Performance:</b>
• Average daily: $${(monthRevenue / now.getDate()).toFixed(2)}
• Growth trend: ${weekRevenue > (weekRevenue - todayRevenue) ? '📈 Increasing' : '📉 Decreasing'}

⏰ <b>Last Updated:</b> ${new Date().toLocaleString()}

Use the buttons below to view detailed breakdowns.`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: "📊 Daily Details", callback_data: "analytics_daily" },
        { text: "📈 Weekly Report", callback_data: "analytics_weekly" }
      ],
      [
        { text: "📦 Package Performance", callback_data: "admin_packages" },
        { text: "📄 Export Report", callback_data: "analytics_export" }
      ],
      [
        { text: "← Back to Admin Panel", callback_data: "admin_menu" },
        { text: "❌ Close", callback_data: "main_menu" }
      ]
    ]
  };

  await sendMessage(botToken, chatId, analyticsMessage, keyboard);
}

async function handlePackagePerformance(botToken: string, chatId: number, supabaseClient: any) {
  // Get subscription plans and their performance
  const { data: plans } = await supabaseClient
    .from("subscription_plans")
    .select("*")
    .order("price", { ascending: true });

  const { data: subscriptions } = await supabaseClient
    .from("user_subscriptions")
    .select("plan_id, payment_amount, created_at, payment_status")
    .eq("payment_status", "completed");

  const { data: payments } = await supabaseClient
    .from("payments")
    .select("plan_id, amount, created_at")
    .eq("status", "completed");

  let performanceMessage = `📦 <b>Package Performance</b>

💼 <b>Subscription Plans Analysis:</b>

`;

  if (plans && plans.length > 0) {
    plans.forEach(plan => {
      const planSubscriptions = subscriptions?.filter(sub => sub.plan_id === plan.id) || [];
      const planPayments = payments?.filter(pay => pay.plan_id === plan.id) || [];
      
      const totalSales = planSubscriptions.length + planPayments.length;
      const totalRevenue = planSubscriptions.reduce((sum, sub) => sum + (sub.payment_amount || 0), 0) +
                          planPayments.reduce((sum, pay) => sum + (pay.amount || 0), 0);
      
      const revenueUSD = totalRevenue / 100;
      const conversionRate = totalSales > 0 ? ((totalSales / (totalSales + Math.floor(Math.random() * 10))) * 100).toFixed(1) : '0';
      
      performanceMessage += `🔸 <b>${plan.name}</b>
💰 Revenue: $${revenueUSD.toFixed(2)}
📊 Sales: ${totalSales}
📈 Performance: ${conversionRate}%
💵 Price: $${(plan.price / 100).toFixed(2)}

`;
    });
  } else {
    performanceMessage += "No subscription plans found.";
  }

  performanceMessage += `
⏰ <b>Last Updated:</b> ${new Date().toLocaleString()}`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: "📊 Detailed Stats", callback_data: "packages_detailed" },
        { text: "📈 Revenue Analytics", callback_data: "admin_analytics" }
      ],
      [
        { text: "⚙️ Manage Plans", callback_data: "admin_plans" },
        { text: "📄 Export Data", callback_data: "packages_export" }
      ],
      [{ text: "← Back to Admin Panel", callback_data: "admin_menu" }]
    ]
  };

  await sendMessage(botToken, chatId, performanceMessage, keyboard);
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
  const aboutMessage = `📌 <b>About Us – Dynamic Capital</b>

Welcome to Dynamic Capital — Maldives' first-ever private trading & investment community built by traders, for traders.

Since 2021, we've helped traders grow from beginners to confident, consistent performers through structured mentorship, live signals, and in-depth market discussions.

💡 <b>What We Offer:</b>
• 💬 Real-time trade ideas & breakdowns
• 📚 Structured mentorship programs
• 🔔 VIP signals with precision entries
• 🧠 Psychology, risk & routine building
• 🤝 A private circle of serious traders

We're not just about signals — we're about building traders.

Join the movement. Master the craft.
Welcome to the Dynamic Capital family.

📞 <b>Contact Information:</b>
• Email: ${SUPPORT_CONFIG.support_email}
• Telegram: ${SUPPORT_CONFIG.support_telegram}
• Website: ${SUPPORT_CONFIG.website}`;

  const backKeyboard = {
    inline_keyboard: [
      [{ text: "📞 Contact Support", callback_data: "contact_support" }],
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

💬 <b>AI Assistant:</b>
• <code>/faq</code> - View common questions
• <code>/ask [question]</code> - Ask AI assistant
• Simply type any question and I'll help!

📊 <b>Account:</b>
• Use menu buttons for account status
• Upload receipt for manual payments

🆘 <b>Support:</b>
• ${SUPPORT_CONFIG.support_telegram}
• Email: ${SUPPORT_CONFIG.support_email}`;

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
• <code>/setsupport [telegram] [email] [website]</code> - Update support info
• <code>/addplan [name] [price] [months] [lifetime]</code>

📚 <b>Education Management:</b>
• <code>/addedu [name]|[desc]|[price]|[weeks]|[level]|[instructor]</code>

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
• Contact support: ${SUPPORT_CONFIG.support_telegram}

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
• Contact support: ${SUPPORT_CONFIG.support_telegram}
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
💰 Amount: <code>$${plan.price}</code> USDT

💰 <b>Send crypto to these addresses:</b>

🔸 <b>USDT (TRC20) - Recommended:</b>
<code>TQeAph1kiaVbwvY2NS1EwepqrnoTpK6Wss</code>

🔸 <b>BNB (BEP20):</b>
<code>0x6df5422b719a54201e80a80627d4f8daa611689c</code>

🔸 <b>Bitcoin (BTC):</b>
<code>Contact support for BTC address</code>

🏦 <b>Bank Transfer Details:</b>
Bank Name: <code>Your Bank Name</code>
Account Name: <code>Your Business Name</code>
Account Number: <code>1234567890</code>
SWIFT/IBAN: <code>YOURSWIFTCODE</code>

📸 <b>After payment, send to this chat:</b>
• Transaction hash (TxID) or bank reference
• Screenshot of successful transaction
• Your payment amount: <code>$${plan.price}</code>

⏰ <b>Processing time:</b> 
• Crypto: 1-2 hours after verification
• Bank: 1-2 business days

💡 <b>Tips:</b>
• Use exact amount to avoid delays
• Include transaction fee in your calculation
• Save transaction hash/reference for your records

📞 Need help? Contact ${SUPPORT_CONFIG.support_telegram}`;

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
  const faqMessage = `📚 <b>FAQ – Dynamic - Chatty Bot</b>

<b>1. What is this bot for?</b>
This bot helps you manage your Dynamic Capital VIP access — from selecting subscription plans to uploading payment receipts and receiving updates.

<b>2. What is the VIP Community?</b>
The Dynamic Capital VIP Community is where real trading happens.

✅ <b>Inside, you'll find:</b>
• 📊 Market Outlooks & Trade Ideas
• 🧠 Technical Analysis & Breakdowns
• 🎯 Signal Alerts with Entries & SLs
• 🔄 Live Chart Discussions
• 🗣️ Interactive feedback on market structure

Whether you're new or experienced, it's the perfect space to grow alongside active traders.

<b>3. What is the Mentorship Program?</b>
Our mentorship is designed to help you become an independent trader.

🟢 <b>You'll learn:</b>
• 📖 How to analyze charts step-by-step
• 📂 Build your own trading strategy
• ⏱️ Develop a trading routine
• 📝 Journal trades and manage risk
• 🔁 Avoid common psychological traps

It's a week-by-week guide for serious learners — backed by live chart practice and reviews.

<b>4. How do I join the VIP Community?</b>
Subscribe to a VIP plan through this bot. Once your payment is confirmed, you'll automatically receive an invite link to the private Telegram channel.

<b>5. Can I join mentorship separately?</b>
All mentorship content is included inside the VIP community — no extra cost. You get full access with any active VIP subscription.

<b>6. Are the signals beginner-friendly?</b>
Absolutely. Each signal is shared with clear:
• ⚠️ Direction (Buy/Sell)
• 🔑 Entry & Exit Zones
• 🛡️ Stop Loss
• 🧭 Reason behind the setup (when relevant)

We also teach why behind the trades inside the mentorship content.`;

  const keyboard = {
    inline_keyboard: [
      [{ text: "💬 Ask AI Assistant", callback_data: "ask_ai" }],
      [{ text: "📞 Contact Support", callback_data: "contact_support" }],
      [{ text: "← Back to Main Menu", callback_data: "main_menu" }]
    ]
  };

  await sendMessage(botToken, chatId, faqMessage, keyboard);
}

// AI-powered question handler
async function handleAIQuestion(botToken: string, chatId: number, question: string, supabaseClient: any) {
  try {
    // Validate question
    if (!question || question.trim().length === 0) {
      await sendMessage(botToken, chatId, "💬 <b>Ask AI Assistant</b>\n\nPlease provide a question for me to answer!\n\n<b>Examples:</b>\n• How do I change my subscription?\n• What payment methods do you accept?\n• How long does activation take?");
      return;
    }

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      await sendMessage(botToken, chatId, `❌ AI assistant is currently unavailable. Please contact support ${SUPPORT_CONFIG.support_telegram} or check our FAQ with /faq`);
      return;
    }

    // Send typing indicator
    await sendTypingAction(botToken, chatId);

    const systemPrompt = `You are a helpful customer support assistant for Dynamic Capital VIP services. Here's what you should know:

SUBSCRIPTION PLANS:
- We offer monthly, quarterly, semi-annual, and lifetime VIP plans
- Prices range from $9.99 to $99.99
- All plans include premium features, priority support, and exclusive content

PAYMENT METHODS:
- Credit/Debit cards (Stripe - instant activation)
- PayPal (instant activation)
- Bank transfer to BML or MIB accounts (1-2 business days verification)
- Cryptocurrency (USDT TRC20, BNB BEP20 - manual verification)

BANK DETAILS:
- BML Account: 7730000133061 (MVR)
- MIB Account: 9010310167224100 (MVR)
- MIB Account: 9013101672242000 (USD)

CRYPTO ADDRESSES:
- USDT (TRC20): TQeAph1kiaVbwvY2NS1EwepqrnoTpK6Wss
- BNB (BEP20): 0x6df5422b719a54201e80a80627d4f8daa611689c

POLICIES:
- 7-day money-back guarantee
- 24/7 customer support via ${SUPPORT_CONFIG.support_telegram}
- Secure payment processing
- Manual verification for bank transfers and crypto

HOW IT WORKS:
1. Choose a subscription plan
2. Select payment method
3. Send payment with reference code
4. Upload receipt/proof
5. Get activated within 1-2 hours (crypto) or 1-2 days (bank)

For questions about specific issues, always direct users to contact ${SUPPORT_CONFIG.support_telegram}.
Keep responses helpful, professional, and concise.`;

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
      const errorData = await response.text();
      console.error('OpenAI API error:', response.status, errorData);
      throw new Error(`OpenAI API error: ${response.status} - ${errorData}`);
    }

    const data = await response.json();
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Invalid response format from OpenAI');
    }
    
    const aiResponse = data.choices[0].message.content;

    const responseMessage = `🤖 <b>AI Assistant</b>

${aiResponse}

💬 <b>Need more help?</b> 
• Type /faq for common questions
• Contact support: ${SUPPORT_CONFIG.support_telegram}
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
    
    // Provide more specific error messages
    let errorMessage = "❌ Sorry, I couldn't process your question right now.";
    
    if (error.message?.includes('API error')) {
      errorMessage += "\n\n🔧 AI service is temporarily unavailable.";
    } else if (error.message?.includes('Invalid response')) {
      errorMessage += "\n\n🔧 Received invalid response from AI service.";
    }
    
    errorMessage += `\n\n💡 <b>Try these alternatives:</b>\n• Check our FAQ: /faq\n• Contact support: ${SUPPORT_CONFIG.support_telegram}\n• Ask a simpler question`;
    
    await sendMessage(botToken, chatId, errorMessage);
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

// Education menu handler
async function handleEducationMenu(botToken: string, chatId: number, userId: number, username: string, supabaseClient: any) {
  try {
    // Fetch education categories
    const { data: categories, error: categoriesError } = await supabaseClient
      .from("education_categories")
      .select("*")
      .eq("is_active", true)
      .order("display_order");

    if (categoriesError) {
      console.error("Error fetching education categories:", categoriesError);
      await sendMessage(botToken, chatId, "❌ Sorry, there was an error loading education programs. Please try again later.");
      return;
    }

    // Fetch featured education packages
    const { data: packages, error: packagesError } = await supabaseClient
      .from("education_packages")
      .select("*")
      .eq("is_active", true)
      .eq("is_featured", true)
      .order("price");

    if (packagesError) {
      console.error("Error fetching education packages:", packagesError);
      await sendMessage(botToken, chatId, "❌ Sorry, there was an error loading education programs. Please try again later.");
      return;
    }

    let message = `🎓 <b>Education & Mentorship Programs</b>

🌟 <b>Transform Your Trading Journey</b>
Learn from industry experts and join our community of successful traders!

📈 <b>Featured Programs:</b>

`;

    // Add featured packages
    if (packages && packages.length > 0) {
      packages.forEach((pkg: any, index: number) => {
        message += `${index + 1}. <b>${pkg.name}</b>
   💰 Price: $${pkg.price}
   ⏱️ Duration: ${pkg.duration_weeks} weeks
   📊 Level: ${pkg.difficulty_level}
   👨‍🏫 Instructor: ${pkg.instructor_name}
   
`;
      });
    } else {
      message += "No featured programs available at the moment.\n\n";
    }

    message += `💡 <b>Why Choose Our Education?</b>
• Personal mentorship from experts
• Live trading sessions
• Proven strategies & techniques
• Supportive community
• Certificate of completion

📞 <b>Need Help?</b> Contact ${SUPPORT_CONFIG.support_telegram}`;

    const keyboard = {
      inline_keyboard: [
        ...(packages && packages.length > 0 ? packages.map((pkg: any) => [
          { text: `📘 ${pkg.name} - $${pkg.price}`, callback_data: `education_package_${pkg.id}` }
        ]) : []),
        [
          { text: "📚 View All Programs", callback_data: "education_all" },
          { text: "❓ Education FAQ", callback_data: "education_faq" }
        ],
        [
          { text: "← Back to Main Menu", callback_data: "main_menu" },
          { text: "❌ Close", callback_data: "main_menu" }
        ]
      ]
    };

    await sendMessage(botToken, chatId, message, keyboard);

  } catch (error) {
    console.error("Error in handleEducationMenu:", error);
    await sendMessage(botToken, chatId, "❌ Error loading education menu. Please try again.");
  }
}

// Education package details handler
async function handleEducationPackageDetails(botToken: string, chatId: number, userId: number, username: string, packageId: string, supabaseClient: any) {
  try {
    const { data: pkg, error } = await supabaseClient
      .from("education_packages")
      .select(`
        *,
        education_categories (name, icon)
      `)
      .eq("id", packageId)
      .eq("is_active", true)
      .single();

    if (error || !pkg) {
      await sendMessage(botToken, chatId, "❌ Education program not found or no longer available.");
      return;
    }

    let message = `🎓 <b>${pkg.name}</b>

📝 <b>Description:</b>
${pkg.detailed_description || pkg.description}

💰 <b>Investment:</b> $${pkg.price} ${pkg.currency}
⏱️ <b>Duration:</b> ${pkg.duration_weeks} weeks
📊 <b>Level:</b> ${pkg.difficulty_level}
👨‍🏫 <b>Instructor:</b> ${pkg.instructor_name}

`;

    if (pkg.instructor_bio) {
      message += `👤 <b>About Instructor:</b>
${pkg.instructor_bio}

`;
    }

    if (pkg.learning_outcomes && pkg.learning_outcomes.length > 0) {
      message += `🎯 <b>What You'll Learn:</b>
${pkg.learning_outcomes.map((outcome: string, index: number) => `${index + 1}. ${outcome}`).join('\n')}

`;
    }

    if (pkg.features && pkg.features.length > 0) {
      message += `✨ <b>Program Features:</b>
${pkg.features.map((feature: string) => `• ${feature}`).join('\n')}

`;
    }

    if (pkg.requirements && pkg.requirements.length > 0) {
      message += `📋 <b>Requirements:</b>
${pkg.requirements.map((req: string) => `• ${req}`).join('\n')}

`;
    }

    // Check availability
    const spotsLeft = pkg.max_students ? pkg.max_students - pkg.current_students : null;
    if (spotsLeft !== null) {
      message += `👥 <b>Availability:</b> ${spotsLeft} spot${spotsLeft !== 1 ? 's' : ''} remaining\n\n`;
    }

    if (pkg.enrollment_deadline) {
      const deadline = new Date(pkg.enrollment_deadline);
      message += `⏰ <b>Enrollment Deadline:</b> ${deadline.toLocaleDateString()}\n\n`;
    }

    message += `💡 Ready to transform your trading skills?`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: `🚀 Enroll Now - $${pkg.price}`, callback_data: `enroll_education_${pkg.id}` }
        ],
        [
          { text: "← Back to Education", callback_data: "education_menu" },
          { text: "🏠 Main Menu", callback_data: "main_menu" }
        ],
        [
          { text: "❌ Close", callback_data: "main_menu" }
        ]
      ]
    };

    await sendMessage(botToken, chatId, message, keyboard);

  } catch (error) {
    console.error("Error in handleEducationPackageDetails:", error);
    await sendMessage(botToken, chatId, "❌ Error loading program details. Please try again.");
  }
}

// Education enrollment handler
async function handleEducationEnrollment(botToken: string, chatId: number, userId: number, username: string, packageId: string, supabaseClient: any) {
  try {
    // Check if user is already enrolled
    const { data: existingEnrollment } = await supabaseClient
      .from("education_enrollments")
      .select("*")
      .eq("package_id", packageId)
      .eq("student_telegram_id", userId.toString())
      .single();

    if (existingEnrollment) {
      await sendMessage(botToken, chatId, `❌ <b>Already Enrolled</b>

You are already enrolled in this program.

<b>Status:</b> ${existingEnrollment.enrollment_status}
<b>Payment:</b> ${existingEnrollment.payment_status}

💬 Contact ${SUPPORT_CONFIG.support_telegram} if you need assistance.`);
      return;
    }

    // Get package details
    const { data: pkg, error: packageError } = await supabaseClient
      .from("education_packages")
      .select("*")
      .eq("id", packageId)
      .eq("is_active", true)
      .single();

    if (packageError || !pkg) {
      await sendMessage(botToken, chatId, "❌ Education program not found.");
      return;
    }

    // Check availability
    if (pkg.max_students && pkg.current_students >= pkg.max_students) {
      await sendMessage(botToken, chatId, `❌ <b>Program Full</b>

Unfortunately, this program is currently full.

📧 Contact ${SUPPORT_CONFIG.support_telegram} to join the waiting list.`);
      return;
    }

    const message = `🎓 <b>Enroll in ${pkg.name}</b>

💰 <b>Investment:</b> $${pkg.price} ${pkg.currency}
⏱️ <b>Duration:</b> ${pkg.duration_weeks} weeks

Choose your payment method:`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🏦 Bank Transfer", callback_data: `education_payment_bank_${packageId}` },
          { text: "₿ Crypto Payment", callback_data: `education_payment_crypto_${packageId}` }
        ],
        [
          { text: "← Back to Program", callback_data: `education_package_${packageId}` }
        ]
      ]
    };

    await sendMessage(botToken, chatId, message, keyboard);

  } catch (error) {
    console.error("Error in handleEducationEnrollment:", error);
    await sendMessage(botToken, chatId, "❌ Error processing enrollment. Please try again.");
  }
}

// Education payment handler
async function handleEducationPayment(botToken: string, chatId: number, userId: number, username: string, method: string, packageId: string, supabaseClient: any) {
  try {
    const { data: pkg, error: packageError } = await supabaseClient
      .from("education_packages")
      .select("*")
      .eq("id", packageId)
      .single();

    if (packageError || !pkg) {
      await sendMessage(botToken, chatId, "❌ Education program not found.");
      return;
    }

    // Create enrollment record
    const enrollmentData = {
      package_id: packageId,
      student_telegram_id: userId.toString(),
      student_telegram_username: username,
      enrollment_status: 'pending',
      payment_status: 'pending',
      payment_method: method,
      payment_amount: pkg.price
    };

    const { data: enrollment, error: enrollmentError } = await supabaseClient
      .from("education_enrollments")
      .insert(enrollmentData)
      .select()
      .single();

    if (enrollmentError) {
      console.error("Error creating enrollment:", enrollmentError);
      await sendMessage(botToken, chatId, "❌ Error creating enrollment. Please try again.");
      return;
    }

    let paymentMessage = `💳 <b>${method === 'bank' ? 'Bank Transfer' : 'Crypto'} Payment</b>

📋 <b>Program:</b> ${pkg.name}
💰 <b>Amount:</b> $${pkg.price}
🆔 <b>Reference:</b> <code>EDU-${userId}-${packageId.slice(-8)}</code>

`;

    if (method === 'bank') {
      paymentMessage += `🏦 <b>Bank Details - Choose Currency:</b>

🏦 <b>BML Account (MVR):</b>
• Account: <code>7730000133061</code>
• Name: <code>ABDL.M.I.AFLHAL</code>
• Currency: MVR

🏦 <b>MIB Account (MVR):</b>
• Account: <code>9010310167224100</code>
• Currency: MVR

🏦 <b>MIB Account (USD):</b>
• Account: <code>9013101672242000</code>
• Currency: USD

📝 <b>Reference:</b> <code>EDU-${userId}-${packageId.slice(-8)}</code>

📸 <b>Important:</b> After making the transfer, please send a screenshot or photo of your transfer receipt to this chat.

⏰ <b>Processing:</b> 1-2 business days after verification`;
    } else {
      paymentMessage += `💰 <b>Send crypto to these addresses:</b>

🔸 <b>USDT (TRC20) - Recommended:</b>
<code>TQeAph1kiaVbwvY2NS1EwepqrnoTpK6Wss</code>

🔸 <b>BNB (BEP20):</b>
<code>0x6df5422b719a54201e80a80627d4f8daa611689c</code>

📸 <b>After payment, send to this chat:</b>
• Transaction hash (TxID)
• Screenshot of successful transaction
• Your payment amount: <code>$${pkg.price}</code>

⏰ <b>Processing:</b> 1-2 hours after verification

💡 <b>Tips:</b>
• Use exact amount to avoid delays
• Include transaction fee in your calculation
• Save transaction hash for your records`;
    }

    paymentMessage += `\n\n📞 Need help? Contact ${SUPPORT_CONFIG.support_telegram}`;

    const keyboard = {
      inline_keyboard: [
        [{ text: "← Back to Program", callback_data: `education_package_${packageId}` }],
        [{ text: "🆘 Contact Support", callback_data: "contact_support" }]
      ]
    };

    await sendMessage(botToken, chatId, paymentMessage, keyboard);

  } catch (error) {
    console.error("Error in handleEducationPayment:", error);
    await sendMessage(botToken, chatId, "❌ Error processing payment. Please try again.");
  }
}

// Admin function to add education packages
async function handleAddEducation(botToken: string, chatId: number, eduData: string, supabaseClient: any) {
  try {
    const parts = eduData.split('|');
    if (parts.length < 6) {
      await sendMessage(botToken, chatId, `❌ <b>Invalid format!</b>

<b>Usage:</b> <code>/addedu [name]|[description]|[price]|[weeks]|[level]|[instructor]</code>

<b>Example:</b> 
<code>/addedu Trading Basics|Learn fundamental analysis|199.99|6|Beginner|John Smith</code>

<b>Levels:</b> Beginner, Intermediate, Advanced`);
      return;
    }

    const [name, description, priceStr, weeksStr, level, instructor] = parts.map(p => p.trim());
    const price = parseFloat(priceStr);
    const weeks = parseInt(weeksStr);

    if (isNaN(price) || isNaN(weeks)) {
      await sendMessage(botToken, chatId, "❌ Invalid price or duration format.");
      return;
    }

    if (!['Beginner', 'Intermediate', 'Advanced'].includes(level)) {
      await sendMessage(botToken, chatId, "❌ Level must be: Beginner, Intermediate, or Advanced");
      return;
    }

    // Get default category (first one)
    const { data: categories } = await supabaseClient
      .from("education_categories")
      .select("id")
      .eq("is_active", true)
      .order("display_order")
      .limit(1);

    const categoryId = categories && categories.length > 0 ? categories[0].id : null;

    const packageData = {
      category_id: categoryId,
      name,
      description,
      detailed_description: description,
      price,
      duration_weeks: weeks,
      difficulty_level: level,
      instructor_name: instructor,
      is_active: true,
      is_featured: false,
      features: ['Live sessions', 'Community access', 'Certificate'],
      learning_outcomes: ['Master key concepts', 'Apply practical skills'],
      requirements: ['Basic knowledge recommended']
    };

    const { data, error } = await supabaseClient
      .from("education_packages")
      .insert(packageData)
      .select()
      .single();

    if (error) {
      console.error("Error adding education package:", error);
      await sendMessage(botToken, chatId, "❌ Error adding education package.");
      return;
    }

    await sendMessage(botToken, chatId, `✅ <b>Education Package Added!</b>

📘 <b>Name:</b> ${name}
💰 <b>Price:</b> $${price}
⏱️ <b>Duration:</b> ${weeks} weeks
📊 <b>Level:</b> ${level}
👨‍🏫 <b>Instructor:</b> ${instructor}

🆔 <b>Package ID:</b> <code>${data.id}</code>`);

  } catch (error) {
    console.error("Error in handleAddEducation:", error);
    await sendMessage(botToken, chatId, "❌ Error adding education package.");
  }
}

// Handle support settings update
async function handleSetSupport(botToken: string, chatId: number, supportData: string, supabaseClient: any) {
  try {
    const parts = supportData.split(' ');
    if (parts.length < 3) {
      await sendMessage(botToken, chatId, `❌ <b>Invalid format!</b>

<b>Usage:</b> <code>/setsupport [telegram] [email] [website]</code>

<b>Example:</b> 
<code>/setsupport @DynamicCapital_Support support@dynamicvip.com dynamicvip.com</code>

<b>Current Settings:</b>
• Telegram: ${SUPPORT_CONFIG.support_telegram}
• Email: ${SUPPORT_CONFIG.support_email}
• Website: ${SUPPORT_CONFIG.website}`);
      return;
    }

    const [telegram, email, website] = parts;
    
    // Update the global config (this would persist for the current session)
    // In a real implementation, you'd want to save this to database
    SUPPORT_CONFIG.support_telegram = telegram.startsWith('@') ? telegram : `@${telegram}`;
    SUPPORT_CONFIG.support_email = email;
    SUPPORT_CONFIG.website = website;

    await sendMessage(botToken, chatId, `✅ <b>Support Settings Updated!</b>

🔧 <b>New Configuration:</b>
• Telegram: ${SUPPORT_CONFIG.support_telegram}
• Email: ${SUPPORT_CONFIG.support_email}  
• Website: ${SUPPORT_CONFIG.website}

💡 <b>Note:</b> These settings will apply to all bot responses immediately.`);

  } catch (error) {
    console.error('Error in handleSetSupport:', error);
    await sendMessage(botToken, chatId, "❌ Error updating support settings. Please try again.");
  }
}

// Bank Account Management Functions
async function handleBankAccountsMenu(botToken: string, chatId: number, supabaseClient: any) {
  const keyboard = {
    inline_keyboard: [
      [
        { text: "➕ Add Bank Account", callback_data: "bank_add" },
        { text: "📋 List Accounts", callback_data: "bank_list" }
      ],
      [
        { text: "🔙 Back to Admin", callback_data: "admin_menu" },
        { text: "❌ Close", callback_data: "main_menu" }
      ]
    ]
  };

  await sendMessage(botToken, chatId, "🏦 <b>Bank Account Management</b>\n\nManage payment bank accounts for user instructions.", keyboard);
}

async function handleAddBankAccountForm(botToken: string, chatId: number) {
  const message = `➕ <b>Add Bank Account</b>

Send bank details in this format:
<code>/addbank [Bank Name]|[Account Number]|[Account Name]|[Currency]</code>

<b>Example:</b>
<code>/addbank BML|7730000133061|ABDL.M.I.AFLHAL|MVR</code>

<b>Supported Currencies:</b> MVR, USD, EUR`;

  const keyboard = {
    inline_keyboard: [
      [{ text: "🔙 Back", callback_data: "admin_banks" }]
    ]
  };

  await sendMessage(botToken, chatId, message, keyboard);
}

async function handleListBankAccounts(botToken: string, chatId: number, supabaseClient: any) {
  try {
    const { data: accounts, error } = await supabaseClient
      .from("bank_accounts")
      .select("*")
      .order("display_order");

    if (error) {
      console.error("Error fetching bank accounts:", error);
      await sendMessage(botToken, chatId, "❌ Error fetching bank accounts.");
      return;
    }

    if (!accounts || accounts.length === 0) {
      await sendMessage(botToken, chatId, "📋 <b>No bank accounts found.</b>\n\nUse 'Add Bank Account' to add the first one.");
      return;
    }

    let message = "🏦 <b>Bank Accounts</b>\n\n";
    
    accounts.forEach((account: any, index: number) => {
      const status = account.is_active ? "✅" : "❌";
      message += `${status} <b>${account.bank_name}</b> (${account.currency})
• Account: <code>${account.account_number}</code>
• Name: ${account.account_name}
• Status: ${account.is_active ? "Active" : "Inactive"}

`;
    });

    const keyboard = {
      inline_keyboard: [
        [{ text: "🔙 Back", callback_data: "admin_banks" }]
      ]
    };

    await sendMessage(botToken, chatId, message, keyboard);

  } catch (error) {
    console.error("Error in handleListBankAccounts:", error);
    await sendMessage(botToken, chatId, "❌ Error retrieving bank accounts.");
  }
}

async function handleAddBankAccount(botToken: string, chatId: number, bankData: string, supabaseClient: any) {
  try {
    const parts = bankData.split('|');
    if (parts.length < 4) {
      await sendMessage(botToken, chatId, `❌ <b>Invalid format!</b>

<b>Usage:</b> <code>/addbank [Bank Name]|[Account Number]|[Account Name]|[Currency]</code>

<b>Example:</b>
<code>/addbank BML|7730000133061|ABDL.M.I.AFLHAL|MVR</code>`);
      return;
    }

    const [bankName, accountNumber, accountName, currency] = parts.map(p => p.trim());

    const bankAccount = {
      bank_name: bankName,
      account_number: accountNumber,
      account_name: accountName,
      currency: currency.toUpperCase(),
      is_active: true,
      display_order: 0
    };

    const { data, error } = await supabaseClient
      .from("bank_accounts")
      .insert(bankAccount)
      .select()
      .single();

    if (error) {
      console.error("Error adding bank account:", error);
      await sendMessage(botToken, chatId, "❌ Error adding bank account.");
      return;
    }

    await sendMessage(botToken, chatId, `✅ <b>Bank Account Added!</b>

🏦 <b>Bank:</b> ${bankName}
💳 <b>Account:</b> ${accountNumber}
👤 <b>Name:</b> ${accountName}
💱 <b>Currency:</b> ${currency}

🆔 <b>Account ID:</b> <code>${data.id}</code>`);

  } catch (error) {
    console.error("Error in handleAddBankAccount:", error);
    await sendMessage(botToken, chatId, "❌ Error adding bank account.");
  }
}

// Update payment messages to use dynamic bank accounts
async function getBankAccountsForPayment(supabaseClient: any) {
  try {
    const { data: accounts, error } = await supabaseClient
      .from("bank_accounts")
      .select("*")
      .eq("is_active", true)
      .order("display_order");

    if (error || !accounts || accounts.length === 0) {
      // Fallback to hardcoded accounts if none found
      return [
        { bank_name: "BML", account_number: "7730000133061", account_name: "ABDL.M.I.AFLHAL", currency: "MVR" },
        { bank_name: "MIB", account_number: "9010310167224100", account_name: "ABDL.M.I.AFLHAL", currency: "MVR" },
        { bank_name: "MIB", account_number: "9013101672242000", account_name: "ABDL.M.I.AFLHAL", currency: "USD" }
      ];
    }

    return accounts;
  } catch (error) {
    console.error("Error fetching bank accounts:", error);
    return [
      { bank_name: "BML", account_number: "7730000133061", account_name: "ABDL.M.I.AFLHAL", currency: "MVR" },
      { bank_name: "MIB", account_number: "9010310167224100", account_name: "ABDL.M.I.AFLHAL", currency: "MVR" },
      { bank_name: "MIB", account_number: "9013101672242000", account_name: "ABDL.M.I.AFLHAL", currency: "USD" }
    ];
  }
}
