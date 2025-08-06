/* eslint-disable no-case-declarations */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getFormattedVipPackages } from "./database-utils.ts";
import { 
  handleTableManagement, 
  handleUserTableManagement, 
  handleSubscriptionPlansManagement, 
  handleEducationPackagesManagement, 
  handlePromotionsManagement, 
  handleContentManagement, 
  handleBotSettingsManagement, 
  handleTableStatsOverview 
} from "./admin-handlers.ts";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const BOT_START_TIME = new Date();

console.log("🚀 Bot starting with environment check...");
console.log("TELEGRAM_BOT_TOKEN exists:", !!TELEGRAM_BOT_TOKEN);
console.log("SUPABASE_URL exists:", !!SUPABASE_URL);
console.log("SUPABASE_SERVICE_ROLE_KEY exists:", !!SUPABASE_SERVICE_ROLE_KEY);
console.log("🕐 Bot started at:", BOT_START_TIME.toISOString());

if (!TELEGRAM_BOT_TOKEN || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Missing required environment variables");
  throw new Error("Missing required environment variables");
}

const supabaseAdmin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

// Admin user IDs - including the user who's testing
const ADMIN_USER_IDS = new Set(["225513686"]);

// User sessions for features
const userSessions = new Map();
const activeBotSessions = new Map(); // Track bot sessions

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple sendMessage function
async function sendMessage(
  chatId: number,
  text: string,
  replyMarkup?: Record<string, unknown>,
  mediaUrl?: string,
  mediaType?: 'photo' | 'video'
) {
  let url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  let payload: any = {
    chat_id: chatId,
    text: text,
    reply_markup: replyMarkup,
    parse_mode: "Markdown"
  };

  // Handle media messages
  if (mediaUrl && mediaType) {
    if (mediaType === 'photo') {
      url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`;
      payload = {
        chat_id: chatId,
        photo: mediaUrl,
        caption: text,
        reply_markup: replyMarkup,
        parse_mode: "Markdown"
      };
    } else if (mediaType === 'video') {
      url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendVideo`;
      payload = {
        chat_id: chatId,
        video: mediaUrl,
        caption: text,
        reply_markup: replyMarkup,
        parse_mode: "Markdown"
      };
    }
  }

  try {
    console.log(`📤 Sending message to ${chatId}: ${text.substring(0, 100)}...`);
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("❌ Telegram API error:", errorData);
      return null;
    }

    const result = await response.json();
    console.log(`✅ Message sent successfully to ${chatId}`);
    return result;

  } catch (error) {
    console.error("🚨 Main error in sendMessage:", error);
    return null;
  }
}

// Simple welcome message
async function getWelcomeMessage(firstName: string): Promise<string> {
  return `🌟 **Welcome to Dynamic Capital VIP!** 🌟

Hi ${firstName}! 👋

🚀 **Ready to transform your trading journey?**

💎 **What we offer:**
• Premium VIP trading signals
• Expert market analysis
• Exclusive trading strategies
• Personal mentorship
• 24/7 support

📈 **Join thousands of successful traders!**

👇 **Choose your path to success:**`;
}

// Simple main menu keyboard
async function getMainMenuKeyboard(): Promise<any> {
  return {
    inline_keyboard: [
      [
        { text: "💎 VIP Packages", callback_data: "view_packages" },
        { text: "📚 Education", callback_data: "view_education" }
      ],
      [
        { text: "🎯 Promotions", callback_data: "view_promotions" },
        { text: "❓ Help", callback_data: "help" }
      ],
      [
        { text: "📞 Support", callback_data: "support" },
        { text: "ℹ️ About Us", callback_data: "about" }
      ]
    ]
  };
}

function isAdmin(userId: string): boolean {
  return ADMIN_USER_IDS.has(userId);
}

