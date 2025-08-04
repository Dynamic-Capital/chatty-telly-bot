import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// --- CONSTANTS ---
const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const BINANCE_API_KEY = Deno.env.get("BINANCE_API_KEY");
const BINANCE_SECRET_KEY = Deno.env.get("BINANCE_SECRET_KEY");

const DEFAULT_MODEL = "gpt-4o-mini";
const FREE_TIER_MAX_MESSAGES = 5;
const RATE_LIMIT_WINDOW = 60 * 1000; // 60 seconds
const RATE_LIMIT_MAX_REQUESTS = 3;

// Admin user IDs
const ADMIN_USER_IDS = [
  "225513686", // The Wandering Trader (@DynamicCapital_Support)
];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Available models
const models = [
  { name: "GPT 3.5 Turbo", value: "gpt-3.5-turbo" },
  { name: "GPT 4", value: "gpt-4" },
  { name: "GPT 4o Mini", value: "gpt-4o-mini" },
];

// User sessions storage (in memory - for production use Redis or database)
const userSessions = new Map();

// --- UTILS ---
function logStep(message: string, data: any = {}) {
  console.log(`[${new Date().toISOString()}] ${message}`, data);
}

function isAdmin(userId: string): boolean {
  return ADMIN_USER_IDS.includes(userId);
}

