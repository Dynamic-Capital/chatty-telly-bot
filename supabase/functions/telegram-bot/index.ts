import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// --- CONSTANTS ---
const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const BINANCE_API_KEY = Deno.env.get("BINANCE_API_KEY");
const BINANCE_SECRET_KEY = Deno.env.get("BINANCE_SECRET_KEY");

const DEFAULT_MODEL = "gpt-4o-mini";
const FREE_TIER_MAX_MESSAGES = 5;

// Admin user IDs
const ADMIN_USER_IDS = [
  "225513686", // The Wandering Trader (@DynamicCapital_Support)
];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// --- UTILS ---
function logStep(message: string, data: any = {}) {
  console.log(`[${new Date().toISOString()}] ${message}`, data);
}

function isAdmin(userId: string): boolean {
  return ADMIN_USER_IDS.includes(userId);
}

// --- SUPABASE ---
const supabase = createClient(
  SUPABASE_URL!,
  SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: false,
    },
  },
);

// --- TELEGRAM API HELPERS ---
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

  if (!response.ok) {
    const error = await response.text();
    console.error(`Failed to send message: ${error}`);
    throw new Error(`Failed to send message: ${error}`);
  }

  return await response.json();
}

async function sendDocument(chatId: number, document: Uint8Array, filename: string, caption?: string) {
  const formData = new FormData();
  formData.append('chat_id', chatId.toString());
  formData.append('document', new Blob([document], { type: 'text/csv' }), filename);
  if (caption) formData.append('caption', caption);

  const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`Failed to send document: ${error}`);
    throw new Error(`Failed to send document: ${error}`);
  }

  return await response.json();
}

// --- OpenAI API ---
async function callOpenAI(messages: any[], model = DEFAULT_MODEL) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: model,
      messages: messages,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`OpenAI API error: ${error}`);
    throw new Error(`OpenAI API error: ${error}`);
  }

  return await response.json();
}

// --- DATABASE FUNCTIONS ---
async function fetchOrCreateBotUser(telegramId: string, firstName?: string, lastName?: string, username?: string) {
  let { data: user, error } = await supabase
    .from("bot_users")
    .select("*")
    .eq("telegram_id", telegramId)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error("Error fetching bot user:", error);
  }

  if (!user) {
    const { data, error } = await supabase
      .from("bot_users")
      .insert([{ 
        telegram_id: telegramId,
        first_name: firstName,
        last_name: lastName,
        username: username
      }])
      .select("*")
      .single();

    if (error) {
      console.error("Error creating bot user:", error);
      return null;
    }
    user = data;
  }

  return user;
}

async function getAllBotUsers() {
  const { data, error } = await supabase
    .from('bot_users')
    .select('telegram_id');

  if (error) {
    console.error('Error fetching bot users:', error);
    throw error;
  }

  return data;
}

// --- CSV EXPORT FUNCTIONS ---
function generateCSV(data: any[]): string {
  if (!data.length) return '';
  
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => headers.map(field => {
      const value = row[field];
      if (value === null || value === undefined) return '';
      return `"${String(value).replace(/"/g, '""')}"`;
    }).join(','))
  ].join('\n');
  
  return csvContent;
}

