// Enhanced admin handlers for comprehensive table management
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const supabaseAdmin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

// Import utility functions
import { logAdminAction, getBotContent, setBotContent, getBotSetting, setBotSetting } from "./database-utils.ts";

export async function sendMessage(
  chatId: number,
  text: string,
  replyMarkup?: Record<string, unknown>
) {
  const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
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
      console.error("❌ Telegram API error:", errorData);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("❌ Error sending message:", error);
    return null;
  }
}

// Enhanced table management handlers
export async function handleTableManagement(chatId: number, userId: string): Promise<void> {
  const tableMessage = `🗃️ *Database Table Management*

📊 *Available Tables:*
• 👥 **Bot Users** - User management & admin status
• 💎 **Subscription Plans** - VIP packages & pricing
• 🎓 **Education Packages** - Courses & learning content
• 💰 **Promotions** - Discount codes & campaigns
• 📱 **Bot Content** - Messages & UI text
• ⚙️ **Bot Settings** - Configuration & behavior
• 📈 **Analytics** - User data & conversion tracking
• 💬 **User Sessions** - Active sessions & state
• 🎯 **User Interactions** - Activity tracking
• 💳 **Payments** - Transaction records
• 📢 **Broadcast Messages** - Mass communication
• 🏦 **Bank Accounts** - Payment methods
• 📝 **Auto Reply Templates** - Automated responses

🔧 *Management Actions:*
View, Create, Edit, Delete, Export data for any table.`;

  const tableKeyboard = {
    inline_keyboard: [
      [
        { text: "👥 Users", callback_data: "manage_table_bot_users" },
        { text: "💎 VIP Plans", callback_data: "manage_table_subscription_plans" }
      ],
      [
        { text: "🎓 Education", callback_data: "manage_table_education_packages" },
        { text: "💰 Promotions", callback_data: "manage_table_promotions" }
      ],
      [
        { text: "📱 Content", callback_data: "manage_table_bot_content" },
        { text: "⚙️ Settings", callback_data: "manage_table_bot_settings" }
      ],
      [
        { text: "📈 Analytics", callback_data: "manage_table_daily_analytics" },
        { text: "💬 Sessions", callback_data: "manage_table_user_sessions" }
      ],
      [
        { text: "💳 Payments", callback_data: "manage_table_payments" },
        { text: "📢 Broadcasts", callback_data: "manage_table_broadcast_messages" }
      ],
      [
        { text: "🏦 Bank Accounts", callback_data: "manage_table_bank_accounts" },
        { text: "📝 Templates", callback_data: "manage_table_auto_reply_templates" }
      ],
      [
        { text: "📊 Quick Stats", callback_data: "table_stats_overview" },
        { text: "💾 Export All", callback_data: "export_all_tables" }
      ],
      [
        { text: "🔙 Back to Admin", callback_data: "admin_dashboard" }
      ]
    ]
  };

  await sendMessage(chatId, tableMessage, tableKeyboard);
}

// Individual table management handlers
export async function handleUserTableManagement(chatId: number, userId: string): Promise<void> {
  try {
    const { data: users, error } = await supabaseAdmin
      .from('bot_users')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    const totalCount = await supabaseAdmin
      .from('bot_users')
      .select('count', { count: 'exact' });

    const adminCount = await supabaseAdmin
      .from('bot_users')
      .select('count', { count: 'exact' })
      .eq('is_admin', true);

    const vipCount = await supabaseAdmin
      .from('bot_users')
      .select('count', { count: 'exact' })
      .eq('is_vip', true);

    let userMessage = `👥 *Bot Users Management*\n\n`;
    userMessage += `📊 *Statistics:*\n`;
    userMessage += `• Total Users: ${totalCount.count || 0}\n`;
    userMessage += `• Admin Users: ${adminCount.count || 0}\n`;
    userMessage += `• VIP Users: ${vipCount.count || 0}\n\n`;

    userMessage += `👤 *Recent Users (Last 10):*\n`;
    users?.forEach((user, index) => {
      const status = user.is_admin ? '🔑' : user.is_vip ? '💎' : '👤';
      userMessage += `${index + 1}. ${status} ${user.first_name || 'Unknown'} (@${user.username || 'N/A'})\n`;
      userMessage += `   ID: ${user.telegram_id} | Joined: ${new Date(user.created_at).toLocaleDateString()}\n`;
    });

    const userKeyboard = {
      inline_keyboard: [
        [
          { text: "➕ Add Admin", callback_data: "add_admin_user" },
          { text: "🔍 Search User", callback_data: "search_user" }
        ],
        [
          { text: "💎 Manage VIP", callback_data: "manage_vip_users" },
          { text: "📊 Export Users", callback_data: "export_users" }
        ],
        [
          { text: "🔄 Refresh", callback_data: "manage_table_bot_users" },
          { text: "🔙 Back", callback_data: "manage_tables" }
        ]
      ]
    };

    await sendMessage(chatId, userMessage, userKeyboard);
  } catch (error) {
    console.error('Error in user table management:', error);
    await sendMessage(chatId, "❌ Error fetching user data. Please try again.");
  }
}

