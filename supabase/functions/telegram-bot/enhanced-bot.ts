/* eslint-disable no-case-declarations */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { 
  getBotContent, 
  setBotContent, 
  getBotSetting, 
  setBotSetting,
  getVipPackages,
  createVipPackage,
  updateVipPackage,
  deleteVipPackage,
  getEducationPackages,
  createEducationPackage,
  getActivePromotions,
  createPromotion,
  logAdminAction,
  updateUserActivity,
  formatContent
} from "./database-utils.ts";

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const supabaseAdmin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

// Admin user IDs - now enhanced with database lookup
const ADMIN_USER_IDS = new Set(["225513686"]);

// User sessions for features
const userSessions = new Map();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Load additional admin IDs from the database
async function refreshAdminIds() {
  try {
    const { data } = await supabaseAdmin
      .from('bot_users')
      .select('telegram_id')
      .eq('is_admin', true);

    data?.forEach((row: { telegram_id: string | number }) => {
      ADMIN_USER_IDS.add(row.telegram_id.toString());
    });
    
    console.log('Loaded admin IDs from database:', data?.length || 0);
  } catch (error) {
    console.error('Failed to load admin IDs:', error);
  }
}

await refreshAdminIds();

function isAdmin(userId: string): boolean {
  return ADMIN_USER_IDS.has(userId);
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
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Telegram API error:", errorData);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("Error sending message:", error);
    return null;
  }
}

// Enhanced content management functions
async function getWelcomeMessage(firstName: string): Promise<string> {
  const template = await getBotContent('welcome_message');
  if (!template) {
    return `🚀 *Welcome to Dynamic Capital VIP, ${firstName}!*\n\nWe're here to help you level up your trading!`;
  }
  return formatContent(template, { firstName });
}

async function getAboutUsMessage(): Promise<string> {
  return await getBotContent('about_us') || '🏢 *About Dynamic Capital*\n\nWe are a leading trading education platform.';
}

async function getSupportMessage(): Promise<string> {
  return await getBotContent('support_message') || '🛟 *Need Help?*\n\nContact our support team for assistance.';
}

async function getTermsMessage(): Promise<string> {
  return await getBotContent('terms_conditions') || '📋 *Terms & Conditions*\n\nPlease read our terms of service.';
}

async function getFaqMessage(): Promise<string> {
  return await getBotContent('faq_general') || '❓ *FAQ*\n\nFrequently asked questions will be listed here.';
}

// Enhanced package display functions
async function getVipPackagesKeyboard(): Promise<any> {
  const packages = await getVipPackages();
  const keyboard = [];
  
  for (const pkg of packages) {
    keyboard.push([{
      text: `💎 ${pkg.name} - $${pkg.price}/${pkg.duration_months}mo`,
      callback_data: `select_vip_${pkg.id}`
    }]);
  }
  
  keyboard.push([{ text: "🔙 Back to Main Menu", callback_data: "back_main" }]);
  
  return { inline_keyboard: keyboard };
}

async function getEducationPackagesKeyboard(): Promise<any> {
  const packages = await getEducationPackages();
  const keyboard = [];
  
  for (const pkg of packages) {
    keyboard.push([{
      text: `🎓 ${pkg.name} - $${pkg.price}`,
      callback_data: `select_edu_${pkg.id}`
    }]);
  }
  
  keyboard.push([{ text: "🔙 Back to Main Menu", callback_data: "back_main" }]);
  
  return { inline_keyboard: keyboard };
}

// Enhanced admin management functions
async function handleAdminDashboard(chatId: number, userId: string): Promise<void> {
  if (!isAdmin(userId)) {
    await sendMessage(chatId, "❌ Access denied. Admin privileges required.");
    return;
  }

  const adminMessage = `🔐 *Enhanced Admin Dashboard*

📊 *Quick Actions:*
• 👥 User Management
• 📦 Package Management  
• 💰 Promotion Management
• 💬 Content Management
• ⚙️ Bot Settings
• 📈 Analytics & Reports
• 📢 Broadcasting
• 🔧 System Tools`;

  const adminKeyboard = {
    inline_keyboard: [
      [
        { text: "👥 Users", callback_data: "admin_users" },
        { text: "📦 Packages", callback_data: "admin_packages" }
      ],
      [
        { text: "💰 Promos", callback_data: "admin_promos" },
        { text: "💬 Content", callback_data: "admin_content" }
      ],
      [
        { text: "⚙️ Settings", callback_data: "admin_settings" },
        { text: "📈 Analytics", callback_data: "admin_analytics" }
      ],
      [
        { text: "📢 Broadcast", callback_data: "admin_broadcast" },
        { text: "🔧 Tools", callback_data: "admin_tools" }
      ]
    ]
  };

  await sendMessage(chatId, adminMessage, adminKeyboard);
}