async function exportUsersData(): Promise<any[]> {
  const { data, error } = await supabase
    .from('bot_users')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

async function exportPaymentsData(): Promise<any[]> {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

// --- MESSAGE HANDLERS ---
async function handleStartCommand(chatId: number, firstName?: string, telegramId?: string) {
  if (!telegramId) {
    await sendMessage(chatId, "Error: Unable to identify user.");
    return;
  }

  const user = await fetchOrCreateBotUser(telegramId, firstName);
  if (!user) {
    console.error("Failed to fetch or create bot user.");
    return;
  }

  const isSubscribed = user.subscription_expires_at && new Date(user.subscription_expires_at) > new Date();
  
  let message = `Welcome to the AI Chat Bot, ${firstName || 'there'}! 🤖\n\n`;
  message += "I'm here to assist you with any questions you may have.\n\n";

  if (isSubscribed) {
    message += `✅ You have an active subscription until ${new Date(user.subscription_expires_at!).toLocaleDateString()}.\n\n`;
  } else {
    message += "📝 You're using the free tier. Use /subscribe to unlock premium features!\n\n";
  }

  message += "💬 Feel free to ask me anything, or use /help to see available commands.";
  await sendMessage(chatId, message);
}

async function handleHelpCommand(chatId: number) {
  const helpMessage = `
*Available commands:*
/start - Start the bot and display welcome message
/help - Display this help message
/admin - Admin panel (admins only)
/status - Check your subscription status

*For Admins:*
/admin - Access admin panel with export options
`;
  await sendMessage(chatId, helpMessage);
}

async function handleAdminCommand(chatId: number, userId: string) {
  if (!isAdmin(userId)) {
    await sendMessage(chatId, "❌ Access denied. This command is for administrators only.");
    return;
  }

  const keyboard = {
    inline_keyboard: [
      [
        { text: "📊 View Stats", callback_data: "admin_stats" },
        { text: "📥 Export Data", callback_data: "admin_export" }
      ]
    ]
  };

  await sendMessage(chatId, "🔧 *Admin Panel*\n\nSelect an option:", keyboard);
}

async function handleTextMessage(chatId: number, text: string, userId: string) {
  try {
    // Basic rate limiting for free users
    const user = await fetchOrCreateBotUser(userId);
    if (!user) return;

    const isSubscribed = user.subscription_expires_at && new Date(user.subscription_expires_at) > new Date();
    
    if (!isSubscribed) {
      // For demo, allow some free messages
      // In production, implement proper usage tracking
    }

    if (!OPENAI_API_KEY) {
      await sendMessage(chatId, "OpenAI API key not configured. Please contact admin.");
      return;
    }

    // Call OpenAI
    const messages = [
      { role: "system", content: "You are a helpful AI assistant." },
      { role: "user", content: text }
    ];

    const response = await callOpenAI(messages);
    const aiResponse = response.choices[0]?.message?.content;

    if (aiResponse) {
      await sendMessage(chatId, aiResponse);
    } else {
      await sendMessage(chatId, "Sorry, I couldn't generate a response. Please try again.");
    }

  } catch (error) {
    console.error("Error processing message:", error);
    await sendMessage(chatId, "An error occurred while processing your message. Please try again later.");
  }
}

async function handleCallbackQuery(chatId: number, data: string, userId: string) {
  if (!isAdmin(userId)) {
    return;
  }

  switch (data) {
    case "admin_stats":
      try {
        const users = await getAllBotUsers();
        const statsMessage = `📊 *Bot Statistics*\n\n` +
          `👥 Total Users: ${users.length}\n` +
          `📅 Last Updated: ${new Date().toLocaleString()}`;
        await sendMessage(chatId, statsMessage);
      } catch (error) {
        await sendMessage(chatId, "❌ Error fetching statistics.");
      }
      break;

    case "admin_export":
      const exportKeyboard = {
        inline_keyboard: [
          [
            { text: "👥 Export Users", callback_data: "export_users" },
            { text: "💳 Export Payments", callback_data: "export_payments" }
          ]
        ]
      };
      await sendMessage(chatId, "📥 *Export Data*\n\nSelect what data you want to export as CSV:", exportKeyboard);
      break;

    case "export_users":
      try {
        const data = await exportUsersData();
        const csvContent = generateCSV(data);
        const csvBuffer = new TextEncoder().encode(csvContent);
        const filename = `bot_users_${new Date().toISOString().split('T')[0]}.csv`;
        const caption = `👥 Bot Users Export\n\n📊 Records: ${data.length}\n📅 Generated: ${new Date().toLocaleString()}`;
        await sendDocument(chatId, csvBuffer, filename, caption);
      } catch (error) {
        console.error('Export users error:', error);
        await sendMessage(chatId, "❌ Error exporting users data. Please try again.");
      }
      break;

    case "export_payments":
      try {
        const data = await exportPaymentsData();
        const csvContent = generateCSV(data);
        const csvBuffer = new TextEncoder().encode(csvContent);
        const filename = `payments_${new Date().toISOString().split('T')[0]}.csv`;
        const caption = `💳 Payments Export\n\n📊 Records: ${data.length}\n📅 Generated: ${new Date().toLocaleString()}`;
        await sendDocument(chatId, csvBuffer, filename, caption);
      } catch (error) {
        console.error('Export payments error:', error);
        await sendMessage(chatId, "❌ Error exporting payments data. Please try again.");
      }
      break;
  }
}

// --- MAIN HANDLER ---
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Add basic health check
  if (req.method === "GET") {
    return new Response("Telegram Bot is running!", { status: 200 });
  }

  try {
    const update = await req.json();
    logStep("Received update", update);

    // Handle different types of updates
    if (update.message) {
      const message = update.message;
      const chatId = message.chat.id;
      const userId = message.from.id.toString();
      const firstName = message.from.first_name;
      const text = message.text;

      if (text?.startsWith('/start')) {
        await handleStartCommand(chatId, firstName, userId);
      } else if (text?.startsWith('/help')) {
        await handleHelpCommand(chatId);
      } else if (text?.startsWith('/admin')) {
        await handleAdminCommand(chatId, userId);
      } else if (text?.startsWith('/status')) {
        await sendMessage(chatId, "Status check functionality will be implemented soon.");
      } else if (text && !text.startsWith('/')) {
        await handleTextMessage(chatId, text, userId);
      }
    } else if (update.callback_query) {
      const callbackQuery = update.callback_query;
      const chatId = callbackQuery.message.chat.id;
      const userId = callbackQuery.from.id.toString();
      const data = callbackQuery.data;

      await handleCallbackQuery(chatId, data, userId);

      // Answer callback query to remove loading state
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: callbackQuery.id }),
      });
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    logStep("ERROR in telegram-bot", {
      message: error instanceof Error ? error.message : String(error),
    });
    return new Response("Internal Server Error", { status: 500 });
  }
});