export async function handleSubscriptionPlansManagement(chatId: number, userId: string): Promise<void> {
  try {
    const { data: plans, error } = await supabaseAdmin
      .from('subscription_plans')
      .select('*')
      .order('price', { ascending: true });

    let planMessage = `💎 *VIP Subscription Plans Management*\n\n`;
    planMessage += `📦 *Current Plans (${plans?.length || 0}):*\n\n`;

    plans?.forEach((plan, index) => {
      const duration = plan.is_lifetime ? 'Lifetime' : `${plan.duration_months} months`;
      planMessage += `${index + 1}. **${plan.name}**\n`;
      planMessage += `   💰 ${plan.currency} ${plan.price} (${duration})\n`;
      planMessage += `   ✨ Features: ${plan.features?.length || 0} items\n`;
      planMessage += `   ID: \`${plan.id}\`\n\n`;
    });

    const planKeyboard = {
      inline_keyboard: [
        [
          { text: "➕ Create Plan", callback_data: "create_vip_plan" },
          { text: "✏️ Edit Plan", callback_data: "edit_vip_plan" }
        ],
        [
          { text: "🗑️ Delete Plan", callback_data: "delete_vip_plan" },
          { text: "📊 Plan Stats", callback_data: "vip_plan_stats" }
        ],
        [
          { text: "💰 Update Pricing", callback_data: "update_plan_pricing" },
          { text: "🎯 Manage Features", callback_data: "manage_plan_features" }
        ],
        [
          { text: "🔄 Refresh", callback_data: "manage_table_subscription_plans" },
          { text: "🔙 Back", callback_data: "manage_tables" }
        ]
      ]
    };

    await sendMessage(chatId, planMessage, planKeyboard);
  } catch (error) {
    console.error('Error in subscription plans management:', error);
    await sendMessage(chatId, "❌ Error fetching subscription plans. Please try again.");
  }
}