// Content management handlers
async function handleContentManagement(chatId: number, userId: string): Promise<void> {
  if (!isAdmin(userId)) {
    await sendMessage(chatId, "❌ Access denied.");
    return;
  }

  const contentMessage = `💬 *Content Management*

📝 *Available Content:*
• Welcome Message
• About Us
• Support Info
• Terms & Conditions
• FAQ Content

Select content to edit:`;

  const contentKeyboard = {
    inline_keyboard: [
      [
        { text: "🚀 Welcome Message", callback_data: "edit_content_welcome_message" },
        { text: "🏢 About Us", callback_data: "edit_content_about_us" }
      ],
      [
        { text: "🛟 Support Info", callback_data: "edit_content_support_message" },
        { text: "📋 Terms", callback_data: "edit_content_terms_conditions" }
      ],
      [
        { text: "❓ FAQ", callback_data: "edit_content_faq_general" }
      ],
      [
        { text: "🔙 Back to Admin", callback_data: "admin_dashboard" }
      ]
    ]
  };

  await sendMessage(chatId, contentMessage, contentKeyboard);
}

// Package management handlers
async function handlePackageManagement(chatId: number, userId: string): Promise<void> {
  if (!isAdmin(userId)) {
    await sendMessage(chatId, "❌ Access denied.");
    return;
  }

  const packageMessage = `📦 *Package Management*

💎 *VIP Packages:*
• Create new VIP plans
• Edit existing plans
• Manage pricing & features

🎓 *Education Packages:*
• Create courses
• Manage enrollments
• Set instructors`;

  const packageKeyboard = {
    inline_keyboard: [
      [
        { text: "💎 VIP Packages", callback_data: "manage_vip_packages" },
        { text: "🎓 Education", callback_data: "manage_edu_packages" }
      ],
      [
        { text: "➕ Create VIP", callback_data: "create_vip_package" },
        { text: "➕ Create Course", callback_data: "create_edu_package" }
      ],
      [
        { text: "🔙 Back to Admin", callback_data: "admin_dashboard" }
      ]
    ]
  };

  await sendMessage(chatId, packageMessage, packageKeyboard);
}