function getErrorMessage(error: any): string {
  if (error instanceof Error) {
    return error.message;
  } else {
    return String(error);
  }
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

const supabaseAdmin = createClient(
  SUPABASE_URL!,
  SUPABASE_SERVICE_ROLE_KEY!,
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

async function editMessage(chatId: number, messageId: number, text: string, replyMarkup?: any) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`;
  const payload = {
    chat_id: chatId,
    message_id: messageId,
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
    console.error(`Failed to edit message: ${error}`);
  }

  return response.ok;
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

async function answerCallbackQuery(callbackQueryId: string, text?: string) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`;
  const payload = {
    callback_query_id: callbackQueryId,
    text: text,
    show_alert: false
  };

  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

// --- OpenAI API ---
async function callOpenAI(messages: any[], model = DEFAULT_MODEL) {
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
  try {
    let { data: user, error } = await supabase
      .from("bot_users")
      .select("*")
      .eq("telegram_id", telegramId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error("Error fetching bot user:", error);
    }

    if (!user) {
      const { data, error } = await supabaseAdmin
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
  } catch (error) {
    console.error("Database error:", error);
    return null;
  }
}

async function getSubscriptionPlans() {
  const { data, error } = await supabase
    .from('subscription_plans')
    .select('*')
    .order('price', { ascending: true });

  if (error) {
    console.error('Error fetching subscription plans:', error);
    return [];
  }

  return data || [];
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

async function getMediaFiles() {
  const { data, error } = await supabase
    .from('media_files')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('Error fetching media files:', error);
    return [];
  }

  return data || [];
}

// --- SESSION MANAGEMENT ---
function getUserSession(userId: string) {
  if (!userSessions.has(userId)) {
    userSessions.set(userId, {
      currentModel: DEFAULT_MODEL,
      messageHistory: [],
      currentContext: "",
      usageCount: 0,
      lastMessageTime: null,
      isRateLimited: false,
    });
  }
  return userSessions.get(userId);
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

async function exportSubscriptionsData(): Promise<any[]> {
  const { data, error } = await supabase
    .from('user_subscriptions')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

async function exportPromoAnalytics(): Promise<any[]> {
  const { data, error } = await supabase
    .from('promo_analytics')
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
  
  const mainMenu = {
    inline_keyboard: [
      [
        { text: "📦 Packages", callback_data: "view_packages" },
        { text: "ℹ️ About Us", callback_data: "about_us" }
      ],
      [
        { text: "💬 AI Chat", callback_data: "start_chat" },
        { text: "📊 My Status", callback_data: "user_status" }
      ],
      [
        { text: "⚙️ Settings", callback_data: "user_settings" },
        { text: "📞 Support", callback_data: "support" }
      ]
    ]
  };

  let message = `🤖 *Welcome to the AI Trading Assistant!*\n\n`;
  message += `Hello ${firstName || 'Trader'}! 👋\n\n`;
  
  if (isSubscribed) {
    message += `✅ *Premium Member*\n`;
    message += `📅 Valid until: ${new Date(user.subscription_expires_at!).toLocaleDateString()}\n\n`;
  } else {
    message += `🆓 *Free Trial User*\n`;
    message += `💎 Upgrade to unlock premium features!\n\n`;
  }

  message += `What would you like to do today?`;

  await sendMessage(chatId, message, mainMenu);
}

async function handleHelpCommand(chatId: number) {
  const helpMessage = `
🤖 *AI Trading Assistant - Help*

*Main Commands:*
/start - Show main menu
/help - Display this help message
/status - Check your subscription status
/cancel - Cancel current operation

*Premium Features:*
• Unlimited AI conversations
• Advanced trading analysis
• Real-time market insights
• Priority support

*Free Features:*
• ${FREE_TIER_MAX_MESSAGES} AI messages per day
• Basic market info
• Educational content

*For Support:*
Contact our team anytime through the support button in the main menu.

*Admin Commands:* (Admins only)
/admin - Access admin panel
`;
  
  const backButton = {
    inline_keyboard: [
      [{ text: "🔙 Back to Menu", callback_data: "back_to_main" }]
    ]
  };

  await sendMessage(chatId, helpMessage, backButton);
}

async function handleAdminCommand(chatId: number, userId: string) {
  if (!isAdmin(userId)) {
    await sendMessage(chatId, "❌ Access denied. This command is for administrators only.");
    return;
  }

  const adminKeyboard = {
    inline_keyboard: [
      [
        { text: "📊 View Stats", callback_data: "admin_stats" },
        { text: "📢 Create Broadcast", callback_data: "admin_broadcast" }
      ],
      [
        { text: "🖼️ Media Gallery", callback_data: "admin_media" },
        { text: "👥 User Management", callback_data: "admin_users" }
      ],
      [
        { text: "📥 Export Data", callback_data: "admin_export" },
        { text: "⚙️ Bot Settings", callback_data: "admin_settings" }
      ],
      [
        { text: "🔙 Back to Main Menu", callback_data: "back_to_main" }
      ]
    ]
  };

  await sendMessage(chatId, "🔧 *Admin Panel*\n\nSelect an option:", adminKeyboard);
}

async function handleTextMessage(chatId: number, text: string, userId: string) {
  try {
    const user = await fetchOrCreateBotUser(userId);
    if (!user) return;

    const session = getUserSession(userId);
    const isSubscribed = user.subscription_expires_at && new Date(user.subscription_expires_at) > new Date();
    
    // Rate limiting for free users
    if (!isSubscribed) {
      if (session.usageCount >= FREE_TIER_MAX_MESSAGES) {
        const upgradeKeyboard = {
          inline_keyboard: [
            [{ text: "📦 View Packages", callback_data: "view_packages" }],
            [{ text: "🔙 Back to Menu", callback_data: "back_to_main" }]
          ]
        };
        await sendMessage(chatId, "🚫 You've reached your daily limit of free messages.\n\n💎 Upgrade to Premium for unlimited AI conversations!", upgradeKeyboard);
        return;
      }
      session.usageCount++;
    }

    if (!OPENAI_API_KEY) {
      await sendMessage(chatId, "❌ AI service temporarily unavailable. Please try again later.");
      return;
    }

    // Prepare messages for OpenAI
    const systemMessage = { 
      role: "system", 
      content: "You are a professional AI trading assistant. Provide helpful, accurate information about trading, markets, and financial analysis. Keep responses concise and actionable." 
    };

    session.messageHistory.push({ role: "user", content: text });
    
    // Keep only last 10 messages for context
    if (session.messageHistory.length > 10) {
      session.messageHistory = session.messageHistory.slice(-10);
    }

    const messages = [systemMessage, ...session.messageHistory];

    const response = await callOpenAI(messages, session.currentModel);
    const aiResponse = response.choices[0]?.message?.content;

    if (aiResponse) {
      session.messageHistory.push({ role: "assistant", content: aiResponse });
      
      const responseKeyboard = {
        inline_keyboard: [
          [
            { text: "🔄 New Chat", callback_data: "new_chat" },
            { text: "🔙 Main Menu", callback_data: "back_to_main" }
          ]
        ]
      };
      
      await sendMessage(chatId, aiResponse, responseKeyboard);
    } else {
      await sendMessage(chatId, "❌ Sorry, I couldn't generate a response. Please try again.");
    }

  } catch (error) {
    console.error("Error processing message:", error);
    await sendMessage(chatId, "❌ An error occurred while processing your message. Please try again later.");
  }
}

async function handleCallbackQuery(chatId: number, messageId: number, data: string, userId: string, callbackQueryId: string) {
  const user = await fetchOrCreateBotUser(userId);
  const isSubscribed = user?.subscription_expires_at && new Date(user.subscription_expires_at) > new Date();

  switch (data) {
    case "back_to_main":
      const mainMenu = {
        inline_keyboard: [
          [
            { text: "📦 Packages", callback_data: "view_packages" },
            { text: "ℹ️ About Us", callback_data: "about_us" }
          ],
          [
            { text: "💬 AI Chat", callback_data: "start_chat" },
            { text: "📊 My Status", callback_data: "user_status" }
          ],
          [
            { text: "⚙️ Settings", callback_data: "user_settings" },
            { text: "📞 Support", callback_data: "support" }
          ]
        ]
      };
      await editMessage(chatId, messageId, "🤖 *AI Trading Assistant*\n\nWhat would you like to do?", mainMenu);
      await answerCallbackQuery(callbackQueryId);
      break;

    case "view_packages":
      try {
        const plans = await getSubscriptionPlans();
        let packageMessage = "📦 *Available Packages*\n\n";
        
        if (plans.length === 0) {
          packageMessage += "No packages available at the moment.";
        } else {
          plans.forEach((plan, index) => {
            packageMessage += `${index + 1}. **${plan.name}**\n`;
            packageMessage += `   💰 Price: $${plan.price}/${plan.duration_months}mo\n`;
            if (plan.features && plan.features.length > 0) {
              packageMessage += `   ✨ Features: ${plan.features.join(', ')}\n`;
            }
            packageMessage += `\n`;
          });
        }

        const packageKeyboard = {
          inline_keyboard: [
            [{ text: "💳 Subscribe Now", callback_data: "subscribe_menu" }],
            [{ text: "🔙 Back to Menu", callback_data: "back_to_main" }]
          ]
        };

        await editMessage(chatId, messageId, packageMessage, packageKeyboard);
        await answerCallbackQuery(callbackQueryId);
      } catch (error) {
        await answerCallbackQuery(callbackQueryId, "❌ Error loading packages");
      }
      break;

    case "about_us":
      const aboutMessage = `
ℹ️ *About AI Trading Assistant*

🤖 We are your dedicated AI-powered trading companion, designed to help you navigate the complex world of financial markets.

*Our Mission:*
To democratize trading education and provide intelligent market analysis to traders of all levels.

*What We Offer:*
• Real-time market analysis
• Educational trading content
• AI-powered insights
• 24/7 trading assistance
• Risk management guidance

*Our Team:*
Experienced traders and AI specialists working together to bring you the best trading tools and education.

*Contact:*
@DynamicCapital_Support

*Join thousands of traders who trust our AI assistant for their trading journey.*
      `;

      const aboutKeyboard = {
        inline_keyboard: [
          [{ text: "📦 View Packages", callback_data: "view_packages" }],
          [{ text: "🔙 Back to Menu", callback_data: "back_to_main" }]
        ]
      };

      await editMessage(chatId, messageId, aboutMessage, aboutKeyboard);
      await answerCallbackQuery(callbackQueryId);
      break;

    case "start_chat":
      const chatMessage = isSubscribed 
        ? "💬 *AI Chat Active*\n\nYou can now send me any trading questions or analysis requests. As a premium member, you have unlimited conversations!\n\n💡 Try asking about market trends, trading strategies, or technical analysis."
        : `💬 *AI Chat Active*\n\nYou can ask me trading questions! Free users get ${FREE_TIER_MAX_MESSAGES} messages per day.\n\n💡 Try asking about market trends, trading strategies, or technical analysis.\n\n💎 Upgrade for unlimited conversations!`;

      const chatKeyboard = {
        inline_keyboard: [
          [
            { text: "📦 Upgrade", callback_data: "view_packages" },
            { text: "🔙 Main Menu", callback_data: "back_to_main" }
          ]
        ]
      };

      await editMessage(chatId, messageId, chatMessage, chatKeyboard);
      await answerCallbackQuery(callbackQueryId);
      break;

    case "user_status":
      const session = getUserSession(userId);
      let statusMessage = `📊 *Your Status*\n\n`;
      statusMessage += `👤 User ID: ${userId}\n`;
      
      if (isSubscribed) {
        statusMessage += `✅ Status: Premium Member\n`;
        statusMessage += `📅 Valid Until: ${new Date(user!.subscription_expires_at!).toLocaleDateString()}\n`;
        statusMessage += `💬 Messages: Unlimited\n`;
      } else {
        statusMessage += `🆓 Status: Free User\n`;
        statusMessage += `💬 Messages Used Today: ${session.usageCount}/${FREE_TIER_MAX_MESSAGES}\n`;
        statusMessage += `🔄 Resets: Tomorrow\n`;
      }

      statusMessage += `🤖 Current Model: ${session.currentModel}\n`;

      const statusKeyboard = {
        inline_keyboard: [
          [
            { text: "📦 Upgrade", callback_data: "view_packages" },
            { text: "⚙️ Settings", callback_data: "user_settings" }
          ],
          [{ text: "🔙 Back to Menu", callback_data: "back_to_main" }]
        ]
      };

      await editMessage(chatId, messageId, statusMessage, statusKeyboard);
      await answerCallbackQuery(callbackQueryId);
      break;

    case "user_settings":
      const settingsMessage = `⚙️ *Settings*\n\nConfigure your AI assistant preferences:`;
      
      const settingsKeyboard = {
        inline_keyboard: [
          [{ text: "🤖 Change AI Model", callback_data: "change_model" }],
          [{ text: "🔄 Reset Chat History", callback_data: "reset_history" }],
          [{ text: "🔙 Back to Menu", callback_data: "back_to_main" }]
        ]
      };

      await editMessage(chatId, messageId, settingsMessage, settingsKeyboard);
      await answerCallbackQuery(callbackQueryId);
      break;

    case "change_model":
      const session = getUserSession(userId);
      let modelMessage = `🤖 *AI Model Selection*\n\nCurrent: ${session.currentModel}\n\nChoose your preferred model:`;
      
      const modelKeyboard = {
        inline_keyboard: models.map(model => [
          { text: model.name + (session.currentModel === model.value ? " ✅" : ""), callback_data: `set_model_${model.value}` }
        ]).concat([[{ text: "🔙 Back to Settings", callback_data: "user_settings" }]])
      };

      await editMessage(chatId, messageId, modelMessage, modelKeyboard);
      await answerCallbackQuery(callbackQueryId);
      break;

    case "reset_history":
      const userSession = getUserSession(userId);
      userSession.messageHistory = [];
      await editMessage(chatId, messageId, "🔄 *Chat History Reset*\n\nYour conversation history has been cleared. Start fresh with your next message!", {
        inline_keyboard: [
          [{ text: "💬 Start New Chat", callback_data: "start_chat" }],
          [{ text: "🔙 Back to Menu", callback_data: "back_to_main" }]
        ]
      });
      await answerCallbackQuery(callbackQueryId, "✅ Chat history cleared!");
      break;

    case "new_chat":
      const newSession = getUserSession(userId);
      newSession.messageHistory = [];
      await answerCallbackQuery(callbackQueryId, "✅ New chat started!");
      await sendMessage(chatId, "🔄 *New Chat Started*\n\nPrevious conversation cleared. What would you like to discuss?");
      break;

    case "support":
      const supportMessage = `📞 *Customer Support*\n\n🤝 Need help? Our support team is here for you!\n\n📧 Contact: @DynamicCapital_Support\n⏰ Response Time: Usually within 24 hours\n\n*Common Questions:*\n• How to upgrade subscription\n• AI model differences\n• Trading education resources\n• Technical issues\n\nFeel free to reach out anytime!`;
      
      const supportKeyboard = {
        inline_keyboard: [
          [{ text: "📧 Contact Support", url: "https://t.me/DynamicCapital_Support" }],
          [{ text: "🔙 Back to Menu", callback_data: "back_to_main" }]
        ]
      };

      await editMessage(chatId, messageId, supportMessage, supportKeyboard);
      await answerCallbackQuery(callbackQueryId);
      break;

    // Admin functions
    case "admin_stats":
      if (!isAdmin(userId)) {
        await answerCallbackQuery(callbackQueryId, "❌ Access denied");
        return;
      }
      
      try {
        const users = await getAllBotUsers();
        const statsMessage = `📊 *Bot Statistics*\n\n👥 Total Users: ${users.length}\n📅 Last Updated: ${new Date().toLocaleString()}`;
        
        const statsKeyboard = {
          inline_keyboard: [
            [{ text: "🔄 Refresh", callback_data: "admin_stats" }],
            [{ text: "🔙 Back to Admin", callback_data: "back_to_admin" }]
          ]
        };
        
        await editMessage(chatId, messageId, statsMessage, statsKeyboard);
        await answerCallbackQuery(callbackQueryId);
      } catch (error) {
        await answerCallbackQuery(callbackQueryId, "❌ Error fetching statistics");
      }
      break;

    case "admin_export":
      if (!isAdmin(userId)) {
        await answerCallbackQuery(callbackQueryId, "❌ Access denied");
        return;
      }
      
      const exportKeyboard = {
        inline_keyboard: [
          [
            { text: "👥 Export Users", callback_data: "export_users" },
            { text: "💳 Export Payments", callback_data: "export_payments" }
          ],
          [
            { text: "📊 Export Subscriptions", callback_data: "export_subscriptions" },
            { text: "🎯 Export Promo Analytics", callback_data: "export_promos" }
          ],
          [
            { text: "🔙 Back to Admin", callback_data: "back_to_admin" }
          ]
        ]
      };
      
      await editMessage(chatId, messageId, "📥 *Export Data*\n\nSelect what data you want to export as CSV:", exportKeyboard);
      await answerCallbackQuery(callbackQueryId);
      break;

    case "admin_media":
      if (!isAdmin(userId)) {
        await answerCallbackQuery(callbackQueryId, "❌ Access denied");
        return;
      }
      
      try {
        const mediaFiles = await getMediaFiles();
        
        let mediaMessage = "🖼️ *Media Gallery*\n\n";
        if (mediaFiles.length === 0) {
          mediaMessage += "No media files uploaded yet.";
        } else {
          mediaFiles.slice(0, 10).forEach((file, index) => {
            mediaMessage += `${index + 1}. ${file.filename} (${file.file_type})\n`;
            if (file.caption) mediaMessage += `   Caption: ${file.caption}\n`;
            mediaMessage += `   Uploaded: ${new Date(file.created_at).toLocaleDateString()}\n\n`;
          });
          
          if (mediaFiles.length > 10) {
            mediaMessage += `... and ${mediaFiles.length - 10} more files`;
          }
        }

        const mediaKeyboard = {
          inline_keyboard: [
            [{ text: "🔙 Back to Admin", callback_data: "back_to_admin" }]
          ]
        };

        await editMessage(chatId, messageId, mediaMessage, mediaKeyboard);
        await answerCallbackQuery(callbackQueryId);
      } catch (error) {
        await answerCallbackQuery(callbackQueryId, "❌ Error fetching media files");
      }
      break;

    case "back_to_admin":
      if (!isAdmin(userId)) {
        await answerCallbackQuery(callbackQueryId, "❌ Access denied");
        return;
      }
      
      const adminKeyboard = {
        inline_keyboard: [
          [
            { text: "📊 View Stats", callback_data: "admin_stats" },
            { text: "📢 Create Broadcast", callback_data: "admin_broadcast" }
          ],
          [
            { text: "🖼️ Media Gallery", callback_data: "admin_media" },
            { text: "👥 User Management", callback_data: "admin_users" }
          ],
          [
            { text: "📥 Export Data", callback_data: "admin_export" },
            { text: "⚙️ Bot Settings", callback_data: "admin_settings" }
          ],
          [
            { text: "🔙 Back to Main Menu", callback_data: "back_to_main" }
          ]
        ]
      };

      await editMessage(chatId, messageId, "🔧 *Admin Panel*\n\nSelect an option:", adminKeyboard);
      await answerCallbackQuery(callbackQueryId);
      break;

    // Export functions
    case "export_users":
      if (!isAdmin(userId)) {
        await answerCallbackQuery(callbackQueryId, "❌ Access denied");
        return;
      }
      
      await answerCallbackQuery(callbackQueryId, "🔄 Exporting users data...");
      
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
      if (!isAdmin(userId)) {
        await answerCallbackQuery(callbackQueryId, "❌ Access denied");
        return;
      }
      
      await answerCallbackQuery(callbackQueryId, "🔄 Exporting payments data...");
      
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

    case "export_subscriptions":
      if (!isAdmin(userId)) {
        await answerCallbackQuery(callbackQueryId, "❌ Access denied");
        return;
      }
      
      await answerCallbackQuery(callbackQueryId, "🔄 Exporting subscriptions data...");
      
      try {
        const data = await exportSubscriptionsData();
        const csvContent = generateCSV(data);
        const csvBuffer = new TextEncoder().encode(csvContent);
        const filename = `user_subscriptions_${new Date().toISOString().split('T')[0]}.csv`;
        const caption = `📊 Subscriptions Export\n\n📊 Records: ${data.length}\n📅 Generated: ${new Date().toLocaleString()}`;
        await sendDocument(chatId, csvBuffer, filename, caption);
      } catch (error) {
        console.error('Export subscriptions error:', error);
        await sendMessage(chatId, "❌ Error exporting subscriptions data. Please try again.");
      }
      break;

    case "export_promos":
      if (!isAdmin(userId)) {
        await answerCallbackQuery(callbackQueryId, "❌ Access denied");
        return;
      }
      
      await answerCallbackQuery(callbackQueryId, "🔄 Exporting promo analytics...");
      
      try {
        const data = await exportPromoAnalytics();
        const csvContent = generateCSV(data);
        const csvBuffer = new TextEncoder().encode(csvContent);
        const filename = `promo_analytics_${new Date().toISOString().split('T')[0]}.csv`;
        const caption = `🎯 Promo Analytics Export\n\n📊 Records: ${data.length}\n📅 Generated: ${new Date().toLocaleString()}`;
        await sendDocument(chatId, csvBuffer, filename, caption);
      } catch (error) {
        console.error('Export promos error:', error);
        await sendMessage(chatId, "❌ Error exporting promo analytics. Please try again.");
      }
      break;

    default:
      // Handle model selection
      if (data.startsWith("set_model_")) {
        const modelValue = data.replace("set_model_", "");
        const userSession = getUserSession(userId);
        userSession.currentModel = modelValue;
        
        const selectedModel = models.find(m => m.value === modelValue);
        await answerCallbackQuery(callbackQueryId, `✅ Model changed to ${selectedModel?.name}`);
        
        // Refresh the model selection menu
        const refreshedModelMessage = `🤖 *AI Model Selection*\n\nCurrent: ${modelValue}\n\nChoose your preferred model:`;
        const refreshedModelKeyboard = {
          inline_keyboard: models.map(model => [
            { text: model.name + (modelValue === model.value ? " ✅" : ""), callback_data: `set_model_${model.value}` }
          ]).concat([[{ text: "🔙 Back to Settings", callback_data: "user_settings" }]])
        };
        
        await editMessage(chatId, messageId, refreshedModelMessage, refreshedModelKeyboard);
      } else {
        await answerCallbackQuery(callbackQueryId, "🚧 Feature coming soon!");
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
        const user = await fetchOrCreateBotUser(userId);
        const isSubscribed = user?.subscription_expires_at && new Date(user.subscription_expires_at) > new Date();
        const session = getUserSession(userId);
        
        let statusMessage = `📊 *Your Status*\n\n`;
        statusMessage += `👤 User ID: ${userId}\n`;
        
        if (isSubscribed) {
          statusMessage += `✅ Status: Premium Member\n`;
          statusMessage += `📅 Valid Until: ${new Date(user!.subscription_expires_at!).toLocaleDateString()}\n`;
          statusMessage += `💬 Messages: Unlimited\n`;
        } else {
          statusMessage += `🆓 Status: Free User\n`;
          statusMessage += `💬 Messages Used Today: ${session.usageCount}/${FREE_TIER_MAX_MESSAGES}\n`;
        }

        await sendMessage(chatId, statusMessage);
      } else if (text?.startsWith('/cancel')) {
        await sendMessage(chatId, "❌ Current operation cancelled.", {
          inline_keyboard: [
            [{ text: "🔙 Back to Menu", callback_data: "back_to_main" }]
          ]
        });
      } else if (text && !text.startsWith('/')) {
        await handleTextMessage(chatId, text, userId);
      }
    } else if (update.callback_query) {
      const callbackQuery = update.callback_query;
      const chatId = callbackQuery.message.chat.id;
      const messageId = callbackQuery.message.message_id;
      const userId = callbackQuery.from.id.toString();
      const data = callbackQuery.data;

      await handleCallbackQuery(chatId, messageId, data, userId, callbackQuery.id);
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    logStep("ERROR in telegram-bot", {
      message: error instanceof Error ? error.message : String(error),
    });
    return new Response("Internal Server Error", { status: 500 });
  }
});
