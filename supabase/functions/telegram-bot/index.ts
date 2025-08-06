/* eslint-disable no-case-declarations */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

console.log("🚀 Bot starting with environment check...");
console.log("BOT_TOKEN exists:", !!BOT_TOKEN);
console.log("SUPABASE_URL exists:", !!SUPABASE_URL);
console.log("SUPABASE_SERVICE_ROLE_KEY exists:", !!SUPABASE_SERVICE_ROLE_KEY);

if (!BOT_TOKEN || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
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

// Bot startup time for status tracking
const BOT_START_TIME = new Date();
console.log("🕐 Bot started at:", BOT_START_TIME.toISOString());

// Session Management Functions
async function startBotSession(telegramUserId: string, userInfo: any = {}): Promise<string> {
  try {
    console.log(`🔄 Starting session for user: ${telegramUserId}`);
    
    // End any existing active sessions
    await endBotSession(telegramUserId);
    
    // Create new session
    const { data, error } = await supabaseAdmin
      .from('bot_sessions')
      .insert({
        telegram_user_id: telegramUserId,
        session_start: new Date().toISOString(),
        session_data: userInfo,
        activity_count: 1
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error creating session:', error);
      return '';
    }

    // Store in memory for quick access
    activeBotSessions.set(telegramUserId, {
      sessionId: data.id,
      startTime: new Date(),
      activityCount: 1
    });

    console.log(`✅ Session started for user ${telegramUserId}, session ID: ${data.id}`);
    return data.id;
  } catch (error) {
    console.error('🚨 Exception starting session:', error);
    return '';
  }
}

async function updateBotSession(telegramUserId: string, activityData: any = {}): Promise<void> {
  try {
    const session = activeBotSessions.get(telegramUserId);
    if (!session) {
      // Start new session if none exists
      await startBotSession(telegramUserId, activityData);
      return;
    }

    session.activityCount++;
    session.lastActivity = new Date();

    // Update in database
    await supabaseAdmin
      .from('bot_sessions')
      .update({
        activity_count: session.activityCount,
        session_data: activityData,
        updated_at: new Date().toISOString()
      })
      .eq('id', session.sessionId);

    console.log(`📊 Session updated for user ${telegramUserId}, activities: ${session.activityCount}`);
  } catch (error) {
    console.error('🚨 Error updating session:', error);
  }
}

async function endBotSession(telegramUserId: string): Promise<void> {
  try {
    const session = activeBotSessions.get(telegramUserId);
    if (!session) return;

    const endTime = new Date();
    const durationMinutes = Math.floor((endTime.getTime() - session.startTime.getTime()) / 1000 / 60);

    // Update database
    await supabaseAdmin
      .from('bot_sessions')
      .update({
        session_end: endTime.toISOString(),
        duration_minutes: durationMinutes,
        updated_at: endTime.toISOString()
      })
      .eq('id', session.sessionId);

    // Remove from memory
    activeBotSessions.delete(telegramUserId);

    console.log(`⏰ Session ended for user ${telegramUserId}, duration: ${durationMinutes} minutes`);
  } catch (error) {
    console.error('🚨 Error ending session:', error);
  }
}

// Database utility functions
async function getBotContent(contentKey: string): Promise<string | null> {
  try {
    console.log(`📄 Fetching content: ${contentKey}`);
    const { data, error } = await supabaseAdmin
      .from('bot_content')
      .select('content_value')
      .eq('content_key', contentKey)
      .eq('is_active', true)
      .single();

    if (error) {
      console.error(`❌ Error fetching content for ${contentKey}:`, error);
      return null;
    }

    console.log(`✅ Content fetched for ${contentKey}`);
    return data?.content_value || null;
  } catch (error) {
    console.error(`🚨 Exception in getBotContent for ${contentKey}:`, error);
    return null;
  }
}

async function setBotContent(contentKey: string, contentValue: string, adminId: string): Promise<boolean> {
  try {
    console.log(`📝 Setting content: ${contentKey} by admin: ${adminId}`);
    const { error } = await supabaseAdmin
      .from('bot_content')
      .upsert({
        content_key: contentKey,
        content_value: contentValue,
        last_modified_by: adminId,
        updated_at: new Date().toISOString()
      });

    if (!error) {
      await logAdminAction(adminId, 'content_update', `Updated content: ${contentKey}`, 'bot_content');
      console.log(`✅ Content updated: ${contentKey}`);
    } else {
      console.error(`❌ Error setting content: ${contentKey}`, error);
    }

    return !error;
  } catch (error) {
    console.error('🚨 Exception in setBotContent:', error);
    return false;
  }
}

async function getBotSetting(settingKey: string): Promise<string | null> {
  try {
    console.log(`⚙️ Fetching setting: ${settingKey}`);
    const { data, error } = await supabaseAdmin
      .from('bot_settings')
      .select('setting_value')
      .eq('setting_key', settingKey)
      .eq('is_active', true)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
      console.error(`❌ Error fetching setting ${settingKey}:`, error);
    }

    return data?.setting_value || null;
  } catch (error) {
    console.error(`🚨 Exception fetching setting ${settingKey}:`, error);
    return null;
  }
}

async function setBotSetting(settingKey: string, settingValue: string, adminId: string): Promise<boolean> {
  try {
    console.log(`⚙️ Setting bot setting: ${settingKey} = ${settingValue}`);
    const { error } = await supabaseAdmin
      .from('bot_settings')
      .upsert({
        setting_key: settingKey,
        setting_value: settingValue,
        updated_at: new Date().toISOString()
      });

    if (!error) {
      await logAdminAction(adminId, 'setting_update', `Updated setting: ${settingKey}`, 'bot_settings');
      console.log(`✅ Setting updated: ${settingKey}`);
    } else {
      console.error(`❌ Error setting: ${settingKey}`, error);
    }

    return !error;
  } catch (error) {
    console.error('🚨 Exception in setBotSetting:', error);
    return false;
  }
}

async function logAdminAction(
  adminId: string,
  actionType: string,
  description: string,
  affectedTable?: string,
  affectedRecordId?: string,
  oldValues?: any,
  newValues?: any
): Promise<void> {
  try {
    await supabaseAdmin
      .from('admin_logs')
      .insert({
        admin_telegram_id: adminId,
        action_type: actionType,
        action_description: description,
        affected_table: affectedTable,
        affected_record_id: affectedRecordId,
        old_values: oldValues,
        new_values: newValues
      });
    console.log(`📋 Admin action logged: ${actionType} by ${adminId}`);
  } catch (error) {
    console.error('🚨 Error logging admin action:', error);
  }
}

// Auto-response functions from Supabase tables
async function getAutoReply(contentKey: string, variables: Record<string, string> = {}): Promise<string | null> {
  try {
    console.log(`📱 Getting auto reply: ${contentKey}`);
    const content = await getBotContent(contentKey);
    if (!content) {
      console.log(`❌ No auto reply found for: ${contentKey}`);
      return null;
    }
    
    return formatContent(content, variables);
  } catch (error) {
    console.error(`🚨 Error getting auto reply ${contentKey}:`, error);
    return null;
  }
}

async function handleUnknownCommand(chatId: number, userId: string, command: string): Promise<void> {
  console.log(`❓ Unknown command from ${userId}: ${command}`);
  
  const autoReply = await getAutoReply('auto_reply_unknown');
  const message = autoReply || `🤔 I didn't understand "${command}". Try /start for the main menu!`;
  
  await sendMessage(chatId, message);
  
  // Log unknown command for analytics
  await supabaseAdmin
    .from('user_interactions')
    .insert({
      telegram_user_id: userId,
      interaction_type: 'unknown_command',
      interaction_data: { command, timestamp: new Date().toISOString() }
    });
}

async function handleHelpCommand(chatId: number, userId: string, firstName: string): Promise<void> {
  console.log(`❓ Help command from ${userId}`);
  
  const autoReply = await getAutoReply('auto_reply_help', { firstName });
  const message = autoReply || `❓ **Need Help?**\n\n🤖 Use /start for the main menu\n🔑 Admins can use /admin\n\n🛟 Contact: @DynamicCapital_Support`;
  
  await sendMessage(chatId, message);
}

function formatContent(content: string, variables: Record<string, string>): string {
  let formattedContent = content;
  
  Object.entries(variables).forEach(([key, value]) => {
    const placeholder = `{${key}}`;
    formattedContent = formattedContent.replace(new RegExp(placeholder, 'g'), value || '');
  });
  
  return formattedContent;
}

// Load additional admin IDs from the database
async function refreshAdminIds() {
  try {
    console.log("🔑 Loading admin IDs from database...");
    const { data, error } = await supabaseAdmin
      .from('bot_users')
      .select('telegram_id')
      .eq('is_admin', true);

    if (error) {
      console.error('❌ Failed to load admin IDs:', error);
      return;
    }

    let addedCount = 0;
    data?.forEach((row: { telegram_id: string | number }) => {
      const id = row.telegram_id.toString();
      if (!ADMIN_USER_IDS.has(id)) {
        ADMIN_USER_IDS.add(id);
        addedCount++;
      }
    });
    
    console.log(`✅ Loaded ${data?.length || 0} admin IDs from database (${addedCount} new)`);
    console.log(`🔑 Total admin IDs: ${ADMIN_USER_IDS.size}`);
  } catch (error) {
    console.error('🚨 Exception loading admin IDs:', error);
  }
}

// Initialize admin IDs
await refreshAdminIds();

function isAdmin(userId: string): boolean {
  const result = ADMIN_USER_IDS.has(userId);
  console.log(`🔐 Admin check for ${userId}: ${result}`);
  return result;
}

function getUserSession(userId: string | number) {
  const userIdStr = userId.toString();
  if (!userSessions.has(userIdStr)) {
    userSessions.set(userIdStr, { awaitingInput: null });
  }
  return userSessions.get(userIdStr);
}

async function sendMessage(
  chatId: number,
  text: string,
  replyMarkup?: Record<string, unknown>
) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  const payload = {
    chat_id: chatId,
    text: text,
    reply_markup: replyMarkup,
    parse_mode: "Markdown"
  };

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

    // Auto-delete messages in groups after 30 seconds
    if (result.ok && result.result) {
      const messageId = result.result.message_id;
      const chatType = await getChatType(chatId);
      
      // Check if it's a group or supergroup
      if (chatType === 'group' || chatType === 'supergroup') {
        console.log(`⏰ Scheduling auto-deletion for message ${messageId} in chat ${chatId}`);
        
        // Schedule deletion after 30 seconds
        setTimeout(async () => {
          try {
            console.log(`🗑️ Auto-deleting message ${messageId} from chat ${chatId}`);
            await deleteMessage(chatId, messageId);
          } catch (error) {
            console.error(`❌ Failed to auto-delete message ${messageId}:`, error);
          }
        }, 30000); // 30 seconds
      }
    }

    return result;
  } catch (error) {
    console.error("🚨 Error sending message:", error);
    return null;
  }
}