// Settings management handlers
async function handleSettingsManagement(chatId: number, userId: string): Promise<void> {
  if (!isAdmin(userId)) {
    await sendMessage(chatId, "❌ Access denied.");
    return;
  }

  const sessionTimeout = await getBotSetting('session_timeout_minutes') || '30';
  const followUpDelay = await getBotSetting('follow_up_delay_minutes') || '10';
  const maxFollowUps = await getBotSetting('max_follow_ups') || '3';
  const maintenanceMode = await getBotSetting('maintenance_mode') || 'false';

  const settingsMessage = `⚙️ *Bot Settings*

🕐 *Current Settings:*
• Session Timeout: ${sessionTimeout} minutes
• Follow-up Delay: ${followUpDelay} minutes  
• Max Follow-ups: ${maxFollowUps}
• Maintenance Mode: ${maintenanceMode === 'true' ? '🔴 ON' : '🟢 OFF'}

Select setting to modify:`;

  const settingsKeyboard = {
    inline_keyboard: [
      [
        { text: "🕐 Session Timeout", callback_data: "set_session_timeout" },
        { text: "📬 Follow-up Settings", callback_data: "set_followup_settings" }
      ],
      [
        { text: "🔧 Maintenance Mode", callback_data: "toggle_maintenance" },
        { text: "🔔 Notifications", callback_data: "set_notifications" }
      ],
      [
        { text: "🔙 Back to Admin", callback_data: "admin_dashboard" }
      ]
    ]
  };

  await sendMessage(chatId, settingsMessage, settingsKeyboard);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method === "GET") {
    return new Response("Enhanced Dynamic Capital Bot is live! 🚀", { status: 200 });
  }

  try {
    const body = await req.text();
    const update = JSON.parse(body);

    console.log("Update received:", JSON.stringify(update));

    // Extract user info
    const from = update.message?.from || update.callback_query?.from;
    if (!from) return new Response("OK", { status: 200 });

    const chatId = update.message?.chat?.id || update.callback_query?.message?.chat?.id;
    const userId = from.id.toString();
    const firstName = from.first_name || 'Friend';
    const lastName = from.last_name;
    const username = from.username;

    // Track user activity for session management
    await updateUserActivity(userId, {
      message_type: update.message ? 'message' : 'callback_query',
      text: update.message?.text || update.callback_query?.data,
      timestamp: new Date().toISOString()
    });

    // Handle regular messages
    if (update.message) {
      const text = update.message.text;
      const session = getUserSession(userId);

      // Check for maintenance mode
      const maintenanceMode = await getBotSetting('maintenance_mode');
      if (maintenanceMode === 'true' && !isAdmin(userId)) {
        await sendMessage(chatId, "🔧 *Bot is under maintenance*\n\nWe'll be back soon! Thank you for your patience.");
        return new Response("OK", { status: 200 });
      }

      // Handle /start command with dynamic welcome message
      if (text === '/start') {
        const welcomeMessage = await getWelcomeMessage(firstName);
        
        const keyboard = {
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
              { text: "❓ FAQ", callback_data: "faq" },
              { text: "📋 Terms", callback_data: "terms" }
            ]
          ]
        };

        await sendMessage(chatId, welcomeMessage, keyboard);
        return new Response("OK", { status: 200 });
      }

      // Enhanced admin commands
      if (text === '/admin' && isAdmin(userId)) {
        await handleAdminDashboard(chatId, userId);
        return new Response("OK", { status: 200 });
      }

      // Handle awaiting input for content editing
      if (session.awaitingInput?.startsWith('edit_content_')) {
        const contentKey = session.awaitingInput.replace('edit_content_', '');
        const success = await setBotContent(contentKey, text, userId);
        
        if (success) {
          await sendMessage(chatId, `✅ *Content Updated Successfully!*\n\nThe ${contentKey.replace('_', ' ')} has been updated and will be used immediately.`);
          await logAdminAction(userId, 'content_update', `Updated ${contentKey}`, 'bot_content');
        } else {
          await sendMessage(chatId, "❌ Failed to update content. Please try again.");
        }
        
        session.awaitingInput = null;
        return new Response("OK", { status: 200 });
      }

      // Handle other awaiting inputs (package creation, etc.)
      // ... (additional input handlers would go here)
    }

    // Handle callback queries (button presses)
    if (update.callback_query) {
      const data = update.callback_query.data;
      
      // Answer callback query to remove loading state
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callback_query_id: update.callback_query.id })
      });

      switch (data) {
        case 'view_vip_packages':
          const vipPackages = await getVipPackages();
          let vipMessage = "💎 *VIP Packages*\n\nChoose your trading journey:\n\n";
          
          vipPackages.forEach(pkg => {
            vipMessage += `*${pkg.name}*\n`;
            vipMessage += `💰 Price: $${pkg.price}/${pkg.duration_months} months\n`;
            if (pkg.features && pkg.features.length > 0) {
              vipMessage += `✨ Features: ${pkg.features.join(', ')}\n`;
            }
            vipMessage += `\n`;
          });

          const vipKeyboard = await getVipPackagesKeyboard();
          await sendMessage(chatId, vipMessage, vipKeyboard);
          break;

        case 'view_education':
          const eduPackages = await getEducationPackages();
          let eduMessage = "🎓 *Education Packages*\n\nInvest in your trading education:\n\n";
          
          eduPackages.forEach(pkg => {
            eduMessage += `*${pkg.name}*\n`;
            eduMessage += `💰 Price: $${pkg.price}\n`;
            eduMessage += `⏱️ Duration: ${pkg.duration_weeks} weeks\n`;
            if (pkg.instructor_name) {
              eduMessage += `👨‍🏫 Instructor: ${pkg.instructor_name}\n`;
            }
            eduMessage += `\n`;
          });

          const eduKeyboard = await getEducationPackagesKeyboard();
          await sendMessage(chatId, eduMessage, eduKeyboard);
          break;

        case 'about_us':
          const aboutMessage = await getAboutUsMessage();
          await sendMessage(chatId, aboutMessage);
          break;

        case 'support':
          const supportMessage = await getSupportMessage();
          await sendMessage(chatId, supportMessage);
          break;

        case 'terms':
          const termsMessage = await getTermsMessage();
          await sendMessage(chatId, termsMessage);
          break;

        case 'faq':
          const faqMessage = await getFaqMessage();
          await sendMessage(chatId, faqMessage);
          break;

        // Admin dashboard handlers
        case 'admin_dashboard':
          await handleAdminDashboard(chatId, userId);
          break;

        case 'admin_content':
          await handleContentManagement(chatId, userId);
          break;

        case 'admin_packages':
          await handlePackageManagement(chatId, userId);
          break;

        case 'admin_settings':
          await handleSettingsManagement(chatId, userId);
          break;

        // Content editing handlers
        case data?.startsWith('edit_content_') ? data : null:
          if (!isAdmin(userId)) {
            await sendMessage(chatId, "❌ Access denied.");
            break;
          }
          
          const contentKey = data.replace('edit_content_', '');
          const currentContent = await getBotContent(contentKey);
          
          const session = getUserSession(userId);
          session.awaitingInput = data;
          
          await sendMessage(chatId, `📝 *Edit ${contentKey.replace('_', ' ').toUpperCase()}*\n\n**Current content:**\n${currentContent}\n\n**Send your new content:**`);
          break;

        default:
          await sendMessage(chatId, "🚀 Welcome to Dynamic Capital! Use /start to see all options.");
          break;
      }
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Error:", error);
    return new Response("Error", { status: 500 });
  }
});