// Main serve function
serve(async (req) => {
  console.log(`📥 Request received: ${req.method} ${req.url}`);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method === "GET") {
    const uptimeMinutes = Math.floor((Date.now() - BOT_START_TIME.getTime()) / 1000 / 60);
    return new Response(
      `🚀 Enhanced Dynamic Capital Bot is live!\n\n⏰ Uptime: ${uptimeMinutes} minutes\n🔑 Admins: ${ADMIN_USER_IDS.size}`, 
      { status: 200, headers: corsHeaders }
    );
  }

  try {
    const body = await req.json();
    console.log("📨 Received update:", JSON.stringify(body, null, 2));

    // Handle webhook updates
    if (body.message) {
      const message = body.message;
      const chatId = message.chat.id;
      const userId = message.from.id.toString();
      const firstName = message.from.first_name || "User";
      const text = message.text || "";

      console.log(`💬 Message from ${firstName} (${userId}): ${text}`);

      // Handle /start command
      if (text === '/start') {
        console.log(`🚀 Start command from: ${userId} (${firstName})`);
        
        const welcomeMessage = await getWelcomeMessage(firstName);
        const keyboard = await getMainMenuKeyboard();
        await sendMessage(chatId, welcomeMessage, keyboard);
        return new Response("OK", { status: 200 });
      }

      // Handle /admin command
      if (text === '/admin') {
        if (isAdmin(userId)) {
          await sendMessage(chatId, `🔐 **Admin Panel**\n\nWelcome admin ${firstName}!\n\n🛠️ Use the dashboard to manage the bot.`);
        } else {
          await sendMessage(chatId, "❌ Access denied. Admin privileges required.");
        }
        return new Response("OK", { status: 200 });
      }

      // Default response
      await sendMessage(chatId, `Hi ${firstName}! 👋\n\nUse /start to see the main menu.`);
      return new Response("OK", { status: 200 });
    }

    // Handle callback queries
    if (body.callback_query) {
      const callbackQuery = body.callback_query;
      const chatId = callbackQuery.message.chat.id;
      const userId = callbackQuery.from.id.toString();
      const firstName = callbackQuery.from.first_name || "User";
      const callbackData = callbackQuery.data;

      console.log(`🔘 Callback from ${firstName} (${userId}): ${callbackData}`);

      // Handle different callback actions
      switch (callbackData) {
        case 'view_packages':
          await sendMessage(chatId, `💎 **VIP Packages**\n\nOur premium packages are coming soon!\n\nStay tuned for exclusive trading signals and mentorship programs.`);
          break;
        case 'view_education':
          await sendMessage(chatId, `📚 **Education Center**\n\nOur educational resources are being prepared!\n\nLearn trading fundamentals, technical analysis, and risk management.`);
          break;
        case 'view_promotions':
          await sendMessage(chatId, `🎯 **Current Promotions**\n\nNo active promotions at the moment.\n\nFollow us for the latest deals and discounts!`);
          break;
        case 'help':
          await sendMessage(chatId, `❓ **Help Center**\n\nHow can we help you?\n\n• Use /start for main menu\n• Contact support for assistance\n• Check our FAQ section`);
          break;
        case 'support':
          await sendMessage(chatId, `📞 **Support**\n\nNeed help? We're here for you!\n\n💬 Contact: @DynamicCapital_Support\n📧 Email: support@dynamiccapital.com\n\n⏰ Available 24/7`);
          break;
        case 'about':
          await sendMessage(chatId, `ℹ️ **About Dynamic Capital**\n\nWe are a leading trading education and signals provider.\n\n🎯 Our mission: Help traders succeed\n📈 Our vision: Financial freedom for all\n\n🌟 Join our growing community!`);
          break;
        default:
          await sendMessage(chatId, `❓ Unknown action. Please try /start for the main menu.`);
      }

      // Answer callback query
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callback_query_id: callbackQuery.id,
          text: "✅ Action processed"
        })
      });

      return new Response("OK", { status: 200 });
    }

    return new Response("OK", { status: 200 });

  } catch (error) {
    console.error("🚨 Main error:", error);
    return new Response("Error", { status: 500, headers: corsHeaders });
  }
});

console.log("🚀 Bot is ready and listening for updates!");