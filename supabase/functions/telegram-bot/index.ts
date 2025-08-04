import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const ADMIN_USER_IDS = ["225513686"];

// User sessions for rate limiting
const userSessions = new Map();

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

function getUserSession(userId: string) {
  if (!userSessions.has(userId)) {
    userSessions.set(userId, {
      messageCount: 0,
      lastReset: Date.now(),
      messageHistory: []
    });
  }
  return userSessions.get(userId);
}

async function callOpenAI(messages: any[]) {
  if (!OPENAI_API_KEY) {
    throw new Error("OpenAI API key not configured");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: messages,
      max_tokens: 500,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`OpenAI API error: ${error}`);
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  return await response.json();
}

async function handleAIChat(chatId: number, text: string, userId: string) {
  const session = getUserSession(userId);
  
  // Simple rate limiting: 10 messages per hour for free users
  const hourAgo = Date.now() - (60 * 60 * 1000);
  if (session.lastReset < hourAgo) {
    session.messageCount = 0;
    session.lastReset = Date.now();
  }
  
  if (session.messageCount >= 10) {
    const upgradeKeyboard = {
      inline_keyboard: [
        [{ text: "📦 Upgrade to Premium", callback_data: "view_packages" }],
        [{ text: "🔙 Main Menu", callback_data: "back_to_main" }]
      ]
    };
    await sendMessage(chatId, "🚫 You've reached your hourly limit of 10 free messages!\n\n💎 Upgrade to Premium for unlimited AI conversations!", upgradeKeyboard);
    return;
  }

  try {
    // Add user message to history
    session.messageHistory.push({ role: "user", content: text });
    
    // Keep only last 6 messages for context
    if (session.messageHistory.length > 6) {
      session.messageHistory = session.messageHistory.slice(-6);
    }

    // Prepare messages for OpenAI
    const systemMessage = { 
      role: "system", 
      content: "You are a professional AI trading assistant. Provide helpful, accurate trading advice and market analysis. Keep responses concise and actionable. Always be supportive and educational." 
    };

    const messages = [systemMessage, ...session.messageHistory];
    
    // Show typing indicator
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendChatAction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        chat_id: chatId, 
        action: 'typing' 
      }),
    });

    const response = await callOpenAI(messages);
    const aiResponse = response.choices[0]?.message?.content;

    if (aiResponse) {
      // Add AI response to history
      session.messageHistory.push({ role: "assistant", content: aiResponse });
      session.messageCount++;
      
      const responseKeyboard = {
        inline_keyboard: [
          [
            { text: "🔄 New Topic", callback_data: "new_chat" },
            { text: "🔙 Main Menu", callback_data: "back_to_main" }
          ]
        ]
      };
      
      const remainingMessages = 10 - session.messageCount;
      let finalMessage = aiResponse;
      
      if (remainingMessages > 0) {
        finalMessage += `\n\n💬 _${remainingMessages} free messages remaining this hour_`;
      }
      
      await sendMessage(chatId, finalMessage, responseKeyboard);
    } else {
      await sendMessage(chatId, "❌ Sorry, I couldn't generate a response. Please try again.");
    }

  } catch (error) {
    console.error("AI Chat error:", error);
    
    if (error.message.includes("OpenAI API key not configured")) {
      await sendMessage(chatId, "❌ AI service is temporarily unavailable. Please contact support.");
    } else {
      await sendMessage(chatId, "❌ An error occurred while processing your message. Please try again in a moment.");
    }
  }
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
        // AI Chat functionality
        await handleAIChat(chatId, text, userId);
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