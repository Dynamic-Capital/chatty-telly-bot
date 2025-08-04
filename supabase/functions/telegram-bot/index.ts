import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const ADMIN_USER_IDS = ["225513686"];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function isAdmin(userId: string): boolean {
  return ADMIN_USER_IDS.includes(userId);
}

async function sendMessage(chatId: number, text: string, replyMarkup?: any) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  const payload = {
    chat_id: chatId,
    text: text,
    reply_markup: replyMarkup,
    parse_mode: "Markdown"
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return response.ok;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method === "GET") {
    return new Response("Bot is running!", { status: 200 });
  }

  try {
    const update = await req.json();
    console.log("Update received:", JSON.stringify(update));

    if (update.message) {
      const message = update.message;
      const chatId = message.chat.id;
      const userId = message.from.id.toString();
      const firstName = message.from.first_name;
      const text = message.text;

      if (text?.startsWith('/start')) {
        const mainMenu = {
          inline_keyboard: [
            [
              { text: "📦 Packages", callback_data: "view_packages" },
              { text: "ℹ️ About Us", callback_data: "about_us" }
            ],
            [
              { text: "💬 AI Chat", callback_data: "start_chat" },
              { text: "📊 My Status", callback_data: "user_status" }
            ]
          ]
        };

        let message = `🤖 *Welcome to AI Trading Assistant!*\n\n`;
        message += `Hello ${firstName || 'Trader'}! 👋\n\n`;
        message += `What would you like to do today?`;
        
        await sendMessage(chatId, message, mainMenu);
      } else if (text?.startsWith('/admin') && isAdmin(userId)) {
        const adminKeyboard = {
          inline_keyboard: [
            [{ text: "📥 Export Data", callback_data: "admin_export" }],
            [{ text: "📊 View Stats", callback_data: "admin_stats" }]
          ]
        };
        await sendMessage(chatId, "🔧 *Admin Panel*\n\nSelect an option:", adminKeyboard);
      } else if (text && !text.startsWith('/')) {
        await sendMessage(chatId, `You said: ${text}\n\nThis is a test response. AI features will be added soon!`);
      }
    } else if (update.callback_query) {
      const callbackQuery = update.callback_query;
      const chatId = callbackQuery.message.chat.id;
      const data = callbackQuery.data;

      // Answer callback query
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: callbackQuery.id }),
      });

      switch (data) {
        case "view_packages":
          await sendMessage(chatId, "📦 *Packages Feature*\n\nPackages display coming soon!");
          break;
        case "about_us":
          await sendMessage(chatId, "ℹ️ *About AI Trading Assistant*\n\n🤖 Your AI-powered trading companion.\n\n*Contact:* @DynamicCapital_Support");
          break;
        case "start_chat":
          await sendMessage(chatId, "💬 *AI Chat*\n\nSend me any message and I'll respond!");
          break;
        case "user_status":
          await sendMessage(chatId, "📊 *Your Status*\n\n👤 User: Active\n🆓 Plan: Free Trial");
          break;
        case "admin_export":
          await sendMessage(chatId, "📥 *Export Data*\n\nExport features coming soon!");
          break;
        case "admin_stats":
          await sendMessage(chatId, "📊 *Bot Stats*\n\nStats display coming soon!");
          break;
        default:
          await sendMessage(chatId, "🚧 Feature coming soon!");
          break;
      }
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Error:", error);
    return new Response("Error", { status: 500 });
  }
});