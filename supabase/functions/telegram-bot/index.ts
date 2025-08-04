import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const BINANCE_API_KEY = Deno.env.get("BINANCE_API_KEY");
const BINANCE_SECRET_KEY = Deno.env.get("BINANCE_SECRET_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const ADMIN_USER_IDS = ["225513686"];

// User sessions for features
const userSessions = new Map();
const pendingRegistrations = new Map();
const pendingBroadcasts = new Map();

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
      messageHistory: [],
      awaitingInput: null,
      surveyData: {}
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
            { text: "📈 Trading Tools", callback_data: "trading_tools" },
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

async function getEducationPackages() {
  try {
    const { data, error } = await supabase
      .from('education_packages')
      .select('*, education_categories(*)')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    return data || [];
  } catch (error) {
    console.error('Error fetching education packages:', error);
    return [];
  }
}

async function getActivePromotions() {
  try {
    const { data, error } = await supabase
      .from('promotions')
      .select('*')
      .eq('is_active', true)
      .gte('valid_until', new Date().toISOString())
      .order('created_at', { ascending: false });

    return data || [];
  } catch (error) {
    console.error('Error fetching promotions:', error);
    return [];
  }
}

async function validatePromoCode(code: string, userId: string) {
  try {
    const { data: promo, error } = await supabase
      .from('promotions')
      .select('*')
      .eq('code', code.toUpperCase())
      .eq('is_active', true)
      .gte('valid_until', new Date().toISOString())
      .single();

    if (error || !promo) return null;

    // Check if user already used this promo
    const { data: usage } = await supabase
      .from('promotion_usage')
      .select('*')
      .eq('promotion_id', promo.id)
      .eq('telegram_user_id', userId)
      .single();

    if (usage) return null; // Already used

    // Check usage limits
    if (promo.max_uses && promo.current_uses >= promo.max_uses) return null;

    return promo;
  } catch (error) {
    console.error('Error validating promo code:', error);
    return null;
  }
}

async function getBankAccounts() {
  try {
    const { data, error } = await supabase
      .from('bank_accounts')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    return data || [];
  } catch (error) {
    console.error('Error fetching bank accounts:', error);
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
    const [usersResult, paymentsResult, subscriptionsResult, enrollmentsResult] = await Promise.all([
      supabaseAdmin.from('bot_users').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('payments').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('user_subscriptions').select('id').eq('is_active', true),
      supabaseAdmin.from('education_enrollments').select('id', { count: 'exact', head: true })
    ]);

    return {
      totalUsers: usersResult.count || 0,
      totalPayments: paymentsResult.count || 0,
      activeSubscriptions: subscriptionsResult.data?.length || 0,
      totalEnrollments: enrollmentsResult.count || 0
    };
  } catch (error) {
    console.error('Error fetching bot stats:', error);
    return { totalUsers: 0, totalPayments: 0, activeSubscriptions: 0, totalEnrollments: 0 };
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
}

// Binance API integration
async function callBinanceAPI(symbol: string) {
  try {
    const response = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Binance API error:', error);
    return null;
  }
}

async function getTopCryptos() {
  try {
    const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'DOTUSDT'];
    const promises = symbols.map(symbol => callBinanceAPI(symbol));
    const results = await Promise.all(promises);
    return results.filter(r => r !== null);
  } catch (error) {
    console.error('Error fetching top cryptos:', error);
    return [];
  }
}

// Survey functions
async function startUserSurvey(chatId: number, userId: string) {
  const session = getUserSession(userId);
  session.awaitingInput = 'survey_trading_level';
  session.surveyData = {};

  const keyboard = {
    inline_keyboard: [
      [
        { text: "📈 Beginner", callback_data: "survey_level_beginner" },
        { text: "📊 Intermediate", callback_data: "survey_level_intermediate" }
      ],
      [
        { text: "🏆 Advanced", callback_data: "survey_level_advanced" },
        { text: "👨‍💼 Professional", callback_data: "survey_level_professional" }
      ]
    ]
  };

  await sendMessage(chatId, "📋 *Quick Survey* (1/4)\n\nWhat's your trading experience level?", keyboard);
}

// Broadcast functions
async function sendBroadcastMessage(messageText: string, targetAudience: any = { type: "all" }) {
  try {
    const users = await getAllBotUsers();
    let targetUsers = users;

    // Filter users based on target audience
    if (targetAudience.type === "vip") {
      targetUsers = users.filter(user => user.is_vip);
    } else if (targetAudience.type === "subscribers") {
      targetUsers = users.filter(user => 
        user.subscription_expires_at && new Date(user.subscription_expires_at) > new Date()
      );
    }

    let successCount = 0;
    let failCount = 0;

    for (const user of targetUsers) {
      try {
        const success = await sendMessage(parseInt(user.telegram_id), messageText);
        if (success) {
          successCount++;
        } else {
          failCount++;
        }
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (error) {
        failCount++;
      }
    }

    return { total: targetUsers.length, success: successCount, failed: failCount };
  } catch (error) {
    console.error('Broadcast error:', error);
    return { total: 0, success: 0, failed: 0 };
  }
}

// Analytics tracking function
async function trackDailyAnalytics() {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Get today's stats
    const [usersResult, newUsersResult, interactionsResult] = await Promise.all([
      supabaseAdmin.from('bot_users').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('bot_users').select('id', { count: 'exact', head: true }).gte('created_at', today),
      supabaseAdmin.from('user_interactions').select('interaction_type').gte('created_at', today)
    ]);

    // Update or create daily analytics
    await supabaseAdmin
      .from('daily_analytics')
      .upsert([{
        date: today,
        total_users: usersResult.count || 0,
        new_users: newUsersResult.count || 0,
        button_clicks: {
          start_chat: interactionsResult.data?.filter(i => i.interaction_type === 'start_chat').length || 0,
          view_packages: interactionsResult.data?.filter(i => i.interaction_type === 'view_packages').length || 0,
          trading_tools: interactionsResult.data?.filter(i => i.interaction_type === 'trading_tools').length || 0
        },
        updated_at: new Date().toISOString()
      }]);
      
  } catch (error) {
    console.error('Analytics tracking error:', error);
}

// Enhanced admin helper functions
async function getTotalRevenue() {
  try {
    const { data } = await supabaseAdmin
      .from('payments')
      .select('amount')
      .eq('status', 'completed');
    
    return data?.reduce((sum, payment) => sum + Number(payment.amount), 0) || 0;
  } catch (error) {
    console.error('Error getting total revenue:', error);
    return 0;
  }
}

async function handleQuickStats(chatId: number) {
  try {
    const stats = await getBotStats();
    const today = new Date().toISOString().split('T')[0];
    
    const [todayStatsResult, revenueResult, topPackagesResult] = await Promise.all([
      supabaseAdmin.from('daily_analytics').select('*').eq('date', today).single(),
      supabaseAdmin.from('payments').select('amount, subscription_plans(name)').eq('status', 'completed').limit(10),
      supabaseAdmin.from('user_subscriptions').select('plan_id, subscription_plans(name)').eq('is_active', true)
    ]);

    const revenue = await getTotalRevenue();
    const topPackages = topPackagesResult.data?.reduce((acc: any, sub: any) => {
      const planName = sub.subscription_plans?.name || 'Unknown';
      acc[planName] = (acc[planName] || 0) + 1;
      return acc;
    }, {});

    const quickStats = `📈 *Live Statistics Dashboard*\n\n` +
      `*📊 Overall Performance:*\n` +
      `👥 Total Users: ${stats.totalUsers}\n` +
      `💰 Total Revenue: $${revenue}\n` +
      `📊 Active VIP: ${stats.activeSubscriptions}\n` +
      `🎓 Enrollments: ${stats.totalEnrollments}\n\n` +
      `*📅 Today's Activity:*\n` +
      `👥 New Users: ${todayStatsResult.data?.new_users || 0}\n` +
      `💬 Bot Interactions: ${Object.values(todayStatsResult.data?.button_clicks || {}).reduce((a: number, b: number) => a + b, 0)}\n\n` +
      `*🏆 Top Packages:*\n` +
      `${Object.entries(topPackages || {}).slice(0, 3).map(([name, count]) => `• ${name}: ${count} active`).join('\n')}\n\n` +
      `🕒 Updated: ${new Date().toLocaleString()}`;

    await sendMessage(chatId, quickStats);
  } catch (error) {
    await sendMessage(chatId, "❌ Error retrieving statistics");
  }
}

async function handleUserLookup(chatId: number, text: string) {
  try {
    const targetUserId = text.split(' ')[1];
    if (!targetUserId) {
      await sendMessage(chatId, "Usage: /user <telegram_id>");
      return;
    }

    const user = await fetchOrCreateBotUser(targetUserId);
    if (!user) {
      await sendMessage(chatId, "❌ User not found");
      return;
    }

    // Get user's subscription info
    const { data: subscription } = await supabaseAdmin
      .from('user_subscriptions')
      .select('*, subscription_plans(*)')
      .eq('telegram_user_id', targetUserId)
      .eq('is_active', true)
      .single();

    // Get user's payment history
    const { data: payments } = await supabaseAdmin
      .from('payments')
      .select('amount, status, created_at')
      .eq('user_id', targetUserId)
      .order('created_at', { ascending: false })
      .limit(3);

    const userInfo = `👤 *User Profile: ${user.first_name}*\n\n` +
      `🆔 Telegram ID: ${user.telegram_id}\n` +
      `👤 Full Name: ${user.first_name} ${user.last_name || ''}\n` +
      `📧 Username: @${user.username || 'none'}\n` +
      `💎 VIP Status: ${user.is_vip ? '✅ Active' : '❌ Inactive'}\n` +
      `📅 Joined: ${new Date(user.created_at).toLocaleDateString()}\n\n` +
      `*💳 Subscription Info:*\n` +
      `${subscription ? 
        `📦 Plan: ${subscription.subscription_plans?.name}\n` +
        `📅 Expires: ${new Date(subscription.subscription_end_date).toLocaleDateString()}\n` +
        `💰 Status: ${subscription.payment_status}` 
        : '❌ No active subscription'}\n\n` +
      `*💰 Recent Payments:*\n` +
      `${payments?.length ? 
        payments.map(p => `• $${p.amount} - ${p.status} (${new Date(p.created_at).toLocaleDateString()})`).join('\n')
        : '❌ No payments found'}`;

    const userControlKeyboard = {
      inline_keyboard: [
        [
          { text: "💎 Toggle VIP", callback_data: `admin_toggle_vip_${targetUserId}` },
          { text: "📊 Full History", callback_data: `admin_user_history_${targetUserId}` }
        ],
        [
          { text: "💬 Send Message", callback_data: `admin_message_user_${targetUserId}` },
          { text: "🚫 Ban User", callback_data: `admin_ban_user_${targetUserId}` }
        ]
      ]
    };

    await sendMessage(chatId, userInfo, userControlKeyboard);
  } catch (error) {
    await sendMessage(chatId, "❌ Error retrieving user information");
  }
}

async function handleSubscriptionControl(chatId: number, text: string) {
  try {
    const parts = text.split(' ');
    const targetUserId = parts[1];
    const action = parts[2]; // activate/deactivate/extend

    if (!targetUserId || !action) {
      await sendMessage(chatId, "Usage: /sub <telegram_id> <activate/deactivate/extend>");
      return;
    }

    const user = await fetchOrCreateBotUser(targetUserId);
    if (!user) {
      await sendMessage(chatId, "❌ User not found");
      return;
    }

    let result = "";
    
    switch (action.toLowerCase()) {
      case 'activate':
        await supabaseAdmin
          .from('bot_users')
          .update({ 
            is_vip: true,
            subscription_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
          })
          .eq('telegram_id', targetUserId);
        
        result = `✅ VIP activated for user ${targetUserId} (30 days)`;
        break;
        
      case 'deactivate':
        await supabaseAdmin
          .from('bot_users')
          .update({ 
            is_vip: false,
            subscription_expires_at: null
          })
          .eq('telegram_id', targetUserId);
        
        result = `❌ VIP deactivated for user ${targetUserId}`;
        break;
        
      case 'extend':
        const extendDays = parseInt(parts[3]) || 30;
        const currentExpiry = user.subscription_expires_at ? new Date(user.subscription_expires_at) : new Date();
        const newExpiry = new Date(currentExpiry.getTime() + extendDays * 24 * 60 * 60 * 1000);
        
        await supabaseAdmin
          .from('bot_users')
          .update({ 
            is_vip: true,
            subscription_expires_at: newExpiry.toISOString()
          })
          .eq('telegram_id', targetUserId);
        
        result = `⏰ VIP extended for user ${targetUserId} by ${extendDays} days`;
        break;
        
      default:
        result = "❌ Invalid action. Use: activate, deactivate, or extend";
    }

    await sendMessage(chatId, result);
    
    // Notify the user
    await sendMessage(parseInt(targetUserId), 
      `🔔 *Subscription Update*\n\nYour subscription has been ${action}d by an administrator.\n\nFor questions, contact support.`
    );
    
  } catch (error) {
    await sendMessage(chatId, "❌ Error managing subscription");
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
      const lastName = message.from.last_name;
      const username = message.from.username;
      const text = message.text;

      // Create or fetch user in database
      await fetchOrCreateBotUser(userId, firstName, lastName, username);

      if (text?.startsWith('/start')) {
        const user = await fetchOrCreateBotUser(userId, firstName, lastName, username);
        const isSubscribed = user?.subscription_expires_at && new Date(user.subscription_expires_at) > new Date();
        
        // Enhanced welcome message
        let welcomeMessage = `🤖 *Welcome to AI Trading Assistant!*\n\n`;
        
        if (user && user.created_at && new Date(user.created_at).toDateString() === new Date().toDateString()) {
          // New user
          welcomeMessage += `👋 Hello ${firstName || 'Trader'}! Welcome to our community!\n\n`;
          welcomeMessage += `🎉 *You've just joined thousands of successful traders!*\n\n`;
          welcomeMessage += `✨ *What you get access to:*\n`;
          welcomeMessage += `• 🤖 AI-powered trading advice\n`;
          welcomeMessage += `• 📈 Real-time market analysis\n`;
          welcomeMessage += `• 🎓 Professional trading education\n`;
          welcomeMessage += `• 💎 Exclusive VIP features\n`;
          welcomeMessage += `• 🎯 Personalized trading strategies\n\n`;
        } else {
          // Returning user
          welcomeMessage += `👋 Welcome back, ${firstName || 'Trader'}!\n\n`;
        }
        
        if (isSubscribed) {
          welcomeMessage += `✅ *Premium Member Status*\n`;
          welcomeMessage += `📅 Valid until: ${new Date(user.subscription_expires_at!).toLocaleDateString()}\n`;
          welcomeMessage += `💎 You have access to all premium features!\n\n`;
        } else {
          welcomeMessage += `🆓 *Free Trial User*\n`;
          welcomeMessage += `📊 10 AI messages per hour\n`;
          welcomeMessage += `💎 Upgrade to unlock unlimited features!\n\n`;
        }
        
        welcomeMessage += `🚀 *Ready to start your trading journey?*\n`;
        welcomeMessage += `Choose an option below to get started:`;
        
        const mainMenu = {
          inline_keyboard: [
            [
              { text: "🎓 Education Hub", callback_data: "view_education" },
              { text: "📦 VIP Packages", callback_data: "view_packages" }
            ],
            [
              { text: "💬 AI Trading Chat", callback_data: "start_chat" },
              { text: "📈 Trading Tools", callback_data: "trading_tools" }
            ],
            [
              { text: "🎯 Active Promotions", callback_data: "view_promotions" },
              { text: "📊 My Account", callback_data: "user_status" }
            ],
            [
              { text: "ℹ️ About Us", callback_data: "about_us" },
              { text: "💬 Get Support", callback_data: "contact_support" }
            ]
          ]
        };

        await sendMessage(chatId, welcomeMessage, mainMenu);
        
        // Track new user analytics
        if (user && user.created_at && new Date(user.created_at).toDateString() === new Date().toDateString()) {
          await supabaseAdmin
            .from('user_interactions')
            .insert([{
              telegram_user_id: userId,
              interaction_type: 'bot_start',
              page_context: 'welcome',
              interaction_data: { 
                is_new_user: true,
                first_name: firstName,
                username: username
              }
            }]);
        }
      } else if (text?.startsWith('/admin') && isAdmin(userId)) {
        const stats = await getBotStats();
        
        const adminKeyboard = {
          inline_keyboard: [
            [
              { text: "📊 Live Dashboard", callback_data: "admin_live_stats" },
              { text: "👥 User Management", callback_data: "admin_users" }
            ],
            [
              { text: "💳 Subscription Control", callback_data: "admin_subscriptions" },
              { text: "📦 Package Performance", callback_data: "admin_packages" }
            ],
            [
              { text: "📢 Broadcast System", callback_data: "admin_broadcast" },
              { text: "📥 Data Export", callback_data: "admin_export" }
            ],
            [
              { text: "⚙️ Bot Settings", callback_data: "admin_settings" },
              { text: "🔧 System Tools", callback_data: "admin_tools" }
            ]
          ]
        };

        const adminMessage = `🔧 *Admin Control Panel*\n\n` +
          `📊 *Current Statistics:*\n` +
          `👥 Total Users: ${stats.totalUsers}\n` +
          `💰 Total Revenue: $${await getTotalRevenue()}\n` +
          `📊 Active Subs: ${stats.activeSubscriptions}\n` +
          `🎓 Enrollments: ${stats.totalEnrollments}\n\n` +
          `⚡ *System Status: Online*\n` +
          `🕒 Last Update: ${new Date().toLocaleString()}\n\n` +
          `Select a management option:`;

        await sendMessage(chatId, adminMessage, adminKeyboard);
      } else if (text?.startsWith('/stats') && isAdmin(userId)) {
        // Quick stats command for admins
        await handleQuickStats(chatId);
      } else if (text?.startsWith('/broadcast') && isAdmin(userId)) {
        const session = getUserSession(userId);
        session.awaitingInput = 'admin_broadcast_quick';
        
        await sendMessage(chatId, "📢 *Quick Broadcast*\n\nSend me the message to broadcast to all users:");
      } else if (text?.startsWith('/user') && isAdmin(userId)) {
        // User lookup command: /user 123456789
        await handleUserLookup(chatId, text);
      } else if (text?.startsWith('/sub') && isAdmin(userId)) {
        // Subscription management: /sub 123456789 activate/deactivate
        await handleSubscriptionControl(chatId, text);
      } else if (text && !text.startsWith('/')) {
        const session = getUserSession(userId);
        
        // Handle special input modes
        if (session.awaitingInput) {
          switch (session.awaitingInput) {
            case 'promo_code':
              try {
                const promo = await validatePromoCode(text, userId);
                if (promo) {
                  // Record promo analytics
                  await supabaseAdmin
                    .from('promo_analytics')
                    .insert([{
                      promo_code: promo.code,
                      telegram_user_id: userId,
                      event_type: 'applied'
                    }]);

                  const successMessage = `✅ *Promo Code Applied!*\n\n` +
                    `🎁 Code: **${promo.code}**\n` +
                    `💰 Discount: ${promo.discount_type === 'percentage' ? promo.discount_value + '%' : '$' + promo.discount_value} OFF\n\n` +
                    `This discount will be applied to your next purchase!`;

                  const successKeyboard = {
                    inline_keyboard: [
                      [{ text: "📦 View Packages", callback_data: "view_packages" }],
                      [{ text: "🔙 Main Menu", callback_data: "back_to_main" }]
                    ]
                  };

                  await sendMessage(chatId, successMessage, successKeyboard);
                } else {
                  await sendMessage(chatId, "❌ Invalid or expired promo code. Please try again or contact support.");
                }
                session.awaitingInput = null;
              } catch (error) {
                await sendMessage(chatId, "❌ Error validating promo code. Please try again.");
                session.awaitingInput = null;
              }
              break;

            case 'broadcast_message':
              if (isAdmin(userId)) {
                try {
                  const result = await sendBroadcastMessage(text, session.broadcastAudience);
                  
                  // Save broadcast to database
                  await supabaseAdmin
                    .from('broadcast_messages')
                    .insert([{
                      title: 'Admin Broadcast',
                      content: text,
                      target_audience: session.broadcastAudience,
                      total_recipients: result.total,
                      successful_deliveries: result.success,
                      failed_deliveries: result.failed,
                      delivery_status: 'completed',
                      sent_at: new Date().toISOString()
                    }]);

                  const resultMessage = `📢 *Broadcast Completed!*\n\n` +
                    `📊 Total Recipients: ${result.total}\n` +
                    `✅ Successful: ${result.success}\n` +
                    `❌ Failed: ${result.failed}\n\n` +
                    `Message sent to ${session.broadcastAudience.type} users.`;

                  await sendMessage(chatId, resultMessage);
                  session.awaitingInput = null;
                  session.broadcastAudience = null;
                } catch (error) {
                  await sendMessage(chatId, "❌ Error sending broadcast. Please try again.");
                  session.awaitingInput = null;
                }
              }
              break;

            default:
              // Fall back to AI chat
              const user = await fetchOrCreateBotUser(userId, firstName, lastName, username);
              const isSubscribed = user?.subscription_expires_at && new Date(user.subscription_expires_at) > new Date();
              
              if (isSubscribed) {
                session.messageCount = 0; // Reset for premium users
              }
              
              await handleAIChat(chatId, text, userId);
              break;
          }
        } else {
          // Regular AI Chat functionality
          const user = await fetchOrCreateBotUser(userId, firstName, lastName, username);
          const isSubscribed = user?.subscription_expires_at && new Date(user.subscription_expires_at) > new Date();
          
          if (isSubscribed) {
            session.messageCount = 0; // Reset for premium users
          }
          
          await handleAIChat(chatId, text, userId);
        }
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
              const emptyKeyboard = {
                inline_keyboard: [
                  [{ text: "🔙 Back to Menu", callback_data: "back_to_main" }]
                ]
              };
              await sendMessage(chatId, packageMessage, emptyKeyboard);
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

              // Create individual buttons for each package
              const packageButtons = plans.map((plan, index) => [
                { text: `📦 Select ${plan.name}`, callback_data: `select_package_${plan.id}` }
              ]);

              const packageKeyboard = {
                inline_keyboard: [
                  ...packageButtons,
                  [{ text: "🔙 Back to Menu", callback_data: "back_to_main" }]
                ]
              };

              await sendMessage(chatId, packageMessage, packageKeyboard);
            }
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

        // New features
        case "view_education":
          try {
            const packages = await getEducationPackages();
            let educationMessage = "🎓 *Education Packages*\n\n";
            
            if (packages.length === 0) {
              educationMessage += "No education packages available at the moment.";
            } else {
              packages.forEach((pkg, index) => {
                educationMessage += `${index + 1}. **${pkg.name}**\n`;
                educationMessage += `   💰 Price: $${pkg.price} ${pkg.currency}\n`;
                educationMessage += `   📅 Duration: ${pkg.duration_weeks} weeks\n`;
                if (pkg.description) {
                  educationMessage += `   📝 ${pkg.description}\n`;
                }
                educationMessage += `\n`;
              });
            }

            const educationKeyboard = {
              inline_keyboard: [
                [{ text: "📝 Enroll Now", callback_data: "education_enroll" }],
                [{ text: "🔙 Back to Menu", callback_data: "back_to_main" }]
              ]
            };

            await sendMessage(chatId, educationMessage, educationKeyboard);
          } catch (error) {
            await sendMessage(chatId, "❌ Error loading education packages. Please try again.");
          }
          break;

        case "view_promotions":
          try {
            const promotions = await getActivePromotions();
            let promoMessage = "🎯 *Active Promotions*\n\n";
            
            if (promotions.length === 0) {
              promoMessage += "No active promotions at the moment.\n\nCheck back later for exciting offers!";
            } else {
              promotions.forEach((promo, index) => {
                promoMessage += `${index + 1}. **${promo.code}**\n`;
                promoMessage += `   🎁 ${promo.discount_type === 'percentage' ? promo.discount_value + '%' : '$' + promo.discount_value} OFF\n`;
                promoMessage += `   📅 Valid until: ${new Date(promo.valid_until).toLocaleDateString()}\n`;
                if (promo.description) {
                  promoMessage += `   📝 ${promo.description}\n`;
                }
                promoMessage += `\n`;
              });
            }

            const promoKeyboard = {
              inline_keyboard: [
                [{ text: "💳 Apply Promo Code", callback_data: "apply_promo" }],
                [{ text: "🔙 Back to Menu", callback_data: "back_to_main" }]
              ]
            };

            await sendMessage(chatId, promoMessage, promoKeyboard);
          } catch (error) {
            await sendMessage(chatId, "❌ Error loading promotions. Please try again.");
          }
          break;

        case "trading_tools":
          try {
            const cryptos = await getTopCryptos();
            let tradingMessage = "📈 *Trading Tools & Market Data*\n\n";
            
            if (cryptos.length > 0) {
              tradingMessage += "💰 *Top Cryptocurrencies (24h)*\n\n";
              cryptos.forEach((crypto, index) => {
                const symbol = crypto.symbol.replace('USDT', '/USDT');
                const price = parseFloat(crypto.lastPrice).toFixed(2);
                const change = parseFloat(crypto.priceChangePercent).toFixed(2);
                const changeEmoji = parseFloat(change) >= 0 ? '🟢' : '🔴';
                
                tradingMessage += `${index + 1}. **${symbol}**\n`;
                tradingMessage += `   💵 $${price}\n`;
                tradingMessage += `   ${changeEmoji} ${change}% (24h)\n\n`;
              });
            }

            const tradingKeyboard = {
              inline_keyboard: [
                [
                  { text: "📊 Market Analysis", callback_data: "market_analysis" },
                  { text: "🎯 Trading Signals", callback_data: "trading_signals" }
                ],
                [
                  { text: "📈 Portfolio Tracker", callback_data: "portfolio_tracker" },
                  { text: "⚠️ Risk Calculator", callback_data: "risk_calculator" }
                ],
                [
                  { text: "🔙 Back to Menu", callback_data: "back_to_main" }
                ]
              ]
            };

            await sendMessage(chatId, tradingMessage, tradingKeyboard);
          } catch (error) {
            await sendMessage(chatId, "❌ Error loading trading tools. Please try again.");
          }
          break;

        case "subscribe_menu":
          try {
            const bankAccounts = await getBankAccounts();
            let paymentMessage = "💳 *Payment Methods*\n\n";
            
            paymentMessage += "Choose your preferred payment method:\n\n";
            
            if (bankAccounts.length > 0) {
              paymentMessage += "🏦 *Bank Transfer*\n";
              bankAccounts.forEach((bank, index) => {
                paymentMessage += `${index + 1}. **${bank.bank_name}**\n`;
                paymentMessage += `   💳 ${bank.account_name}\n`;
                paymentMessage += `   🔢 ${bank.account_number}\n`;
                paymentMessage += `   💰 Currency: ${bank.currency}\n\n`;
              });
            }

            const paymentKeyboard = {
              inline_keyboard: [
                [
                  { text: "🏦 Bank Transfer", callback_data: "payment_bank" },
                  { text: "₿ Crypto Payment", callback_data: "payment_crypto" }
                ],
                [
                  { text: "💳 Binance Pay", callback_data: "payment_binance" }
                ],
                [
                  { text: "🔙 Back to Packages", callback_data: "view_packages" }
                ]
              ]
            };

            await sendMessage(chatId, paymentMessage, paymentKeyboard);
          } catch (error) {
            await sendMessage(chatId, "❌ Error loading payment methods. Please try again.");
          }
          break;

        case "payment_binance":
          try {
            const plans = await getSubscriptionPlans();
            let binanceMessage = "₿ *Binance Pay - Select Package*\n\n" +
              "🚀 Fast, secure crypto payments\n" +
              "💰 Low transaction fees\n" +
              "🔒 Instant confirmation\n\n" +
              "Select a package to pay with Binance Pay:\n\n";

            if (plans.length === 0) {
              binanceMessage += "No packages available at the moment.";
              const emptyKeyboard = {
                inline_keyboard: [
                  [{ text: "🔙 Back to Payment Methods", callback_data: "subscribe_menu" }]
                ]
              };
              await sendMessage(chatId, binanceMessage, emptyKeyboard);
            } else {
              plans.forEach((plan, index) => {
                binanceMessage += `${index + 1}. **${plan.name}** - $${plan.price} ${plan.currency}\n`;
              });

              // Create Binance Pay buttons for each package
              const binanceButtons = plans.map((plan, index) => [
                { text: `₿ Pay $${plan.price} - ${plan.name}`, callback_data: `binance_checkout_${plan.id}` }
              ]);

              const binanceKeyboard = {
                inline_keyboard: [
                  ...binanceButtons,
                  [{ text: "🔙 Back to Payment Methods", callback_data: "subscribe_menu" }]
                ]
              };

              await sendMessage(chatId, binanceMessage, binanceKeyboard);
            }
          } catch (error) {
            await sendMessage(chatId, "❌ Error loading Binance Pay options. Please try again.");
          }
          break;

        case "apply_promo":
          const session = getUserSession(userId);
          session.awaitingInput = 'promo_code';
          
          await sendMessage(chatId, "🎯 *Apply Promo Code*\n\nSend me your promo code:");
          break;

        case "education_enroll":
          const enrollMessage = "🎓 *Education Enrollment*\n\n" +
            "To enroll in our education programs:\n\n" +
            "1️⃣ Choose your package\n" +
            "2️⃣ Complete payment\n" +
            "3️⃣ Receive course materials\n" +
            "4️⃣ Start learning!\n\n" +
            "📞 Contact our education team for personalized guidance.";

          const enrollKeyboard = {
            inline_keyboard: [
              [{ text: "📝 Take Survey", callback_data: "start_survey" }],
              [{ text: "💬 Contact Education Team", callback_data: "contact_education" }],
              [{ text: "🔙 Back", callback_data: "view_education" }]
            ]
          };

          await sendMessage(chatId, enrollMessage, enrollKeyboard);
          break;

        case "start_survey":
          await startUserSurvey(chatId, userId);
          break;

        // Survey handlers
        case "survey_level_beginner":
        case "survey_level_intermediate":
        case "survey_level_advanced":
        case "survey_level_professional":
          const session2 = getUserSession(userId);
          session2.surveyData.trading_level = data.replace('survey_level_', '');
          session2.awaitingInput = 'survey_main_goal';

          const goalKeyboard = {
            inline_keyboard: [
              [
                { text: "💰 Generate Income", callback_data: "survey_goal_income" },
                { text: "📈 Learn Trading", callback_data: "survey_goal_learn" }
              ],
              [
                { text: "🎯 Diversify Portfolio", callback_data: "survey_goal_diversify" },
                { text: "🏆 Professional Trading", callback_data: "survey_goal_professional" }
              ]
            ]
          };

          await sendMessage(chatId, "📋 *Quick Survey* (2/4)\n\nWhat's your main trading goal?", goalKeyboard);
          break;

        case "survey_goal_income":
        case "survey_goal_learn":
        case "survey_goal_diversify":
        case "survey_goal_professional":
          const session3 = getUserSession(userId);
          session3.surveyData.main_goal = data.replace('survey_goal_', '');
          session3.awaitingInput = 'survey_trading_frequency';

          const freqKeyboard = {
            inline_keyboard: [
              [
                { text: "📅 Daily", callback_data: "survey_freq_daily" },
                { text: "📆 Weekly", callback_data: "survey_freq_weekly" }
              ],
              [
                { text: "🗓️ Monthly", callback_data: "survey_freq_monthly" },
                { text: "🎯 Occasional", callback_data: "survey_freq_occasional" }
              ]
            ]
          };

          await sendMessage(chatId, "📋 *Quick Survey* (3/4)\n\nHow often do you plan to trade?", freqKeyboard);
          break;

        case "survey_freq_daily":
        case "survey_freq_weekly":
        case "survey_freq_monthly":
        case "survey_freq_occasional":
          const session4 = getUserSession(userId);
          session4.surveyData.trading_frequency = data.replace('survey_freq_', '');
          session4.awaitingInput = 'survey_monthly_budget';

          const budgetKeyboard = {
            inline_keyboard: [
              [
                { text: "💵 Under $1,000", callback_data: "survey_budget_1000" },
                { text: "💰 $1,000-$5,000", callback_data: "survey_budget_5000" }
              ],
              [
                { text: "💎 $5,000-$10,000", callback_data: "survey_budget_10000" },
                { text: "🏆 Over $10,000", callback_data: "survey_budget_over" }
              ]
            ]
          };

          await sendMessage(chatId, "📋 *Quick Survey* (4/4)\n\nWhat's your monthly trading budget?", budgetKeyboard);
          break;

        case "survey_budget_1000":
        case "survey_budget_5000":
        case "survey_budget_10000":
        case "survey_budget_over":
          const session5 = getUserSession(userId);
          session5.surveyData.monthly_budget = data.replace('survey_budget_', '');
          
          // Save survey to database
          try {
            await supabaseAdmin
              .from('user_surveys')
              .insert([{
                telegram_user_id: userId,
                trading_level: session5.surveyData.trading_level,
                main_goal: session5.surveyData.main_goal,
                trading_frequency: session5.surveyData.trading_frequency,
                monthly_budget: session5.surveyData.monthly_budget
              }]);

            const completionMessage = "✅ *Survey Completed!*\n\n" +
              "Thank you for completing our survey. Based on your responses, our team will recommend the best trading package for you.\n\n" +
              "🎯 *Your Profile:*\n" +
              `📈 Level: ${session5.surveyData.trading_level}\n` +
              `🎯 Goal: ${session5.surveyData.main_goal}\n` +
              `📅 Frequency: ${session5.surveyData.trading_frequency}\n` +
              `💰 Budget: ${session5.surveyData.monthly_budget}\n\n` +
              "A team member will contact you soon with personalized recommendations!";

            const completionKeyboard = {
              inline_keyboard: [
                [{ text: "📦 View Packages", callback_data: "view_packages" }],
                [{ text: "🔙 Main Menu", callback_data: "back_to_main" }]
              ]
            };

            await sendMessage(chatId, completionMessage, completionKeyboard);
            
            // Clear survey data
            session5.surveyData = {};
            session5.awaitingInput = null;
          } catch (error) {
            await sendMessage(chatId, "❌ Error saving survey. Please try again.");
          }
          break;

        // Admin broadcast functionality
        case "admin_broadcast":
          if (!isAdmin(userId)) return;
          
          const broadcastKeyboard = {
            inline_keyboard: [
              [{ text: "📢 Send to All Users", callback_data: "broadcast_all" }],
              [{ text: "💎 Send to VIP Users", callback_data: "broadcast_vip" }],
              [{ text: "📊 Send to Subscribers", callback_data: "broadcast_subscribers" }],
              [{ text: "🔙 Back to Admin", callback_data: "back_to_admin" }]
            ]
          };
          
          await sendMessage(chatId, "📢 *Broadcast Message*\n\nChoose your target audience:", broadcastKeyboard);
          break;

        case "broadcast_all":
        case "broadcast_vip":
        case "broadcast_subscribers":
          if (!isAdmin(userId)) return;
          
          const audienceType = data.replace('broadcast_', '');
          const sessionB = getUserSession(userId);
          sessionB.awaitingInput = 'broadcast_message';
          sessionB.broadcastAudience = { type: audienceType };
          
          await sendMessage(chatId, `📢 *Broadcast to ${audienceType} users*\n\nSend me the message you want to broadcast:`);
          break;

        default:
          // Handle individual package selection
          if (data.startsWith('select_package_')) {
            const packageId = data.replace('select_package_', '');
            
            try {
              const { data: selectedPlan, error } = await supabase
                .from('subscription_plans')
                .select('*')
                .eq('id', packageId)
                .single();

              if (error || !selectedPlan) {
                await sendMessage(chatId, "❌ Package not found. Please try again.");
                return;
              }

              const packageDetails = `📦 *${selectedPlan.name}* Selected\n\n` +
                `💰 Price: $${selectedPlan.price}${selectedPlan.duration_months > 0 ? `/${selectedPlan.duration_months}mo` : selectedPlan.is_lifetime ? ' (Lifetime)' : ''}\n` +
                `💰 Currency: ${selectedPlan.currency}\n` +
                (selectedPlan.features?.length > 0 ? `✨ Features:\n${selectedPlan.features.map(f => `• ${f}`).join('\n')}\n\n` : '\n') +
                `Ready to subscribe to this package?`;

              const packageSelectionKeyboard = {
                inline_keyboard: [
                  [
                    { text: "💳 Subscribe Now", callback_data: "subscribe_menu" },
                    { text: "🎯 Apply Promo", callback_data: "apply_promo" }
                  ],
                  [
                    { text: "🔙 Back to Packages", callback_data: "view_packages" },
                    { text: "💬 Contact Support", callback_data: "contact_support" }
                  ]
                ]
              };

              await sendMessage(chatId, packageDetails, packageSelectionKeyboard);
            } catch (error) {
              await sendMessage(chatId, "❌ Error loading package details. Please try again.");
            }
          } 
          // Handle Binance Pay checkout
          else if (data.startsWith('binance_checkout_')) {
            const packageId = data.replace('binance_checkout_', '');
            
            try {
              const { data: selectedPlan, error } = await supabase
                .from('subscription_plans')
                .select('*')
                .eq('id', packageId)
                .single();

              if (error || !selectedPlan) {
                await sendMessage(chatId, "❌ Package not found. Please try again.");
                return;
              }

              // Call Binance Pay checkout edge function
              const checkoutResponse = await supabase.functions.invoke('binance-pay-checkout', {
                body: {
                  planId: packageId,
                  telegramUserId: userId,
                  telegramUsername: callbackQuery.from.username || callbackQuery.from.first_name
                }
              });

              if (checkoutResponse.error) {
                throw new Error(checkoutResponse.error.message);
              }

              const checkoutData = checkoutResponse.data;

              if (!checkoutData.success) {
                throw new Error(checkoutData.error || 'Failed to create Binance Pay checkout');
              }

              const checkoutMessage = `₿ *Binance Pay Checkout*\n\n` +
                `📦 Package: **${selectedPlan.name}**\n` +
                `💰 Amount: $${selectedPlan.price} USDT\n` +
                `🆔 Payment ID: ${checkoutData.paymentId}\n\n` +
                `🚀 *Automatic Payment Options:*\n` +
                `• Tap "Open Binance App" to pay instantly\n` +
                `• Scan QR code with Binance app\n` +
                `• Use the web checkout link\n\n` +
                `⚡ Payment will be confirmed automatically!`;

              const checkoutKeyboard = {
                inline_keyboard: [
                  [{ text: "🚀 Open Binance App", url: checkoutData.deeplink || checkoutData.universalUrl }],
                  [{ text: "📱 QR Code Payment", url: checkoutData.qrCodeUrl }],
                  [{ text: "🌐 Web Checkout", url: checkoutData.checkoutUrl }],
                  [
                    { text: "📊 Check Payment Status", callback_data: `check_payment_${checkoutData.paymentId}` },
                    { text: "💬 Support", callback_data: "contact_support" }
                  ],
                  [{ text: "🔙 Back to Packages", callback_data: "view_packages" }]
                ]
              };

              await sendMessage(chatId, checkoutMessage, checkoutKeyboard);
            } catch (error) {
              console.error('Binance Pay checkout error:', error);
              await sendMessage(chatId, "❌ Error creating Binance Pay checkout. Please try again or contact support.");
            }
          }
          // Handle payment status check
          else if (data.startsWith('check_payment_')) {
            const paymentId = data.replace('check_payment_', '');
            
            try {
              const { data: payment, error } = await supabaseAdmin
                .from('payments')
                .select('*')
                .eq('id', paymentId)
                .single();

              if (error || !payment) {
                await sendMessage(chatId, "❌ Payment not found. Please contact support.");
                return;
              }

              let statusMessage = `📊 *Payment Status*\n\n`;
              statusMessage += `🆔 Payment ID: ${payment.id}\n`;
              statusMessage += `💰 Amount: $${payment.amount} ${payment.currency}\n`;
              
              if (payment.status === 'completed') {
                statusMessage += `✅ Status: **COMPLETED**\n`;
                statusMessage += `🎉 Your subscription has been activated!\n\n`;
                statusMessage += `Thank you for your payment!`;
              } else if (payment.status === 'pending') {
                statusMessage += `⏳ Status: **PENDING**\n`;
                statusMessage += `⏰ Waiting for payment confirmation...\n\n`;
                statusMessage += `You'll be notified once payment is confirmed.`;
              } else {
                statusMessage += `❌ Status: **${payment.status.toUpperCase()}**\n`;
                statusMessage += `Please contact support for assistance.`;
              }

              const statusKeyboard = {
                inline_keyboard: [
                  [{ text: "🔄 Refresh Status", callback_data: `check_payment_${paymentId}` }],
                  [
                    { text: "💬 Contact Support", callback_data: "contact_support" },
                    { text: "🔙 Main Menu", callback_data: "back_to_main" }
                  ]
                ]
              };

              await sendMessage(chatId, statusMessage, statusKeyboard);
            } catch (error) {
              await sendMessage(chatId, "❌ Error checking payment status. Please try again.");
            }
          }
          else {
            // Handle contact support and other features
            if (data === 'contact_support') {
              const supportMessage = "💬 *Contact Support*\n\n" +
                "Our support team is here to help! Choose how you'd like to get assistance:";

              const supportKeyboard = {
                inline_keyboard: [
                  [{ text: "📞 Live Chat", url: "https://t.me/DynamicCapital_Support" }],
                  [{ text: "📧 Email Support", url: "mailto:support@dynamiccapital.com" }],
                  [{ text: "❓ FAQ", callback_data: "view_faq" }],
                  [{ text: "🔙 Back to Menu", callback_data: "back_to_main" }]
                ]
              };

              await sendMessage(chatId, supportMessage, supportKeyboard);
            } else {
              await sendMessage(chatId, "🚧 Feature coming soon!");
            }
          }
          break;
      }
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Error:", error);
    return new Response("Error", { status: 500 });
  }
});