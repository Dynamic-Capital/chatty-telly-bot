import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const ADMIN_USER_IDS = ["225513686"];

// User sessions for rate limiting
const userSessions = new Map();

// Supabase clients
const supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
  auth: { persistSession: false },
});

const supabaseAdmin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

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

// Database functions
async function fetchOrCreateBotUser(telegramId: string, firstName?: string, lastName?: string, username?: string) {
  try {
    let { data: user, error } = await supabaseAdmin
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
          first_name: firstName || null,
          last_name: lastName || null,
          username: username || null
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
  try {
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .order('price', { ascending: true });

    return data || [];
  } catch (error) {
    console.error('Error fetching subscription plans:', error);
    return [];
  }
}

async function getAllBotUsers() {
  try {
    const { data, error } = await supabaseAdmin
      .from('bot_users')
      .select('*')
      .order('created_at', { ascending: false });

    return data || [];
  } catch (error) {
    console.error('Error fetching bot users:', error);
    return [];
  }
}

async function getBotStats() {
  try {
    const [usersResult, paymentsResult, subscriptionsResult] = await Promise.all([
      supabaseAdmin.from('bot_users').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('payments').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('user_subscriptions').select('id').eq('is_active', true)
    ]);

    return {
      totalUsers: usersResult.count || 0,
      totalPayments: paymentsResult.count || 0,
      activeSubscriptions: subscriptionsResult.data?.length || 0
    };
  } catch (error) {
    console.error('Error fetching bot stats:', error);
    return { totalUsers: 0, totalPayments: 0, activeSubscriptions: 0 };
  }
}

// CSV export functions
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

async function sendDocument(chatId: number, document: Uint8Array, filename: string, caption?: string) {
  try {
    const formData = new FormData();
    formData.append('chat_id', chatId.toString());
    formData.append('document', new Blob([document], { type: 'text/csv' }), filename);
    if (caption) formData.append('caption', caption);

    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`, {
      method: 'POST',
      body: formData,
    });

    return response.ok;
  } catch (error) {
    console.error("Error sending document:", error);
    return false;
  }
}

async function exportData(tableName: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from(tableName)
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error(`Error exporting ${tableName}:`, error);
    return [];
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
      const lastName = message.from.last_name;
      const username = message.from.username;
      const text = message.text;

      // Create or fetch user in database
      await fetchOrCreateBotUser(userId, firstName, lastName, username);

      if (text?.startsWith('/start')) {
        const user = await fetchOrCreateBotUser(userId, firstName, lastName, username);
        const isSubscribed = user?.subscription_expires_at && new Date(user.subscription_expires_at) > new Date();
        
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

        let welcomeMessage = `🤖 *Welcome to AI Trading Assistant!*\n\n`;
        welcomeMessage += `Hello ${firstName || 'Trader'}! 👋\n\n`;
        
        if (isSubscribed) {
          welcomeMessage += `✅ *Premium Member*\n`;
          welcomeMessage += `📅 Valid until: ${new Date(user.subscription_expires_at!).toLocaleDateString()}\n\n`;
        } else {
          welcomeMessage += `🆓 *Free Trial User*\n`;
          welcomeMessage += `💎 Upgrade to unlock premium features!\n\n`;
        }
        
        welcomeMessage += `What would you like to do today?`;
        
        await sendMessage(chatId, welcomeMessage, mainMenu);
      } else if (text?.startsWith('/admin') && isAdmin(userId)) {
        const adminKeyboard = {
          inline_keyboard: [
            [{ text: "📊 View Stats", callback_data: "admin_stats" }],
            [{ text: "📥 Export Data", callback_data: "admin_export" }],
            [{ text: "👥 User Management", callback_data: "admin_users" }]
          ]
        };
        await sendMessage(chatId, "🔧 *Admin Panel*\n\nSelect an option:", adminKeyboard);
      } else if (text && !text.startsWith('/')) {
        // AI Chat functionality with database user check
        const user = await fetchOrCreateBotUser(userId, firstName, lastName, username);
        const isSubscribed = user?.subscription_expires_at && new Date(user.subscription_expires_at) > new Date();
        
        if (isSubscribed) {
          // Premium users get unlimited messages
          const session = getUserSession(userId);
          session.messageCount = 0; // Reset for premium users
        }
        
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

      const userId = callbackQuery.from.id.toString();

      switch (data) {
        case "view_packages":
          try {
            const plans = await getSubscriptionPlans();
            let packageMessage = "📦 *Available Packages*\n\n";
            
            if (plans.length === 0) {
              packageMessage += "No packages available at the moment.";
            } else {
              plans.forEach((plan, index) => {
                packageMessage += `${index + 1}. **${plan.name}**\n`;
                packageMessage += `   💰 Price: $${plan.price}`;
                if (plan.duration_months > 0) {
                  packageMessage += `/${plan.duration_months}mo`;
                } else if (plan.is_lifetime) {
                  packageMessage += ` (Lifetime)`;
                }
                packageMessage += `\n`;
                if (plan.features?.length > 0) {
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

            await sendMessage(chatId, packageMessage, packageKeyboard);
          } catch (error) {
            await sendMessage(chatId, "❌ Error loading packages. Please try again.");
          }
          break;

        case "about_us":
          const aboutMessage = `ℹ️ *About AI Trading Assistant*\n\n🤖 Your AI-powered trading companion for navigating financial markets.\n\n*Our Mission:*\nDemocratize trading education and provide intelligent market analysis.\n\n*What We Offer:*\n• Real-time AI market analysis\n• Educational trading content\n• 24/7 trading assistance\n• Risk management guidance\n\n*Contact:* @DynamicCapital_Support`;

          const aboutKeyboard = {
            inline_keyboard: [
              [{ text: "📦 View Packages", callback_data: "view_packages" }],
              [{ text: "🔙 Back to Menu", callback_data: "back_to_main" }]
            ]
          };

          await sendMessage(chatId, aboutMessage, aboutKeyboard);
          break;

        case "start_chat":
          const user = await fetchOrCreateBotUser(userId);
          const isSubscribed = user?.subscription_expires_at && new Date(user.subscription_expires_at) > new Date();
          
          const chatMessage = isSubscribed 
            ? "💬 *AI Chat Active*\n\nSend me any trading questions! As a premium member, you have unlimited conversations.\n\n💡 Try asking about market trends, trading strategies, or technical analysis."
            : "💬 *AI Chat Active*\n\nSend me trading questions! Free users get 10 messages per hour.\n\n💡 Try asking about market trends, trading strategies, or technical analysis.\n\n💎 Upgrade for unlimited conversations!";

          await sendMessage(chatId, chatMessage);
          break;

        case "user_status":
          try {
            const user = await fetchOrCreateBotUser(userId);
            const isSubscribed = user?.subscription_expires_at && new Date(user.subscription_expires_at) > new Date();
            const session = getUserSession(userId);
            
            let statusMessage = `📊 *Your Status*\n\n👤 User ID: ${userId}\n`;
            statusMessage += `📧 Name: ${user?.first_name || 'Not set'}\n`;
            
            if (isSubscribed) {
              statusMessage += `✅ Status: Premium Member\n`;
              statusMessage += `📅 Valid Until: ${new Date(user!.subscription_expires_at!).toLocaleDateString()}\n`;
              statusMessage += `💬 Messages: Unlimited\n`;
            } else {
              statusMessage += `🆓 Status: Free User\n`;
              statusMessage += `💬 Messages Used: ${session.messageCount}/10 this hour\n`;
              statusMessage += `🔄 Resets: Every hour\n`;
            }

            statusMessage += `📅 Joined: ${new Date(user?.created_at || Date.now()).toLocaleDateString()}`;

            const statusKeyboard = {
              inline_keyboard: [
                [{ text: "📦 Upgrade", callback_data: "view_packages" }],
                [{ text: "🔙 Back to Menu", callback_data: "back_to_main" }]
              ]
            };

            await sendMessage(chatId, statusMessage, statusKeyboard);
          } catch (error) {
            await sendMessage(chatId, "❌ Error loading user status. Please try again.");
          }
          break;

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
              ]
            ]
          };
          await sendMessage(chatId, "🤖 *AI Trading Assistant*\n\nWhat would you like to do?", mainMenu);
          break;

        case "new_chat":
          const userSession = getUserSession(userId);
          userSession.messageHistory = [];
          await sendMessage(chatId, "🔄 *New Chat Started*\n\nPrevious conversation cleared. What would you like to discuss?");
          break;

        // Admin functions
        case "admin_stats":
          if (!isAdmin(userId)) return;
          
          try {
            const stats = await getBotStats();
            const statsMessage = `📊 *Bot Statistics*\n\n` +
              `👥 Total Users: ${stats.totalUsers}\n` +
              `💳 Total Payments: ${stats.totalPayments}\n` +
              `📊 Active Subscriptions: ${stats.activeSubscriptions}\n\n` +
              `📅 Last Updated: ${new Date().toLocaleString()}`;
            
            const statsKeyboard = {
              inline_keyboard: [
                [{ text: "🔄 Refresh", callback_data: "admin_stats" }],
                [{ text: "🔙 Back to Admin", callback_data: "back_to_admin" }]
              ]
            };
            
            await sendMessage(chatId, statsMessage, statsKeyboard);
          } catch (error) {
            await sendMessage(chatId, "❌ Error fetching statistics. Please try again.");
          }
          break;

        case "admin_export":
          if (!isAdmin(userId)) return;
          
          const exportKeyboard = {
            inline_keyboard: [
              [
                { text: "👥 Export Users", callback_data: "export_users" },
                { text: "💳 Export Payments", callback_data: "export_payments" }
              ],
              [
                { text: "📊 Export Subscriptions", callback_data: "export_subscriptions" },
                { text: "🎯 Export Analytics", callback_data: "export_analytics" }
              ],
              [
                { text: "🔙 Back to Admin", callback_data: "back_to_admin" }
              ]
            ]
          };
          
          await sendMessage(chatId, "📥 *Export Data*\n\nSelect what data you want to export as CSV:", exportKeyboard);
          break;

        case "admin_users":
          if (!isAdmin(userId)) return;
          
          try {
            const users = await getAllBotUsers();
            let usersMessage = `👥 *User Management*\n\n📊 Total Users: ${users.length}\n\n`;
            
            // Show latest 5 users
            const recentUsers = users.slice(0, 5);
            usersMessage += `*Recent Users:*\n`;
            recentUsers.forEach((user, index) => {
              usersMessage += `${index + 1}. ${user.first_name || 'Unknown'} (@${user.username || 'no_username'})\n`;
              usersMessage += `   ID: ${user.telegram_id}\n`;
              usersMessage += `   Joined: ${new Date(user.created_at).toLocaleDateString()}\n\n`;
            });

            const usersKeyboard = {
              inline_keyboard: [
                [{ text: "📥 Export All Users", callback_data: "export_users" }],
                [{ text: "🔙 Back to Admin", callback_data: "back_to_admin" }]
              ]
            };

            await sendMessage(chatId, usersMessage, usersKeyboard);
          } catch (error) {
            await sendMessage(chatId, "❌ Error loading users. Please try again.");
          }
          break;

        case "back_to_admin":
          if (!isAdmin(userId)) return;
          
          const adminKeyboard = {
            inline_keyboard: [
              [{ text: "📊 View Stats", callback_data: "admin_stats" }],
              [{ text: "📥 Export Data", callback_data: "admin_export" }],
              [{ text: "👥 User Management", callback_data: "admin_users" }]
            ]
          };
          await sendMessage(chatId, "🔧 *Admin Panel*\n\nSelect an option:", adminKeyboard);
          break;

        // Export functions
        case "export_users":
          if (!isAdmin(userId)) return;
          
          try {
            const data = await exportData('bot_users');
            const csvContent = generateCSV(data);
            const csvBuffer = new TextEncoder().encode(csvContent);
            const filename = `bot_users_${new Date().toISOString().split('T')[0]}.csv`;
            const caption = `👥 Bot Users Export\n📊 Records: ${data.length}\n📅 ${new Date().toLocaleString()}`;
            await sendDocument(chatId, csvBuffer, filename, caption);
          } catch (error) {
            await sendMessage(chatId, "❌ Error exporting users data. Please try again.");
          }
          break;

        case "export_payments":
          if (!isAdmin(userId)) return;
          
          try {
            const data = await exportData('payments');
            const csvContent = generateCSV(data);
            const csvBuffer = new TextEncoder().encode(csvContent);
            const filename = `payments_${new Date().toISOString().split('T')[0]}.csv`;
            const caption = `💳 Payments Export\n📊 Records: ${data.length}\n📅 ${new Date().toLocaleString()}`;
            await sendDocument(chatId, csvBuffer, filename, caption);
          } catch (error) {
            await sendMessage(chatId, "❌ Error exporting payments data. Please try again.");
          }
          break;

        case "export_subscriptions":
          if (!isAdmin(userId)) return;
          
          try {
            const data = await exportData('user_subscriptions');
            const csvContent = generateCSV(data);
            const csvBuffer = new TextEncoder().encode(csvContent);
            const filename = `subscriptions_${new Date().toISOString().split('T')[0]}.csv`;
            const caption = `📊 Subscriptions Export\n📊 Records: ${data.length}\n📅 ${new Date().toLocaleString()}`;
            await sendDocument(chatId, csvBuffer, filename, caption);
          } catch (error) {
            await sendMessage(chatId, "❌ Error exporting subscriptions data. Please try again.");
          }
          break;

        case "export_analytics":
          if (!isAdmin(userId)) return;
          
          try {
            const data = await exportData('daily_analytics');
            const csvContent = generateCSV(data);
            const csvBuffer = new TextEncoder().encode(csvContent);
            const filename = `analytics_${new Date().toISOString().split('T')[0]}.csv`;
            const caption = `🎯 Analytics Export\n📊 Records: ${data.length}\n📅 ${new Date().toLocaleString()}`;
            await sendDocument(chatId, csvBuffer, filename, caption);
          } catch (error) {
            await sendMessage(chatId, "❌ Error exporting analytics data. Please try again.");
          }
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