// Function to delete a specific message
async function deleteMessage(chatId: number, messageId: number): Promise<boolean> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/deleteMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId
      })
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('❌ Failed to delete message:', result);
      return false;
    }

    console.log(`✅ Message ${messageId} deleted from chat ${chatId}`);
    return true;
  } catch (error) {
    console.error('🚨 Error deleting message:', error);
    return false;
  }
}

// Function to get chat type (private, group, supergroup, channel)
async function getChatType(chatId: number): Promise<string> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getChat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId })
    });

    const result = await response.json();

    if (result.ok && result.result) {
      return result.result.type;
    }

    return 'unknown';
  } catch (error) {
    console.error('🚨 Error getting chat type:', error);
    return 'unknown';
  }
}

// Enhanced content management functions
async function getWelcomeMessage(firstName: string): Promise<string> {
  const template = await getBotContent('welcome_message');
  if (!template) {
    return `🚀 *Welcome to Dynamic Capital VIP, ${firstName}!*\n\nWe're here to help you level up your trading with:\n\n• 🔔 Quick market updates\n• 📈 Beginner-friendly tips\n• 🎓 Easy learning resources\n\nReady to get started? Pick an option below 👇`;
  }
  return formatContent(template, { firstName });
}

async function getVipPackages(): Promise<any[]> {
  try {
    console.log("💎 Fetching VIP packages...");
    const { data, error } = await supabaseAdmin
      .from('subscription_plans')
      .select('*')
      .order('price', { ascending: true });

    if (error) {
      console.error('❌ Error fetching VIP packages:', error);
      return [];
    }

    console.log(`✅ Fetched ${data?.length || 0} VIP packages`);
    return data || [];
  } catch (error) {
    console.error('🚨 Exception fetching VIP packages:', error);
    return [];
  }
}