export async function handlePromotionsManagement(chatId: number, userId: string): Promise<void> {
  try {
    const { data: promos, error } = await supabaseAdmin
      .from('promotions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    const activeCount = await supabaseAdmin
      .from('promotions')
      .select('count', { count: 'exact' })
      .eq('is_active', true);

    let promoMessage = `💰 *Promotions Management*\n\n`;
    promoMessage += `📊 *Statistics:*\n`;
    promoMessage += `• Active Promotions: ${activeCount.count || 0}\n`;
    promoMessage += `• Total Promotions: ${promos?.length || 0}\n\n`;

    promoMessage += `🎁 *Recent Promotions:*\n`;
    promos?.forEach((promo, index) => {
      const status = promo.is_active ? '🟢' : '🔴';
      const discount = promo.discount_type === 'percentage' ? `${promo.discount_value}%` : `$${promo.discount_value}`;
      promoMessage += `${index + 1}. ${status} **${promo.code}**\n`;
      promoMessage += `   💰 ${discount} ${promo.discount_type}\n`;
      promoMessage += `   📅 Valid until: ${new Date(promo.valid_until).toLocaleDateString()}\n`;
      promoMessage += `   📈 Used: ${promo.current_uses || 0}/${promo.max_uses || '∞'}\n\n`;
    });

    const promoKeyboard = {
      inline_keyboard: [
        [
          { text: "➕ Create Promo", callback_data: "create_promotion" },
          { text: "✏️ Edit Promo", callback_data: "edit_promotion" }
        ],
        [
          { text: "🗑️ Delete Promo", callback_data: "delete_promotion" },
          { text: "📊 Promo Analytics", callback_data: "promotion_analytics" }
        ],
        [
          { text: "🔄 Toggle Status", callback_data: "toggle_promotion_status" },
          { text: "📈 Usage Stats", callback_data: "promotion_usage_stats" }
        ],
        [
          { text: "🔄 Refresh", callback_data: "manage_table_promotions" },
          { text: "🔙 Back", callback_data: "manage_tables" }
        ]
      ]
    };

    await sendMessage(chatId, promoMessage, promoKeyboard);
  } catch (error) {
    console.error('Error in promotions management:', error);
    await sendMessage(chatId, "❌ Error fetching promotions data. Please try again.");
  }
}

export async function handleContentManagement(chatId: number, userId: string): Promise<void> {
  try {
    const { data: content, error } = await supabaseAdmin
      .from('bot_content')
      .select('*')
      .order('content_key', { ascending: true });

    let contentMessage = `📱 *Bot Content Management*\n\n`;
    contentMessage += `📝 *Editable Content (${content?.length || 0} items):*\n\n`;

    const contentTypes = {
      'welcome_message': '🚀 Welcome Message',
      'about_us': '🏢 About Us',
      'support_message': '🛟 Support Info',
      'terms_conditions': '📋 Terms & Conditions',
      'faq_general': '❓ FAQ Content',
      'maintenance_message': '🔧 Maintenance Notice'
    };

    content?.forEach((item, index) => {
      const displayName = contentTypes[item.content_key] || `📄 ${item.content_key}`;
      const status = item.is_active ? '🟢' : '🔴';
      const preview = item.content_value.substring(0, 50) + '...';
      
      contentMessage += `${index + 1}. ${status} ${displayName}\n`;
      contentMessage += `   📄 Preview: ${preview}\n`;
      contentMessage += `   🕐 Updated: ${new Date(item.updated_at).toLocaleDateString()}\n\n`;
    });

    const contentKeyboard = {
      inline_keyboard: [
        [
          { text: "🚀 Welcome Msg", callback_data: "edit_content_welcome_message" },
          { text: "🏢 About Us", callback_data: "edit_content_about_us" }
        ],
        [
          { text: "🛟 Support", callback_data: "edit_content_support_message" },
          { text: "📋 Terms", callback_data: "edit_content_terms_conditions" }
        ],
        [
          { text: "❓ FAQ", callback_data: "edit_content_faq_general" },
          { text: "🔧 Maintenance", callback_data: "edit_content_maintenance_message" }
        ],
        [
          { text: "➕ Add Content", callback_data: "add_new_content" },
          { text: "👀 Preview All", callback_data: "preview_all_content" }
        ],
        [
          { text: "🔄 Refresh", callback_data: "manage_table_bot_content" },
          { text: "🔙 Back", callback_data: "manage_tables" }
        ]
      ]
    };

    await sendMessage(chatId, contentMessage, contentKeyboard);
  } catch (error) {
    console.error('Error in content management:', error);
    await sendMessage(chatId, "❌ Error fetching content data. Please try again.");
  }
}

export async function handleBotSettingsManagement(chatId: number, userId: string): Promise<void> {
  try {
    const { data: settings, error } = await supabaseAdmin
      .from('bot_settings')
      .select('*')
      .order('setting_key', { ascending: true });

    let settingsMessage = `⚙️ *Bot Settings Management*\n\n`;
    settingsMessage += `🔧 *Current Settings (${settings?.length || 0} items):*\n\n`;

    const settingTypes = {
      'session_timeout_minutes': '🕐 Session Timeout',
      'follow_up_delay_minutes': '📬 Follow-up Delay',
      'max_follow_ups': '🔢 Max Follow-ups',
      'maintenance_mode': '🔧 Maintenance Mode',
      'auto_welcome': '🚀 Auto Welcome',
      'admin_notifications': '🔔 Admin Notifications'
    };

    settings?.forEach((setting, index) => {
      const displayName = settingTypes[setting.setting_key] || `⚙️ ${setting.setting_key}`;
      const status = setting.is_active ? '🟢' : '🔴';
      
      settingsMessage += `${index + 1}. ${status} ${displayName}\n`;
      settingsMessage += `   📄 Value: \`${setting.setting_value}\`\n`;
      settingsMessage += `   🕐 Updated: ${new Date(setting.updated_at).toLocaleDateString()}\n\n`;
    });

    const settingsKeyboard = {
      inline_keyboard: [
        [
          { text: "🕐 Session Config", callback_data: "config_session_settings" },
          { text: "📬 Follow-up Setup", callback_data: "config_followup_settings" }
        ],
        [
          { text: "🔧 Maintenance", callback_data: "toggle_maintenance_mode" },
          { text: "🚀 Auto Features", callback_data: "config_auto_features" }
        ],
        [
          { text: "🔔 Notifications", callback_data: "config_notifications" },
          { text: "⚡ Performance", callback_data: "config_performance" }
        ],
        [
          { text: "➕ Add Setting", callback_data: "add_new_setting" },
          { text: "💾 Backup Config", callback_data: "backup_bot_settings" }
        ],
        [
          { text: "🔄 Refresh", callback_data: "manage_table_bot_settings" },
          { text: "🔙 Back", callback_data: "manage_tables" }
        ]
      ]
    };

    await sendMessage(chatId, settingsMessage, settingsKeyboard);
  } catch (error) {
    console.error('Error in bot settings management:', error);
    await sendMessage(chatId, "❌ Error fetching bot settings. Please try again.");
  }
}

// Quick stats overview for all tables
export async function handleTableStatsOverview(chatId: number, userId: string): Promise<void> {
  try {
    const tables = [
      'bot_users', 'subscription_plans', 'education_packages', 'promotions',
      'bot_content', 'bot_settings', 'user_sessions', 'payments',
      'broadcast_messages', 'daily_analytics', 'user_interactions'
    ];

    let statsMessage = `📊 *Database Overview & Statistics*\n\n`;

    for (const table of tables) {
      try {
        const { count } = await supabaseAdmin
          .from(table)
          .select('count', { count: 'exact' });
        
        const tableEmoji = {
          'bot_users': '👥',
          'subscription_plans': '💎',
          'education_packages': '🎓',
          'promotions': '💰',
          'bot_content': '📱',
          'bot_settings': '⚙️',
          'user_sessions': '💬',
          'payments': '💳',
          'broadcast_messages': '📢',
          'daily_analytics': '📈',
          'user_interactions': '🎯'
        }[table] || '📊';

        const tableName = table.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        statsMessage += `${tableEmoji} **${tableName}**: ${count || 0} records\n`;
      } catch (error) {
        console.error(`Error fetching count for ${table}:`, error);
      }
    }

    statsMessage += `\n🕐 *Last Updated*: ${new Date().toLocaleString()}\n`;
    statsMessage += `🔄 *Auto-refresh every 5 minutes*`;

    const statsKeyboard = {
      inline_keyboard: [
        [
          { text: "🔄 Refresh Stats", callback_data: "table_stats_overview" },
          { text: "📊 Detailed Analytics", callback_data: "detailed_analytics" }
        ],
        [
          { text: "💾 Export Summary", callback_data: "export_stats_summary" },
          { text: "📈 Growth Report", callback_data: "growth_report" }
        ],
        [
          { text: "🔙 Back to Tables", callback_data: "manage_tables" }
        ]
      ]
    };

    await sendMessage(chatId, statsMessage, statsKeyboard);
  } catch (error) {
    console.error('Error in table stats overview:', error);
    await sendMessage(chatId, "❌ Error fetching database statistics. Please try again.");
  }
}