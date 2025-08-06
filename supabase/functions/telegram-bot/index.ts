import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const BOT_START_TIME = new Date();

console.log("🚀 Bot starting with environment check...");
console.log("TELEGRAM_BOT_TOKEN exists:", !!TELEGRAM_BOT_TOKEN);
console.log("SUPABASE_URL exists:", !!SUPABASE_URL);
console.log("SUPABASE_SERVICE_ROLE_KEY exists:", !!SUPABASE_SERVICE_ROLE_KEY);

if (!TELEGRAM_BOT_TOKEN || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Missing required environment variables");
  throw new Error("Missing required environment variables");
}

const supabaseAdmin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

// Admin user IDs
const ADMIN_USER_IDS = new Set(["225513686"]);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Send message function
async function sendMessage(
  chatId: number,
  text: string,
  replyMarkup?: Record<string, unknown>
) {
  try {
    console.log(`📤 Sending message to ${chatId}: ${text.substring(0, 50)}...`);
    
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        reply_markup: replyMarkup,
        parse_mode: "Markdown"
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("❌ Telegram API error:", errorData);
      return null;
    }

    console.log(`✅ Message sent successfully to ${chatId}`);
    return await response.json();

  } catch (error) {
    console.error("🚨 Error in sendMessage:", error);
    return null;
  }
}

// Check if user is admin
function isAdmin(userId: string): boolean {
  return ADMIN_USER_IDS.has(userId);
}

// Get welcome message
function getWelcomeMessage(firstName: string): string {
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

// Get main menu keyboard
function getMainMenuKeyboard(): any {
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

// Main serve function
serve(async (req) => {
  console.log(`📥 Request received: ${req.method} ${req.url}`);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method === "GET") {
    const uptimeMinutes = Math.floor((Date.now() - BOT_START_TIME.getTime()) / 1000 / 60);
    return new Response(
      `🚀 Dynamic Capital Bot is live!\n\n⏰ Uptime: ${uptimeMinutes} minutes`, 
      { status: 200, headers: corsHeaders }
    );
  }

  try {
    const body = await req.json();
    console.log("📨 Received update:", JSON.stringify(body, null, 2));

    // Handle text messages
    if (body.message) {
      const message = body.message;
      const chatId = message.chat.id;
      const userId = message.from?.id?.toString() || "unknown";
      const firstName = message.from?.first_name || "User";
      const text = message.text || "";

      console.log(`💬 Message from ${firstName} (${userId}): ${text}`);

      // Handle /start command
      if (text === '/start') {
        console.log(`🚀 Start command from: ${userId} (${firstName})`);
        
        const welcomeMessage = getWelcomeMessage(firstName);
        const keyboard = getMainMenuKeyboard();
        
        await sendMessage(chatId, welcomeMessage, keyboard);
        return new Response("OK", { status: 200 });
      }

      // Handle /admin command
      if (text === '/admin') {
        console.log(`🔐 Admin command from: ${userId} (${firstName})`);
        
        if (isAdmin(userId)) {
          await sendMessage(chatId, `🔐 **Admin Panel**\n\nWelcome admin ${firstName}!\n\n🛠️ Administrative functions are available.`);
        } else {
          await sendMessage(chatId, "❌ Access denied. Admin privileges required.");
        }
        return new Response("OK", { status: 200 });
      }

      // Default response for other messages
      await sendMessage(chatId, `Hi ${firstName}! 👋\n\nUse /start to see the main menu.`);
      return new Response("OK", { status: 200 });
    }

    // Handle callback queries (button presses)
    if (body.callback_query) {
      const callbackQuery = body.callback_query;
      const chatId = callbackQuery.message?.chat?.id;
      const userId = callbackQuery.from?.id?.toString() || "unknown";
      const firstName = callbackQuery.from?.first_name || "User";
      const callbackData = callbackQuery.data;

      console.log(`🔘 Callback from ${firstName} (${userId}): ${callbackData}`);

      if (!chatId) {
        console.error("❌ No chat ID in callback query");
        return new Response("OK", { status: 200 });
      }

      // Handle different button actions
      let responseMessage = "";
      
      switch (callbackData) {
        case 'view_packages':
          responseMessage = `💎 **VIP Packages**\n\nOur premium packages are coming soon!\n\n🔥 Stay tuned for:\n• Exclusive trading signals\n• Personal mentorship\n• Advanced strategies\n\n📞 Contact support for early access!`;
          break;
        case 'view_education':
          responseMessage = `📚 **Education Center**\n\nOur educational resources are being prepared!\n\n📖 Coming soon:\n• Trading fundamentals\n• Technical analysis\n• Risk management\n• Market psychology\n\n🎓 Learn from the experts!`;
          break;
        case 'view_promotions':
          responseMessage = `🎯 **Current Promotions**\n\nNo active promotions at the moment.\n\n🔔 Follow us for:\n• Latest deals\n• Special discounts\n• Early bird offers\n\n💰 Don't miss out on savings!`;
          break;
        case 'help':
          responseMessage = `❓ **Help Center**\n\nHow can we help you?\n\n🔹 Use /start for main menu\n🔹 Contact support for assistance\n🔹 Check our resources\n\n💡 We're here to help you succeed!`;
          break;
        case 'support':
          responseMessage = `📞 **24/7 Support**\n\nNeed help? We're here for you!\n\n💬 **Contact methods:**\n• Telegram: @DynamicCapital_Support\n• Email: support@dynamiccapital.com\n\n⏰ **Available:** 24 hours, 7 days a week\n\n🤝 Your success is our priority!`;
          break;
        case 'about':
          responseMessage = `ℹ️ **About Dynamic Capital**\n\nWe are a leading trading education and signals provider.\n\n🎯 **Our Mission:** Help traders achieve financial success\n📈 **Our Vision:** Financial freedom for everyone\n🏆 **Our Commitment:** Excellence in education\n\n🌟 **Join our growing community of successful traders!**\n\n📊 Trusted by thousands worldwide`;
          break;
        default:
          responseMessage = `❓ Unknown action: "${callbackData}"\n\nPlease try /start for the main menu.`;
      }

      await sendMessage(chatId, responseMessage);

      // Answer the callback query to remove loading state
      try {
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            callback_query_id: callbackQuery.id,
            text: "✅ Action completed"
          })
        });
      } catch (error) {
        console.error("❌ Error answering callback query:", error);
      }

      return new Response("OK", { status: 200 });
    }

    // Handle other update types
    console.log("ℹ️ Received unknown update type");
    return new Response("OK", { status: 200 });

  } catch (error) {
    console.error("🚨 Main error:", error);
    console.error("🚨 Error stack:", error.stack);
    
    // Return 200 to prevent Telegram from retrying
    return new Response("Error handled", { status: 200, headers: corsHeaders });
  }
});

console.log("🚀 Bot is ready and listening for updates!");