// Enhanced VIP packages display with better formatting
async function getFormattedVipPackages(): Promise<string> {
  const packages = await getVipPackages();
  
  if (packages.length === 0) {
    return "💎 *VIP Membership Packages*\n\n❌ No packages available at the moment.";
  }

  let message = `💎 *VIP Membership Packages*\n\n🚀 *Unlock Premium Trading Success!*\n\n`;
  
  packages.forEach((pkg, index) => {
    const discount = pkg.duration_months >= 12 ? '🔥 BEST VALUE' : 
                    pkg.duration_months >= 6 ? '⭐ POPULAR' :
                    pkg.duration_months >= 3 ? '💫 SAVE MORE' : '🎯 STARTER';
    
    const monthlyEquivalent = pkg.duration_months > 0 ? 
      `($${(pkg.price / pkg.duration_months).toFixed(0)}/month)` : '';
    
    const savingsInfo = pkg.duration_months >= 12 ? '💰 Save 35%' :
                       pkg.duration_months >= 6 ? '💰 Save 20%' :
                       pkg.duration_months >= 3 ? '💰 Save 15%' : '';

    message += `${index + 1}. **${pkg.name}** ${discount}\n`;
    message += `   💰 **${pkg.currency} ${pkg.price}**`;
    
    if (pkg.is_lifetime) {
      message += ` - *Lifetime Access*\n`;
    } else {
      message += `/${pkg.duration_months}mo ${monthlyEquivalent}\n`;
      if (savingsInfo) message += `   ${savingsInfo}\n`;
    }
    
    message += `   ✨ **Features:**\n`;
    if (pkg.features && Array.isArray(pkg.features)) {
      pkg.features.forEach(feature => {
        message += `      • ${feature}\n`;
      });
    }
    
    if (pkg.is_lifetime) {
      message += `      • 🌟 All future programs included\n`;
      message += `      • 🔐 Exclusive lifetime member content\n`;
    }
    
    message += `\n`;
  });

  message += `🎁 *Special Benefits:*\n`;
  message += `• 📈 Real-time trading signals\n`;
  message += `• 🏆 VIP community access\n`;
  message += `• 📊 Daily market analysis\n`;
  message += `• 🎓 Educational resources\n`;
  message += `• 💬 Direct mentor support\n\n`;
  
  message += `✅ *Ready to level up your trading?*\nSelect a package below to get started!`;

  return message;
}

// Enhanced keyboard generators
async function getMainMenuKeyboard(): Promise<any> {
  return {
    inline_keyboard: [
      [
        { text: "💎 VIP Packages", callback_data: "view_vip_packages" },
        { text: "🎓 Education", callback_data: "view_education" }
      ],
      [
        { text: "🏢 About Us", callback_data: "about_us" },
        { text: "🛟 Support", callback_data: "support" }
      ],
      [
        { text: "💰 Promotions", callback_data: "view_promotions" },
        { text: "❓ FAQ", callback_data: "faq" }
      ],
      [
        { text: "📋 Terms", callback_data: "terms" }
      ]
    ]
  };
}

async function getVipPackagesKeyboard(): Promise<any> {
  const packages = await getVipPackages();
  const keyboard = [];
  
  for (const pkg of packages) {
    const discount = pkg.duration_months >= 12 ? ' 🔥' : 
                    pkg.duration_months >= 6 ? ' ⭐' :
                    pkg.duration_months >= 3 ? ' 💫' : '';
    
    const price = pkg.is_lifetime ? `$${pkg.price} Lifetime` : `$${pkg.price}/${pkg.duration_months}mo`;
    
    keyboard.push([{
      text: `💎 ${pkg.name}${discount} - ${price}`,
      callback_data: `select_vip_${pkg.id}`
    }]);
  }
  
  keyboard.push([
    { text: "🎁 View Promotions", callback_data: "view_promotions" },
    { text: "❓ Have Questions?", callback_data: "contact_support" }
  ]);
  keyboard.push([{ text: "🔙 Back to Main Menu", callback_data: "back_main" }]);
  
  return { inline_keyboard: keyboard };
}

// Enhanced admin management functions
async function handleAdminDashboard(chatId: number, userId: string): Promise<void> {
  console.log(`🔐 Admin dashboard access attempt by: ${userId}`);
  
  if (!isAdmin(userId)) {
    console.log(`❌ Access denied for user: ${userId}`);
    await sendMessage(chatId, "❌ Access denied. Admin privileges required.");
    return;
  }

  console.log(`✅ Admin access granted for: ${userId}`);

  try {
    // Get comprehensive stats for dashboard
    const [userCount, vipCount, planCount, promoCount, sessionCount] = await Promise.all([
      supabaseAdmin.from('bot_users').select('count', { count: 'exact' }),
      supabaseAdmin.from('bot_users').select('count', { count: 'exact' }).eq('is_vip', true),
      supabaseAdmin.from('subscription_plans').select('count', { count: 'exact' }),
      supabaseAdmin.from('promotions').select('count', { count: 'exact' }).eq('is_active', true),
      supabaseAdmin.from('bot_sessions').select('count', { count: 'exact' }).is('session_end', null)
    ]);

    const uptime = Math.floor((Date.now() - BOT_START_TIME.getTime()) / 1000 / 60); // minutes
    const botStatus = "🟢 Online & Optimized";

    const adminMessage = `🔐 *Enhanced Admin Dashboard*

📊 *System Status:* ${botStatus}
👤 *Admin:* ${userId}
🕐 *Uptime:* ${uptime} minutes
🕐 *Last Updated:* ${new Date().toLocaleString()}

📈 *Live Statistics:*
• 👥 Total Users: ${userCount.count || 0}
• 💎 VIP Members: ${vipCount.count || 0}
• 📦 Active Plans: ${planCount.count || 0}
• 🎁 Active Promos: ${promoCount.count || 0}
• 💬 Active Sessions: ${sessionCount.count || 0}
• 🔗 Memory Sessions: ${activeBotSessions.size}

🚀 *Management Tools:*
• 🔄 **Bot Control** - Status, refresh, restart
• 👥 **User Management** - Admins, VIP, analytics
• 📦 **Package Control** - VIP & education packages  
• 💰 **Promotions Hub** - Discounts & campaigns
• 💬 **Content Editor** - Messages & UI text
• ⚙️ **Bot Settings** - Configuration & behavior
• 📈 **Analytics Center** - Reports & insights
• 📢 **Broadcasting** - Mass communication
• 🔧 **System Tools** - Maintenance & utilities`;

    const adminKeyboard = {
      inline_keyboard: [
        [
          { text: "🔄 Bot Control", callback_data: "bot_control" },
          { text: "📊 Bot Status", callback_data: "bot_status" }
        ],
        [
          { text: "👥 Users", callback_data: "admin_users" },
          { text: "📦 Packages", callback_data: "admin_packages" }
        ],
        [
          { text: "💰 Promotions", callback_data: "admin_promos" },
          { text: "💬 Content", callback_data: "admin_content" }
        ],
        [
          { text: "⚙️ Settings", callback_data: "admin_settings" },
          { text: "📈 Analytics", callback_data: "admin_analytics" }
        ],
        [
          { text: "📢 Broadcast", callback_data: "admin_broadcast" },
          { text: "🔧 Tools", callback_data: "admin_tools" }
        ],
        [
          { text: "💬 Sessions", callback_data: "view_sessions" },
          { text: "🔄 Refresh", callback_data: "admin_dashboard" }
        ]
      ]
    };

    await sendMessage(chatId, adminMessage, adminKeyboard);
    await logAdminAction(userId, 'dashboard_access', 'Accessed admin dashboard');
    
    console.log(`✅ Admin dashboard sent to: ${userId}`);
  } catch (error) {
    console.error('🚨 Error in admin dashboard:', error);
    await sendMessage(chatId, `❌ Error loading admin dashboard: ${error.message}`);
  }
}

// Session management for admins
async function handleViewSessions(chatId: number, userId: string): Promise<void> {
  if (!isAdmin(userId)) {
    await sendMessage(chatId, "❌ Access denied.");
    return;
  }

  try {
    console.log(`📊 Viewing sessions for admin: ${userId}`);
    
    // Get active sessions
    const { data: activeSessions, error: activeError } = await supabaseAdmin
      .from('bot_sessions')
      .select('telegram_user_id, session_start, activity_count, session_data')
      .is('session_end', null)
      .order('session_start', { ascending: false })
      .limit(10);

    // Get recent completed sessions
    const { data: recentSessions, error: recentError } = await supabaseAdmin
      .from('bot_sessions')
      .select('telegram_user_id, session_start, session_end, duration_minutes, activity_count')
      .not('session_end', 'is', null)
      .order('session_end', { ascending: false })
      .limit(5);

    if (activeError || recentError) {
      throw new Error('Database error fetching sessions');
    }

    let sessionMessage = `💬 *Session Management*\n\n`;
    
    sessionMessage += `🟢 *Active Sessions (${activeSessions?.length || 0}):*\n`;
    if (activeSessions && activeSessions.length > 0) {
      activeSessions.forEach((session, index) => {
        const startTime = new Date(session.session_start);
        const duration = Math.floor((Date.now() - startTime.getTime()) / 1000 / 60);
        sessionMessage += `${index + 1}. User: ${session.telegram_user_id}\n`;
        sessionMessage += `   📅 Started: ${startTime.toLocaleString()}\n`;
        sessionMessage += `   ⏱️ Duration: ${duration}min\n`;
        sessionMessage += `   📊 Activities: ${session.activity_count}\n\n`;
      });
    } else {
      sessionMessage += `   No active sessions\n\n`;
    }

    sessionMessage += `📋 *Recent Completed (${recentSessions?.length || 0}):*\n`;
    if (recentSessions && recentSessions.length > 0) {
      recentSessions.forEach((session, index) => {
        sessionMessage += `${index + 1}. User: ${session.telegram_user_id}\n`;
        sessionMessage += `   ⏱️ Duration: ${session.duration_minutes || 0}min\n`;
        sessionMessage += `   📊 Activities: ${session.activity_count}\n\n`;
      });
    } else {
      sessionMessage += `   No recent sessions\n\n`;
    }

    sessionMessage += `🔗 *Memory Sessions:* ${activeBotSessions.size}`;

    const sessionKeyboard = {
      inline_keyboard: [
        [
          { text: "🧹 Clean Old Sessions", callback_data: "clean_old_sessions" },
          { text: "📊 Session Analytics", callback_data: "session_analytics" }
        ],
        [
          { text: "🔄 Refresh", callback_data: "view_sessions" },
          { text: "🔙 Back to Admin", callback_data: "admin_dashboard" }
        ]
      ]
    };

    await sendMessage(chatId, sessionMessage, sessionKeyboard);
  } catch (error) {
    console.error('🚨 Error viewing sessions:', error);
    await sendMessage(chatId, `❌ Error fetching sessions: ${error.message}`);
  }
}

// Bot Control Functions
async function handleBotControl(chatId: number, userId: string): Promise<void> {
  if (!isAdmin(userId)) {
    await sendMessage(chatId, "❌ Access denied.");
    return;
  }

  const controlMessage = `🔄 *Bot Control Center*

🚀 *Available Actions:*
• 🔄 **Refresh Bot** - Reload configurations & admin IDs
• 📊 **Check Status** - System health & performance
• 🧹 **Clean Cache** - Clear user sessions & temp data
• 💾 **Backup Data** - Export critical bot data
• 🔧 **Maintenance Mode** - Enable/disable bot maintenance
• 📈 **Performance Test** - Test response times
• 🔄 **Restart Services** - Restart background processes

⚠️ *Use with caution - some actions may affect active users*`;

  const controlKeyboard = {
    inline_keyboard: [
      [
        { text: "🔄 Refresh Bot", callback_data: "refresh_bot" },
        { text: "📊 Check Status", callback_data: "bot_status" }
      ],
      [
        { text: "🧹 Clean Cache", callback_data: "clean_cache" },
        { text: "💾 Backup Data", callback_data: "backup_data" }
      ],
      [
        { text: "🔧 Maintenance Mode", callback_data: "toggle_maintenance" },
        { text: "📈 Performance Test", callback_data: "performance_test" }
      ],
      [
        { text: "🔄 Restart Services", callback_data: "restart_services" },
        { text: "⚡ Quick Diagnostic", callback_data: "quick_diagnostic" }
      ],
      [
        { text: "🔙 Back to Admin", callback_data: "admin_dashboard" }
      ]
    ]
  };

  await sendMessage(chatId, controlMessage, controlKeyboard);
}

async function handleBotStatus(chatId: number, userId: string): Promise<void> {
  if (!isAdmin(userId)) {
    await sendMessage(chatId, "❌ Access denied.");
    return;
  }

  console.log(`📊 Bot status check requested by: ${userId}`);

  try {
    // Test database connectivity
    const dbStart = Date.now();
    const dbTest = await supabaseAdmin.from('bot_users').select('count', { count: 'exact' }).limit(1);
    const dbTime = Date.now() - dbStart;

    // Test Telegram API
    const tgStart = Date.now();
    const tgTest = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`);
    const tgTime = Date.now() - tgStart;

    // Get system info
    const uptime = Math.floor((Date.now() - BOT_START_TIME.getTime()) / 1000);
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = uptime % 60;

    // Get memory usage (simplified)
    const memoryInfo = `Memory usage tracking available`;

    const statusMessage = `📊 *Bot Status Report*

🕐 *Uptime:* ${hours}h ${minutes}m ${seconds}s
📅 *Started:* ${BOT_START_TIME.toLocaleString()}

🔌 *Connectivity:*
• 🗄️ Database: ${dbTest.error ? '🔴 ERROR' : '🟢 OK'} (${dbTime}ms)
• 📱 Telegram API: ${tgTest.ok ? '🟢 OK' : '🔴 ERROR'} (${tgTime}ms)

⚙️ *Configuration:*
• 🔑 Admin IDs: ${ADMIN_USER_IDS.size} loaded
• 💬 Active Sessions: ${userSessions.size}
• 🌐 Environment: ${Deno.env.get("DENO_DEPLOYMENT_ID") ? 'Production' : 'Development'}

📈 *Performance:*
• 🗄️ DB Response: ${dbTime < 100 ? '🟢 Fast' : dbTime < 500 ? '🟡 Moderate' : '🔴 Slow'} (${dbTime}ms)
• 📱 API Response: ${tgTime < 100 ? '🟢 Fast' : tgTime < 500 ? '🟡 Moderate' : '🔴 Slow'} (${tgTime}ms)
• 💾 ${memoryInfo}

${dbTest.error ? `❌ DB Error: ${dbTest.error.message}` : ''}
${!tgTest.ok ? '❌ Telegram API Error' : ''}`;

    const statusKeyboard = {
      inline_keyboard: [
        [
          { text: "🔄 Refresh Status", callback_data: "bot_status" },
          { text: "🧹 Clean Sessions", callback_data: "clean_cache" }
        ],
        [
          { text: "📈 Performance Test", callback_data: "performance_test" },
          { text: "🔧 Diagnostic", callback_data: "quick_diagnostic" }
        ],
        [
          { text: "🔙 Back to Control", callback_data: "bot_control" }
        ]
      ]
    };

    await sendMessage(chatId, statusMessage, statusKeyboard);
  } catch (error) {
    console.error('🚨 Error in bot status check:', error);
    await sendMessage(chatId, `❌ Error checking bot status: ${error.message}`);
  }
}

async function handleRefreshBot(chatId: number, userId: string): Promise<void> {
  if (!isAdmin(userId)) {
    await sendMessage(chatId, "❌ Access denied.");
    return;
  }

  console.log(`🔄 Bot refresh initiated by: ${userId}`);
  await sendMessage(chatId, "🔄 *Refreshing bot...*\n\nPlease wait while I reload configurations...");

  try {
    // Refresh admin IDs
    await refreshAdminIds();

    // Clear user sessions cache
    userSessions.clear();

    // Test database connectivity
    const dbTest = await supabaseAdmin.from('bot_users').select('count', { count: 'exact' }).limit(1);

    const refreshMessage = `✅ *Bot Refresh Complete!*

🔄 *Actions Performed:*
• 🔑 Reloaded admin IDs (${ADMIN_USER_IDS.size} total)
• 🧹 Cleared user sessions cache
• 🗄️ Database connectivity: ${dbTest.error ? '🔴 ERROR' : '🟢 OK'}
• ⚙️ Revalidated configurations

🕐 *Completed at:* ${new Date().toLocaleString()}

✅ Bot is now running with fresh configurations!`;

    await sendMessage(chatId, refreshMessage);
    await logAdminAction(userId, 'bot_refresh', 'Bot refresh completed successfully');
  } catch (error) {
    console.error('🚨 Error during bot refresh:', error);
    await sendMessage(chatId, `❌ Error during refresh: ${error.message}`);
  }
}

// Broadcasting Functions
async function handleBroadcastMenu(chatId: number, userId: string): Promise<void> {
  if (!isAdmin(userId)) {
    await sendMessage(chatId, "❌ Access denied.");
    return;
  }

  const broadcastMessage = `📢 *Broadcast Management*

🚀 *Available Broadcast Options:*
• 👋 **Send Greeting** - Send hello message to channels/groups
• 🎯 **Channel Introduction** - Introduce bot to new channels
• 📝 **Custom Broadcast** - Send custom message to all channels
• 📊 **Broadcast History** - View previous broadcasts
• ⚙️ **Broadcast Settings** - Configure broadcast preferences

💡 *Tips:*
• Test messages in a small group first
• Use markdown formatting for better appearance
• Schedule broadcasts for optimal timing`;

  const broadcastKeyboard = {
    inline_keyboard: [
      [
        { text: "👋 Send Greeting", callback_data: "send_greeting" },
        { text: "🎯 Channel Intro", callback_data: "send_channel_intro" }
      ],
      [
        { text: "📝 Custom Broadcast", callback_data: "custom_broadcast" },
        { text: "📊 History", callback_data: "broadcast_history" }
      ],
      [
        { text: "⚙️ Settings", callback_data: "broadcast_settings" },
        { text: "🧪 Test Message", callback_data: "test_broadcast" }
      ],
      [
        { text: "🔙 Back to Admin", callback_data: "admin_dashboard" }
      ]
    ]
  };

  await sendMessage(chatId, broadcastMessage, broadcastKeyboard);
}

async function handleSendGreeting(chatId: number, userId: string): Promise<void> {
  if (!isAdmin(userId)) {
    await sendMessage(chatId, "❌ Access denied.");
    return;
  }

  const greetingMessage = await getBotContent('broadcast_greeting') || `👋 *Hello Everyone!*

🎉 **Welcome to Dynamic Capital VIP!**

I'm your new trading assistant bot, here to help you:

🔔 **Stay Updated:**
• Real-time market alerts
• Trading signals and insights
• Educational content delivery

💰 **Maximize Profits:**
• VIP package access
• Exclusive trading strategies
• Direct mentor support

🚀 **Get Started:**
• Use /start to access the main menu
• Explore our VIP packages
• Join our community discussions

Looking forward to helping you succeed in trading! 📈

*Powered by Dynamic Capital Team* 💎`;

  // Get channels to broadcast to
  const channels = await getBroadcastChannels();
  
  if (channels.length === 0) {
    await sendMessage(chatId, "⚠️ No broadcast channels configured. Please add channel IDs to broadcast settings first.");
    return;
  }

  await sendMessage(chatId, `📢 *Sending Greeting Message*\n\n📡 Broadcasting to ${channels.length} channels...\n\n*Message Preview:*\n${greetingMessage.substring(0, 200)}...`);

  let successCount = 0;
  let failCount = 0;

  for (const channelId of channels) {
    try {
      await sendMessage(parseInt(channelId), greetingMessage);
      successCount++;
      console.log(`✅ Greeting sent to channel: ${channelId}`);
    } catch (error) {
      failCount++;
      console.error(`❌ Failed to send greeting to channel ${channelId}:`, error);
    }
    
    // Small delay between messages to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  const resultMessage = `📢 *Greeting Broadcast Complete!*

✅ **Successfully sent:** ${successCount} channels
❌ **Failed:** ${failCount} channels
📊 **Total channels:** ${channels.length}

${failCount > 0 ? '⚠️ Check logs for failed channels and verify permissions.' : '🎉 All messages sent successfully!'}`;

  await sendMessage(chatId, resultMessage);
  await logAdminAction(userId, 'broadcast_greeting', `Sent greeting to ${successCount}/${channels.length} channels`);
}

async function handleSendChannelIntro(chatId: number, userId: string): Promise<void> {
  if (!isAdmin(userId)) {
    await sendMessage(chatId, "❌ Access denied.");
    return;
  }

  const introMessage = await getBotContent('broadcast_intro') || `🤖 *Bot Introduction*

📢 **Dynamic Capital VIP Bot is now LIVE!**

🎯 **What I can do for you:**

💎 **VIP Services:**
• Show available membership packages
• Process subscription requests  
• Provide member support

🎓 **Education Hub:**
• Access trading courses
• View learning materials
• Track your progress

📊 **Market Intelligence:**
• Real-time trading signals
• Market analysis updates
• Price alerts & notifications

🛟 **24/7 Support:**
• Answer frequently asked questions
• Connect you with support team
• Resolve account issues

**🚀 Get Started Now:**
Send me /start to explore all features!

*Ready to transform your trading journey?* 💰📈`;

  const channels = await getBroadcastChannels();
  
  if (channels.length === 0) {
    await sendMessage(chatId, "⚠️ No broadcast channels configured. Please add channel IDs to broadcast settings first.");
    return;
  }

  await sendMessage(chatId, `🎯 *Sending Introduction Message*\n\n📡 Broadcasting to ${channels.length} channels...\n\n*Message Preview:*\n${introMessage.substring(0, 200)}...`);

  let successCount = 0;
  let failCount = 0;

  for (const channelId of channels) {
    try {
      await sendMessage(parseInt(channelId), introMessage);
      successCount++;
      console.log(`✅ Introduction sent to channel: ${channelId}`);
    } catch (error) {
      failCount++;
      console.error(`❌ Failed to send introduction to channel ${channelId}:`, error);
    }
    
    // Small delay between messages
    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  const resultMessage = `🎯 *Introduction Broadcast Complete!*

✅ **Successfully sent:** ${successCount} channels
❌ **Failed:** ${failCount} channels
📊 **Total channels:** ${channels.length}

${failCount > 0 ? '⚠️ Some messages failed to send. Check bot permissions in those channels.' : '🎉 All introductions sent successfully!'}`;

  await sendMessage(chatId, resultMessage);
  await logAdminAction(userId, 'broadcast_intro', `Sent introduction to ${successCount}/${channels.length} channels`);
}

async function handleCustomBroadcast(chatId: number, userId: string): Promise<void> {
  if (!isAdmin(userId)) {
    await sendMessage(chatId, "❌ Access denied.");
    return;
  }

  const userSession = getUserSession(userId);
  userSession.awaitingInput = 'custom_broadcast_message';

  await sendMessage(chatId, `📝 *Custom Broadcast*

📋 **Instructions:**
• Send me the message you want to broadcast
• Use Markdown formatting for better appearance
• Include emojis and formatting as needed
• Message will be sent to all configured channels

💡 **Formatting Tips:**
• Use *bold* for emphasis
• Use _italic_ for subtle text
• Use \`code\` for highlights
• Use [links](url) for references

📤 **Send your message now:**`);
}

async function handleNewChatMember(message: any): Promise<void> {
  const chatId = message.chat.id;
  const chatTitle = message.chat.title || 'Unknown Chat';
  const newMembers = message.new_chat_members || [];

  console.log(`👥 New member(s) added to ${chatTitle} (${chatId})`);

  // Check if the bot itself was added
  const botMember = newMembers.find((member: any) => member.username === 'Dynamic_VIP_BOT' || member.is_bot);
  
  if (botMember) {
    console.log(`🤖 Bot was added to new chat: ${chatTitle}`);
    
    // Send automatic introduction when bot is added to new channel/group
    const autoIntroMessage = await getBotContent('auto_intro') || `👋 *Hello ${chatTitle}!*

🤖 **Dynamic Capital VIP Bot** is now active here!

🚀 **I'm here to help with:**
• 💎 VIP membership packages
• 🎓 Trading education resources  
• 📊 Market updates & signals
• 🛟 24/7 customer support

**🎯 Get started with /start**

*Thank you for adding me to your community!* 🙏`;

    // Wait a moment before sending intro (looks more natural)
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    try {
      await sendMessage(chatId, autoIntroMessage);
      console.log(`✅ Auto introduction sent to: ${chatTitle}`);
      
      // Log the new channel addition
      await supabaseAdmin
        .from('admin_logs')
        .insert({
          admin_telegram_id: 'system',
          action_type: 'bot_added_to_chat',
          action_description: `Bot added to: ${chatTitle} (${chatId})`,
          new_values: { chat_id: chatId, chat_title: chatTitle, chat_type: message.chat.type }
        });
        
    } catch (error) {
      console.error(`❌ Failed to send auto intro to ${chatTitle}:`, error);
    }
  }
}

// Function to handle custom broadcast sending
async function handleCustomBroadcastSend(chatId: number, userId: string, message: string): Promise<void> {
  if (!isAdmin(userId)) {
    await sendMessage(chatId, "❌ Access denied.");
    return;
  }

  // Clear awaiting input
  const userSession = getUserSession(userId);
  userSession.awaitingInput = null;

  if (!message || message.trim().length === 0) {
    await sendMessage(chatId, "❌ Empty message. Please try again with /broadcast");
    return;
  }

  const channels = await getBroadcastChannels();
  
  if (channels.length === 0) {
    await sendMessage(chatId, "⚠️ No broadcast channels configured. Please add channel IDs to broadcast settings first.");
    return;
  }

  // Show preview and confirm
  const previewMessage = `📝 *Custom Broadcast Preview*

📡 **Broadcasting to:** ${channels.length} channels
📝 **Message:**

${message}

🔄 **Broadcasting now...**`;

  await sendMessage(chatId, previewMessage);

  let successCount = 0;
  let failCount = 0;

  for (const channelId of channels) {
    try {
      await sendMessage(parseInt(channelId), message);
      successCount++;
      console.log(`✅ Custom broadcast sent to channel: ${channelId}`);
    } catch (error) {
      failCount++;
      console.error(`❌ Failed to send broadcast to channel ${channelId}:`, error);
    }
    
    // Delay between messages
    const delay = parseInt(await getBotSetting('broadcast_delay_ms') || '1500');
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  const resultMessage = `📝 *Custom Broadcast Complete!*

✅ **Successfully sent:** ${successCount} channels
❌ **Failed:** ${failCount} channels
📊 **Total channels:** ${channels.length}

${failCount > 0 ? '⚠️ Some messages failed. Check bot permissions in those channels.' : '🎉 All messages sent successfully!'}`;

  await sendMessage(chatId, resultMessage);
  await logAdminAction(userId, 'custom_broadcast', `Sent custom message to ${successCount}/${channels.length} channels`);
}

// Additional broadcast helper functions
async function handleBroadcastHistory(chatId: number, userId: string): Promise<void> {
  if (!isAdmin(userId)) {
    await sendMessage(chatId, "❌ Access denied.");
    return;
  }

  const historyMessage = `📊 *Broadcast History*

📈 **Recent Activity:**
• Last greeting broadcast: Not tracked yet
• Last introduction: Not tracked yet  
• Custom broadcasts: 0 sent

📋 **Statistics:**
• Total broadcasts this month: 0
• Success rate: N/A
• Most active channel: N/A

🔧 **To enable detailed tracking:**
Run the analytics setup command to start tracking broadcast metrics.

📝 **Note:** History tracking will be available in future updates.`;

  const historyKeyboard = {
    inline_keyboard: [
      [
        { text: "🔄 Refresh", callback_data: "broadcast_history" },
        { text: "📊 Full Analytics", callback_data: "admin_analytics" }
      ],
      [
        { text: "🔙 Back to Broadcast", callback_data: "admin_broadcast" }
      ]
    ]
  };

  await sendMessage(chatId, historyMessage, historyKeyboard);
}

async function handleBroadcastSettings(chatId: number, userId: string): Promise<void> {
  if (!isAdmin(userId)) {
    await sendMessage(chatId, "❌ Access denied.");
    return;
  }

  const currentChannels = await getBroadcastChannels();
  const autoIntro = await getBotSetting('auto_intro_enabled') || 'true';
  const delay = await getBotSetting('broadcast_delay_ms') || '1500';

  const settingsMessage = `⚙️ *Broadcast Settings*

📡 **Configured Channels:** ${currentChannels.length}
${currentChannels.length > 0 ? '• ' + currentChannels.join('\n• ') : '• No channels configured'}

🤖 **Auto Introduction:** ${autoIntro === 'true' ? '✅ Enabled' : '❌ Disabled'}
⏱️ **Message Delay:** ${delay}ms

📝 **To modify settings:**
Use the admin settings panel or contact support.

💡 **Tips:**
• Get channel IDs using @userinfobot
• Test with small groups first
• Ensure bot has admin rights in channels`;

  const settingsKeyboard = {
    inline_keyboard: [
      [
        { text: "📝 Edit Channels", callback_data: "edit_channels" },
        { text: "🔧 Auto Settings", callback_data: "auto_settings" }
      ],
      [
        { text: "🧪 Test Setup", callback_data: "test_broadcast" },
        { text: "💡 Help Guide", callback_data: "broadcast_help" }
      ],
      [
        { text: "🔙 Back to Broadcast", callback_data: "admin_broadcast" }
      ]
    ]
  };

  await sendMessage(chatId, settingsMessage, settingsKeyboard);
}

async function handleTestBroadcast(chatId: number, userId: string): Promise<void> {
  if (!isAdmin(userId)) {
    await sendMessage(chatId, "❌ Access denied.");
    return;
  }

  const testMessage = "🧪 **Test Broadcast**\n\nThis is a test message from Dynamic Capital VIP Bot.\nIf you're seeing this, broadcasting is working correctly! ✅";
  
  // For testing, send to the admin chat first
  await sendMessage(chatId, `🧪 *Test Broadcast*

📝 **Test Message:**
${testMessage}

🔧 **Test sent to your chat first.**
If this works, you can proceed with broadcasting to channels.

⚠️ **Before broadcasting to channels:**
• Ensure bot has proper permissions
• Verify channel IDs are correct
• Test with one channel first`);

  await logAdminAction(userId, 'test_broadcast', 'Executed broadcast test');
}

async function getBroadcastChannels(): Promise<string[]> {
  try {
    const channelsSetting = await getBotSetting('broadcast_channels');
    if (!channelsSetting) {
      return [];
    }
    
    // Parse channels from setting (comma-separated list)
    return channelsSetting.split(',').map(ch => ch.trim()).filter(ch => ch.length > 0);
  } catch (error) {
    console.error('🚨 Error getting broadcast channels:', error);
    return [];
  }
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
      `🚀 Enhanced Dynamic Capital Bot is live!\n\n⏰ Uptime: ${uptimeMinutes} minutes\n🔑 Admins: ${ADMIN_USER_IDS.size}\n💬 Sessions: ${userSessions.size}`, 
      { status: 200, headers: corsHeaders }
    );
  }

  try {
    const body = await req.text();
    const update = JSON.parse(body);

    console.log("📨 Update received:", JSON.stringify(update, null, 2));

    // Extract user info
    const from = update.message?.from || update.callback_query?.from;
    if (!from) {
      console.log("❌ No 'from' user found in update");
      return new Response("OK", { status: 200 });
    }

    const chatId = update.message?.chat?.id || update.callback_query?.message?.chat?.id;
    const userId = from.id.toString();
    const firstName = from.first_name || 'Friend';
    const lastName = from.last_name;
    const username = from.username;

    console.log(`👤 Processing update for user: ${userId} (${firstName})`);

    // Track user activity for session management (using updateBotSession instead)
    await updateBotSession(userId, {
      message_type: update.message ? 'message' : 'callback_query',
      text: update.message?.text || update.callback_query?.data,
      timestamp: new Date().toISOString()
    });

    // Handle regular messages
    if (update.message) {
      const text = update.message.text;
      console.log(`📝 Processing text message: ${text} from user: ${userId}`);

      // Update session activity
      await updateBotSession(userId, {
        message_type: 'text',
        text: text,
        timestamp: new Date().toISOString()
      });

      // Check for maintenance mode
      const maintenanceMode = await getBotSetting('maintenance_mode');
      if (maintenanceMode === 'true' && !isAdmin(userId)) {
        console.log("🔧 Bot in maintenance mode for non-admin user");
        await sendMessage(chatId, "🔧 *Bot is under maintenance*\n\n⏰ We'll be back soon! Thank you for your patience.\n\n🛟 For urgent support, contact @DynamicCapital_Support");
        return new Response("OK", { status: 200 });
      }

      // Handle /start command with dynamic welcome message
      if (text === '/start') {
        console.log(`🚀 Start command from: ${userId} (${firstName})`);
        await startBotSession(userId, { firstName, username, command: 'start' });
        
        const autoReply = await getAutoReply('auto_reply_welcome', { firstName });
        const welcomeMessage = autoReply || await getWelcomeMessage(firstName);
        const keyboard = await getMainMenuKeyboard();
        await sendMessage(chatId, welcomeMessage, keyboard);
        return new Response("OK", { status: 200 });
      }

      // Handle /admin command
      if (text === '/admin') {
        console.log(`🔐 Admin command from: ${userId} (${firstName})`);
        console.log(`🔐 Admin check result: ${isAdmin(userId)}`);
        console.log(`🔐 Current admin IDs: ${Array.from(ADMIN_USER_IDS).join(', ')}`);
        
        if (isAdmin(userId)) {
          await handleAdminDashboard(chatId, userId);
        } else {
          await sendMessage(chatId, "❌ Access denied. Admin privileges required.\n\n🔑 Your ID: `" + userId + "`\n🛟 Contact support if you should have admin access.");
        }
        return new Response("OK", { status: 200 });
      }

      // Handle /help command
      if (text === '/help') {
        await handleHelpCommand(chatId, userId, firstName);
        return new Response("OK", { status: 200 });
      }

      // Handle /status command for admins
      if (text === '/status' && isAdmin(userId)) {
        await handleBotStatus(chatId, userId);
        return new Response("OK", { status: 200 });
      }

      // Handle /refresh command for admins
      if (text === '/refresh' && isAdmin(userId)) {
        await handleRefreshBot(chatId, userId);
        return new Response("OK", { status: 200 });
      }

      // Check if user is sending custom broadcast message
      const userSession = getUserSession(userId);
      if (userSession.awaitingInput === 'custom_broadcast_message') {
        await handleCustomBroadcastSend(chatId, userId, text);
        return new Response("OK", { status: 200 });
      }

      // Handle /broadcast command for admins
      if (text === '/broadcast' && isAdmin(userId)) {
        await handleBroadcastMenu(chatId, userId);
        return new Response("OK", { status: 200 });
      }

      // Handle new chat member events (when bot is added to channels/groups)
      if (update.message.new_chat_members) {
        await handleNewChatMember(update.message);
        return new Response("OK", { status: 200 });
      }

      // Handle unknown commands with auto-reply
      if (text?.startsWith('/')) {
        await handleUnknownCommand(chatId, userId, text);
        return new Response("OK", { status: 200 });
      }

      // Handle other messages with auto-reply
      const generalReply = await getAutoReply('auto_reply_general') || 
        "🤖 Thanks for your message! Use /start to see the main menu or /help for assistance.";
      await sendMessage(chatId, generalReply);
    }

    // Handle callback queries
    if (update.callback_query) {
      const callbackData = update.callback_query.data;
      console.log(`🔘 Processing callback: ${callbackData} from user: ${userId}`);

      // Update session activity
      await updateBotSession(userId, {
        message_type: 'callback',
        callback_data: callbackData,
        timestamp: new Date().toISOString()
      });

      try {
        switch (callbackData) {
          case 'view_vip_packages':
            console.log("💎 Displaying VIP packages");
            const vipMessage = await getFormattedVipPackages();
            const vipKeyboard = await getVipPackagesKeyboard();
            await sendMessage(chatId, vipMessage, vipKeyboard);
            break;

          case 'back_main':
            const autoReply = await getAutoReply('auto_reply_welcome', { firstName });
            const mainMessage = autoReply || await getWelcomeMessage(firstName);
            const mainKeyboard = await getMainMenuKeyboard();
            await sendMessage(chatId, mainMessage, mainKeyboard);
            break;

          case 'admin_dashboard':
            console.log(`🔐 Admin dashboard callback from: ${userId}`);
            await handleAdminDashboard(chatId, userId);
            break;

          case 'bot_control':
            await handleBotControl(chatId, userId);
            break;

          case 'bot_status':
            await handleBotStatus(chatId, userId);
            break;

          case 'refresh_bot':
            await handleRefreshBot(chatId, userId);
            break;

          case 'view_sessions':
            await handleViewSessions(chatId, userId);
            break;

          case 'clean_cache':
            if (isAdmin(userId)) {
              userSessions.clear();
              await sendMessage(chatId, "🧹 *Cache Cleaned!*\n\n✅ All user sessions cleared\n✅ Temporary data removed");
              await logAdminAction(userId, 'cache_clean', 'User sessions cache cleared');
            }
            break;

          case 'clean_old_sessions':
            if (isAdmin(userId)) {
              try {
                // End sessions older than 24 hours
                const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
                const { data, error } = await supabaseAdmin
                  .from('bot_sessions')
                  .update({ 
                    session_end: new Date().toISOString(),
                    duration_minutes: 1440 // 24 hours max
                  })
                  .is('session_end', null)
                  .lt('session_start', cutoffTime)
                  .select('count', { count: 'exact' });

                await sendMessage(chatId, `🧹 *Old Sessions Cleaned!*\n\n✅ Cleaned ${data?.length || 0} old sessions\n🕐 Sessions older than 24h ended`);
                await logAdminAction(userId, 'session_cleanup', `Cleaned ${data?.length || 0} old sessions`);
              } catch (error) {
                await sendMessage(chatId, `❌ Error cleaning sessions: ${error.message}`);
              }
            }
            break;

          case 'quick_diagnostic':
            if (isAdmin(userId)) {
              const diagnostic = `🔧 *Quick Diagnostic*

🔑 **Environment:**
• Bot Token: ${BOT_TOKEN ? '✅' : '❌'}
• Database: ${SUPABASE_URL ? '✅' : '❌'}
• Service Key: ${SUPABASE_SERVICE_ROLE_KEY ? '✅' : '❌'}

📊 **Current State:**
• Admin Count: ${ADMIN_USER_IDS.size}
• Memory Sessions: ${userSessions.size}
• Active Bot Sessions: ${activeBotSessions.size}
• Uptime: ${Math.floor((Date.now() - BOT_START_TIME.getTime()) / 1000 / 60)}min

🤖 **Bot Info:**
• Started: ${BOT_START_TIME.toLocaleString()}
• Function ID: telegram-bot
• Status: 🟢 Running`;

              await sendMessage(chatId, diagnostic);
            }
            break;

          case 'admin_broadcast':
            await handleBroadcastMenu(chatId, userId);
            break;

          case 'send_greeting':
            await handleSendGreeting(chatId, userId);
            break;

          case 'send_channel_intro':
            await handleSendChannelIntro(chatId, userId);
            break;

          case 'custom_broadcast':
            await handleCustomBroadcast(chatId, userId);
            break;

          case 'broadcast_history':
            await handleBroadcastHistory(chatId, userId);
            break;

          case 'broadcast_settings':
            await handleBroadcastSettings(chatId, userId);
            break;

          case 'test_broadcast':
            await handleTestBroadcast(chatId, userId);
            break;

          default:
            console.log(`❓ Unknown callback: ${callbackData}`);
            await sendMessage(chatId, "❓ Unknown action. Please try again or use /start for the main menu.");
        }

        // Answer callback query to remove loading state
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callback_query_id: update.callback_query.id })
        });

      } catch (error) {
        console.error('🚨 Error handling callback:', error);
        await sendMessage(chatId, "❌ An error occurred. Please try again or contact support.");
        
        // Still answer the callback query
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            callback_query_id: update.callback_query.id,
            text: "Error occurred, please try again"
          })
        });
      }
    }

    return new Response("OK", { status: 200 });

  } catch (error) {
    console.error("🚨 Main error:", error);
    return new Response("Error", { status: 500, headers: corsHeaders });
  }
});

console.log("🚀 Bot is ready and listening for updates!");