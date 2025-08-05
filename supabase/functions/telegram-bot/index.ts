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
    return response.ok;
  } catch (error) {
    console.error("Error sending message:", error);
    return false;
  }
}

function getUserSession(userId: string) {
  if (!userSessions.has(userId)) {
    userSessions.set(userId, {
      awaitingInput: null,
      messageHistory: []
    });
  }
  return userSessions.get(userId);
}

// Receipt upload and admin notification functions
async function uploadReceiptToStorage(fileId: string, paymentId: string, userId: string) {
  try {
    // Download file from Telegram
    const fileResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`);
    const fileData = await fileResponse.json();
    
    if (!fileData.ok) return null;
    
    const filePath = fileData.result.file_path;
    const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`;
    
    // Download the actual file
    const downloadResponse = await fetch(fileUrl);
    const fileBuffer = await downloadResponse.arrayBuffer();
    
    // Upload to Supabase Storage
    const fileName = `${paymentId}-${Date.now()}.jpg`;
    const { data, error } = await supabaseAdmin.storage
      .from('payment-receipts')
      .upload(fileName, fileBuffer, {
        contentType: downloadResponse.headers.get('content-type') || 'image/jpeg',
        upsert: false
      });
    
    if (error) {
      console.error('Storage upload error:', error);
      return null;
    }
    
    // Update payment record with receipt info
    await supabaseAdmin
      .from('payments')
      .update({ 
        receipt_file_path: fileName,
        receipt_telegram_file_id: fileId,
        status: 'pending_review'
      })
      .eq('id', paymentId);
    
    return fileName;
  } catch (error) {
    console.error('Receipt upload error:', error);
    return null;
  }
}

async function notifyAdminsOfNewReceipt(paymentId: string, userId: string, userName: string) {
  try {
    const { data: payment } = await supabaseAdmin
      .from('payments')
      .select('*, subscription_plans(*)')
      .eq('id', paymentId)
      .single();
    
    if (!payment) return;
    
    const adminMessage = `🧾 *New Payment Receipt Uploaded*

👤 User: ${userName} (${userId})
📦 Package: ${payment.subscription_plans?.name || 'Unknown'}
💰 Amount: $${payment.amount}
💳 Method: ${payment.payment_method}
📋 Payment ID: ${paymentId}

⏰ Uploaded: ${new Date().toLocaleString()}

Please review and approve/reject this payment:`;

    const adminKeyboard = {
      inline_keyboard: [
        [
          { text: "✅ Approve Payment", callback_data: `approve_payment_${paymentId}` },
          { text: "❌ Reject Payment", callback_data: `reject_payment_${paymentId}` }
        ]
      ]
    };

    // Send to all admins
    for (const adminId of ADMIN_USER_IDS) {
      await sendMessage(parseInt(adminId), adminMessage, adminKeyboard);
    }
  } catch (error) {
    console.error('Error notifying admins:', error);
  }
}

async function handlePaymentDecision(paymentId: string, action: 'approve' | 'reject', adminId: string) {
  try {
    const { data: payment } = await supabaseAdmin
      .from('payments')
      .select('*, subscription_plans(*)')
      .eq('id', paymentId)
      .single();
    
    if (!payment) return false;
    
    const newStatus = action === 'approve' ? 'completed' : 'rejected';
    
    // Update payment status
    await supabaseAdmin
      .from('payments')
      .update({ 
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', paymentId);
    
    // If approved, create/update subscription
    if (action === 'approve') {
      const subscriptionEndDate = new Date();
      subscriptionEndDate.setMonth(subscriptionEndDate.getMonth() + payment.subscription_plans.duration_months);
      
      await supabaseAdmin
        .from('user_subscriptions')
        .upsert({
          telegram_user_id: payment.user_id,
          plan_id: payment.plan_id,
          is_active: true,
          payment_status: 'completed',
          subscription_start_date: new Date().toISOString(),
          subscription_end_date: subscriptionEndDate.toISOString()
        });
      
      // Update bot_users table
      await supabaseAdmin
        .from('bot_users')
        .update({
          is_vip: true,
          current_plan_id: payment.plan_id,
          subscription_expires_at: subscriptionEndDate.toISOString()
        })
        .eq('telegram_id', payment.user_id);
    }
    
    // Notify user
    const userMessage = action === 'approve' 
      ? `🎉 *Payment Approved!*

✅ Your payment has been approved!
📦 Package: ${payment.subscription_plans?.name}
💰 Amount: $${payment.amount}

🎊 Welcome to VIP! You now have access to:
• Premium trading signals
• VIP chat access  
• Daily market analysis
• Mentorship programs

Enjoy your VIP benefits!`
      : `❌ *Payment Rejected*

Unfortunately, your payment could not be verified.
📋 Payment ID: ${paymentId}
💰 Amount: $${payment.amount}

Please contact support for assistance or try uploading a clearer receipt.`;

    const userKeyboard = {
      inline_keyboard: [
        action === 'approve' 
          ? [{ text: "🎯 Access VIP Features", callback_data: "vip_features" }]
          : [{ text: "💬 Contact Support", callback_data: "contact_support" }],
        [{ text: "🔙 Main Menu", callback_data: "back_to_main" }]
      ]
    };

    await sendMessage(parseInt(payment.user_id), userMessage, userKeyboard);
    
    return true;
  } catch (error) {
    console.error('Error handling payment decision:', error);
    return false;
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
        .insert([
          {
            telegram_id: telegramId,
            first_name: firstName || null,
            last_name: lastName || null,
            username: username || null,
          },
        ])
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

// FAQ and Promo Code functions
async function getActivePromotions() {
  try {
    const { data, error } = await supabase
      .from('promotions')
      .select('*')
      .eq('is_active', true)
      .gte('valid_until', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Promotions query error:', error);
      return [];
    }

    console.log('Active promotions found:', data?.length || 0);
    return data || [];
  } catch (error) {
    console.error('Error fetching promotions:', error);
    return [];
  }
}

async function getFAQs() {
  // Static FAQ for now - you can move this to database later
  return [
    {
      question: "What is VIP membership?",
      answer: "VIP membership gives you access to premium trading signals, daily market analysis, mentorship programs, and exclusive VIP chat access.",
    },
    {
      question: "How do I join the VIP community?",
      answer: "Select a VIP package, make payment via bank transfer, upload your receipt, and wait for admin approval (24-48 hours).",
    },
    {
      question: "What payment methods do you accept?",
      answer: "We accept bank transfers to BML and MIB accounts in both MVR and USD currencies.",
    },
    {
      question: "How long does approval take?",
      answer: "Payment approvals typically take 24-48 hours. You'll receive a notification once approved.",
    },
    {
      question: "Can I get a refund?",
      answer: "Refunds are available within 7 days of payment approval. Contact support for assistance.",
    },
    {
      question: "How do I access mentorship programs?",
      answer: "Mentorship programs are available to VIP members. You'll receive access details once your membership is approved.",
    },
  ];
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

// Analytics tracking function
async function trackDailyAnalytics() {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Get today's stats
    const [usersResult, newUsersResult] = await Promise.all([
      supabaseAdmin.from('bot_users').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('bot_users').select('id', { count: 'exact', head: true }).gte('created_at', today)
    ]);

    // Update or create daily analytics
    await supabaseAdmin
      .from('daily_analytics')
      .upsert({
        date: today,
        total_users: usersResult.count || 0,
        new_users: newUsersResult.count || 0
      });
  } catch (error) {
    console.error('Analytics tracking error:', error);
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
    const body = await req.text();
    const update = JSON.parse(body);

    console.log("Update received:", JSON.stringify(update));

    // Extract user info
    const from = update.message?.from || update.callback_query?.from;
    if (!from) return new Response("OK", { status: 200 });

    const chatId = update.message?.chat?.id || update.callback_query?.message?.chat?.id;
    const userId = from.id.toString();
    const firstName = from.first_name;
    const lastName = from.last_name;
    const username = from.username;

    // Fetch or create bot user
    const botUser = await fetchOrCreateBotUser(userId, firstName, lastName, username);

    // Handle regular messages
    if (update.message) {
      const text = update.message.text;
      const document = update.message.document;
      const photo = update.message.photo;
      const session = getUserSession(userId);

      // Handle receipt uploads (documents or photos)
      if (document || photo) {
        if (session.awaitingInput && session.awaitingInput.startsWith('upload_receipt_')) {
          const paymentId = session.awaitingInput.replace('upload_receipt_', '');
          const fileId = document ? document.file_id : photo[photo.length - 1].file_id;
          
          await sendMessage(chatId, "📤 *Uploading Receipt...*\n\nPlease wait while we process your receipt...");
          
          const fileName = await uploadReceiptToStorage(fileId, paymentId, userId);
          if (fileName) {
            session.awaitingInput = null;
            await notifyAdminsOfNewReceipt(paymentId, userId, firstName || 'Unknown');
            
            const successMessage = `✅ *Receipt Uploaded Successfully!*

📋 Payment ID: ${paymentId}
📎 Receipt: Uploaded and saved
⏰ Status: Under Review

Our team will review your payment within 24 hours and notify you once approved.

Thank you for your patience!`;

            const receiptKeyboard = {
              inline_keyboard: [
                [{ text: "🔍 Check Status", callback_data: `check_payment_${paymentId}` }],
                [{ text: "🔙 Main Menu", callback_data: "back_to_main" }]
              ]
            };

            await sendMessage(chatId, successMessage, receiptKeyboard);
          } else {
            await sendMessage(chatId, "❌ Failed to upload receipt. Please try again or contact support.");
          }
          
          return new Response("OK", { status: 200 });
        }
      }

      if (text && session.awaitingInput === 'register_wallet') {
        const wallet = text.trim();
        try {
          await supabaseAdmin.from('shares').upsert({
            telegram_id: userId.toString(),
            wallet_address: wallet,
          }, { onConflict: 'telegram_id' });
          await sendMessage(chatId, "✅ Registration complete!");
        } catch (error) {
          console.error('Save wallet error:', error);
          await sendMessage(chatId, "❌ Failed to save wallet address. Please try again.");
        }
        session.awaitingInput = null;
        return new Response("OK", { status: 200 });
      }

      if (text === '/start') {
        const welcomeMessage = `🎯 *Welcome to Dynamic Capital VIP!*

👋 Hello ${firstName}! Ready to join our exclusive trading community?

🌟 *What Our VIP Community Offers:*
• 🔥 Premium trading signals & alerts
• 📊 Daily market analysis & insights  
• 🎓 Professional mentorship programs
• 💎 Exclusive VIP chat access
• 📈 Live market outlook sessions
• 🎯 Personalized trading strategies

🆓 *Free Member Benefits:*
• Basic market updates
• Limited community access
• 3 educational resources per month

💎 *Ready to unlock VIP benefits?*
Choose an option below:`;

        const keyboard = {
          inline_keyboard: [
            [
              { text: "💎 Join VIP Community", callback_data: "view_packages" },
              { text: "🎓 Education Hub", callback_data: "view_education" }
            ],
            [
              { text: "📊 Market Analysis", callback_data: "market_overview" },
              { text: "🎯 Trading Signals", callback_data: "trading_signals" }
            ],
            [
              { text: "🎁 Active Promotions", callback_data: "view_promotions" },
              { text: "👤 My Account", callback_data: "user_status" }
            ],
            [
              { text: "ℹ️ About Us", callback_data: "about_us" },
              { text: "💬 Get Support", callback_data: "contact_support" }
            ]
          ]
        };

        await sendMessage(chatId, welcomeMessage, keyboard);
        await trackDailyAnalytics();
        
        return new Response("OK", { status: 200 });
      }

      // Handle admin commands with flexible text matching
      const cleanText = text?.trim();
      const lowerText = cleanText?.toLowerCase();

      if (lowerText === '/register' || lowerText?.startsWith('/register ')) {
        const parts = cleanText.split(' ');
        const wallet = parts[1];
        if (wallet) {
          try {
            await supabaseAdmin.from('shares').upsert({
              telegram_id: userId.toString(),
              wallet_address: wallet,
            }, { onConflict: 'telegram_id' });
            await sendMessage(chatId, "✅ Registration complete!");
          } catch (error) {
            console.error('Register error:', error);
            await sendMessage(chatId, "❌ Failed to register. Please try again.");
          }
        } else {
          session.awaitingInput = 'register_wallet';
          await sendMessage(chatId, "📝 Please send your wallet address to complete registration.");
        }
        return new Response("OK", { status: 200 });
      }

      if (lowerText === '/myshares') {
        try {
          const { data } = await supabaseAdmin
            .from('shares')
            .select('share_percent, reinvested_amount')
            .eq('telegram_id', userId.toString())
            .single();

          if (data) {
            const share = Number(data.share_percent ?? 0);
            const reinvested = Number(data.reinvested_amount ?? 0);
            await sendMessage(
              chatId,
              `📊 *Your Shares*\n\n• Share: ${share}%\n• Reinvested Amount: $${reinvested.toFixed(2)}`,
            );
          } else {
            await sendMessage(chatId, "❌ No share information found. Use /register to set up your wallet.");
          }
        } catch (error) {
          console.error('Share query error:', error);
          await sendMessage(chatId, "❌ Error fetching share information.");
        }
        return new Response("OK", { status: 200 });
      }

      if (lowerText === '/admin' || lowerText === 'admin' || lowerText === '/admin@dynamic_vip_bot') {
        console.log(`Admin command received from user ${userId}, checking admin status...`);
        console.log(`User ID type: ${typeof userId}, Admin IDs: ${JSON.stringify(ADMIN_USER_IDS)}`);
        console.log(`isAdmin result: ${isAdmin(userId.toString())}`);
        
        if (!isAdmin(userId.toString())) {
          await sendMessage(chatId, "❌ Access denied. Admin privileges required.");
          return new Response("OK", { status: 200 });
        }

        const adminMessage = `🔐 *Admin Dashboard*

📊 *Available Commands:*
• 📈 View Statistics  
• 👥 Manage Users
• 💰 Manage Payments
• 📢 Send Broadcast
• 💾 Export Data
• 💬 Manage Welcome Message
• 📦 Manage Packages  
• 🎁 Manage Promo Codes

*⚡ Quick Commands:*
/users - View users list
/stats - Bot statistics  
/packages - Manage packages
/promos - Manage promos
/welcome - Edit welcome message
/broadcast - Send broadcast
/help_admin - Commands help

Choose an admin action:`;

        const adminKeyboard = {
          inline_keyboard: [
            [
              { text: "📈 Statistics", callback_data: "admin_stats" },
              { text: "👥 Users", callback_data: "admin_users" }
            ],
            [
              { text: "💰 Payments", callback_data: "admin_payments" },
              { text: "📢 Broadcast", callback_data: "admin_broadcast" }
            ],
            [
              { text: "💬 Welcome Message", callback_data: "admin_welcome" },
              { text: "📦 Packages", callback_data: "admin_packages" }
            ],
            [
              { text: "🎁 Promo Codes", callback_data: "admin_promos" },
              { text: "💾 Export Data", callback_data: "admin_export" }
            ],
            [
              { text: "🔙 Main Menu", callback_data: "back_to_main" }
            ]
          ]
        };

        await sendMessage(chatId, adminMessage, adminKeyboard);
        return new Response("OK", { status: 200 });
      }

      // Simple admin test command
      if ((lowerText === '/test' || lowerText === 'test') && isAdmin(userId.toString())) {
        await sendMessage(chatId, `✅ Admin test successful! Your ID: ${userId}`);
        return new Response("OK", { status: 200 });
      }

      // Admin-only quick commands
      if (text === '/users' && isAdmin(userId.toString())) {
        console.log(`/users command received from user ${userId}`);
        try {
          const { data: users, error } = await supabaseAdmin
            .from('bot_users')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(20);

          if (error) throw error;

          let usersMessage = `👥 *Recent Users (Last 20)*\n\n`;
          
          if (users && users.length > 0) {
            users.forEach((user, index) => {
              const vipStatus = user.is_vip ? "🌟 VIP" : "👤 Regular";
              const name = user.first_name || user.username || "Unknown";
              const created = new Date(user.created_at).toLocaleDateString();
              
              usersMessage += `${index + 1}. ${name} (${vipStatus})\n`;
              usersMessage += `   📱 ID: ${user.telegram_id}\n`;
              usersMessage += `   📅 Joined: ${created}\n`;
              if (user.subscription_expires_at) {
                const expires = new Date(user.subscription_expires_at).toLocaleDateString();
                usersMessage += `   ⏰ Expires: ${expires}\n`;
              }
              usersMessage += `\n`;
            });
          } else {
            usersMessage += "No users found.";
          }

          const usersKeyboard = {
            inline_keyboard: [
              [{ text: "🔙 Back to Admin", callback_data: "admin_users" }]
            ]
          };

          await sendMessage(chatId, usersMessage, usersKeyboard);
        } catch (error) {
          await sendMessage(chatId, "❌ Error fetching users data.");
        }
        return new Response("OK", { status: 200 });
      }

      if (text === '/stats' && isAdmin(userId.toString())) {
        try {
          // Get user statistics
          const { data: totalUsers } = await supabaseAdmin
            .from('bot_users')
            .select('id', { count: 'exact' });

          const { data: vipUsers } = await supabaseAdmin
            .from('bot_users')
            .select('id', { count: 'exact' })
            .eq('is_vip', true);

          const { data: recentUsers } = await supabaseAdmin
            .from('bot_users')
            .select('id', { count: 'exact' })
            .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

          const { data: totalPayments } = await supabaseAdmin
            .from('user_subscriptions')
            .select('id', { count: 'exact' })
            .eq('payment_status', 'approved');

          const { data: pendingPayments } = await supabaseAdmin
            .from('user_subscriptions')
            .select('id', { count: 'exact' })
            .eq('payment_status', 'pending');

          const statsMessage = `📊 *Bot Statistics*

👥 *Users:*
• Total Users: ${totalUsers?.length || 0}
• VIP Users: ${vipUsers?.length || 0}
• New Users (7 days): ${recentUsers?.length || 0}

💰 *Payments:*
• Approved: ${totalPayments?.length || 0}
• Pending: ${pendingPayments?.length || 0}

📈 *Growth:*
• Conversion Rate: ${totalUsers?.length ? ((vipUsers?.length || 0) / totalUsers.length * 100).toFixed(1) : 0}%
• Weekly Growth: ${recentUsers?.length || 0} new users`;

          const statsKeyboard = {
            inline_keyboard: [
              [{ text: "🔙 Back to Admin", callback_data: "admin_stats" }]
            ]
          };

          await sendMessage(chatId, statsMessage, statsKeyboard);
        } catch (error) {
          await sendMessage(chatId, "❌ Error fetching statistics.");
        }
        return new Response("OK", { status: 200 });
      }

      if (text === '/packages' && isAdmin(userId.toString())) {
        // Redirect to package management
        const packagesMessage = `📦 *Package Management*

Quick access to package management:`;

        const packagesKeyboard = {
          inline_keyboard: [
            [{ text: "📋 View Packages", callback_data: "view_packages" }],
            [{ text: "➕ Add Package", callback_data: "add_package" }],
            [{ text: "✏️ Edit Package", callback_data: "edit_package_list" }],
            [{ text: "🗑 Delete Package", callback_data: "delete_package_list" }],
            [{ text: "🔙 Back to Admin", callback_data: "admin_packages" }]
          ]
        };

        await sendMessage(chatId, packagesMessage, packagesKeyboard);
        return new Response("OK", { status: 200 });
      }

      if (text === '/promos' && isAdmin(userId.toString())) {
        // Redirect to promo management
        const promosMessage = `💳 *Promotion Management*

Quick access to promotion code management:`;

        const promosKeyboard = {
          inline_keyboard: [
            [{ text: "📋 View Promos", callback_data: "view_promos" }],
            [{ text: "➕ Add Promo", callback_data: "add_promo" }],
            [{ text: "✏️ Edit Promo", callback_data: "edit_promo_list" }],
            [{ text: "🗑 Delete Promo", callback_data: "delete_promo_list" }],
            [{ text: "🔙 Back to Admin", callback_data: "admin_promos" }]
          ]
        };

        await sendMessage(chatId, promosMessage, promosKeyboard);
        return new Response("OK", { status: 200 });
      }

      if (text === '/welcome' && isAdmin(userId.toString())) {
        // Start welcome message editing
        const welcomeSession = getUserSession(userId);
        welcomeSession.awaitingInput = 'edit_welcome_message';
        
        await sendMessage(chatId, `📝 *Edit Welcome Message*

Please send the new welcome message you'd like to use.

You can use:
• **Bold text** for emphasis
• *Italic text* for style
• \`Code text\` for highlights
• Emojis for visual appeal

Current welcome message will be replaced with your new message.`);
        return new Response("OK", { status: 200 });
      }

      if (text === '/broadcast' && isAdmin(userId.toString())) {
        const broadcastSession = getUserSession(userId);
        broadcastSession.awaitingInput = 'broadcast_message';
        
        await sendMessage(chatId, `📢 *Send Broadcast Message*

Please send the message you want to broadcast to all users.

You can use:
• **Bold text** for emphasis
• *Italic text* for style
• \`Code text\` for highlights
• Emojis for visual appeal

⚠️ This will be sent to ALL bot users. Make sure your message is ready!`);
        return new Response("OK", { status: 200 });
      }

      if (text === '/help_admin' && isAdmin(userId.toString())) {
        const helpMessage = `🔧 *Admin Commands Help*

*Quick Commands:*
/admin - Main admin dashboard
/users - View recent users list
/stats - View bot statistics  
/packages - Quick package management
/promos - Quick promo management
/welcome - Edit welcome message
/broadcast - Send message to all users
/help_admin - This help message

*Dashboard Features:*
• 📊 Analytics & user management
• 📦 Add/edit/delete packages
• 💳 Create/manage promo codes
• 💬 Customize welcome messages
• 🔧 Bot configuration settings

*Payment Management:*
• Approve/reject payments
• View payment receipts
• Manage user subscriptions
• Track payment analytics

Type any command to get started!`;

        const helpKeyboard = {
          inline_keyboard: [
            [{ text: "🔧 Open Admin Dashboard", callback_data: "admin_stats" }]
          ]
        };

        await sendMessage(chatId, helpMessage, helpKeyboard);
        return new Response("OK", { status: 200 });
      }

      // Handle admin text input flows
      if (text && isAdmin(userId.toString())) {
        const session = getUserSession(userId);
        
        // Handle welcome message editing
        if (session.awaitingInput === 'edit_welcome_message') {
          try {
            // Store the new welcome message in auto_reply_templates table
            await supabaseAdmin
              .from('auto_reply_templates')
              .upsert({
                name: 'welcome_message',
                trigger_type: 'start_command',
                message_template: text,
                is_active: true
              });
            
            session.awaitingInput = null;
            
            await sendMessage(chatId, `✅ *Welcome Message Updated!*

Your new welcome message has been saved and will be used for all new users.

✨ Preview:
${text}

The changes are now live!`);
            
            return new Response("OK", { status: 200 });
          } catch (error) {
            await sendMessage(chatId, "❌ Error updating welcome message. Please try again.");
            return new Response("OK", { status: 200 });
          }
        }

        // Handle broadcast message
        if (session.awaitingInput === 'broadcast_message') {
          try {
            // Get all bot users
            const { data: users, error } = await supabaseAdmin
              .from('bot_users')
              .select('telegram_id');

            if (error) throw error;

            let successCount = 0;
            let failCount = 0;

            // Send message to all users
            for (const user of users || []) {
              try {
                await sendMessage(parseInt(user.telegram_id), text);
                successCount++;
                // Add small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 100));
              } catch (error) {
                failCount++;
                console.error(`Failed to send broadcast to ${user.telegram_id}:`, error);
              }
            }

            session.awaitingInput = null;
            
            await sendMessage(chatId, `📢 *Broadcast Completed!*

✅ Successfully sent to: ${successCount} users
❌ Failed to send to: ${failCount} users
📊 Total users: ${users?.length || 0}

Your message has been delivered!`);
            
            return new Response("OK", { status: 200 });
          } catch (error) {
            await sendMessage(chatId, "❌ Error sending broadcast message. Please try again.");
            return new Response("OK", { status: 200 });
          }
        }

        // Handle package creation flow
        if (session.awaitingInput === 'add_package_name') {
          session.packageData.name = text;
          session.awaitingInput = 'add_package_price';
          
          await sendMessage(chatId, `📦 Package: "${text}"

Step 2/5: Enter the package price (USD)
Example: 99.99, 149, 299.95

Send the price:`);
          return new Response("OK", { status: 200 });
        }

        if (session.awaitingInput === 'add_package_price') {
          const price = parseFloat(text);
          if (isNaN(price) || price <= 0) {
            await sendMessage(chatId, "❌ Invalid price. Please enter a valid number (e.g., 99.99):");
            return new Response("OK", { status: 200 });
          }
          
          session.packageData.price = price;
          session.awaitingInput = 'add_package_duration';
          
          await sendMessage(chatId, `💰 Price: $${price}

Step 3/5: Enter the package duration in months
Example: 1, 3, 6, 12

Send the duration:`);
          return new Response("OK", { status: 200 });
        }

        if (session.awaitingInput === 'add_package_duration') {
          const duration = parseInt(text);
          if (isNaN(duration) || duration <= 0) {
            await sendMessage(chatId, "❌ Invalid duration. Please enter a valid number of months (e.g., 3):");
            return new Response("OK", { status: 200 });
          }
          
          session.packageData.duration_months = duration;
          session.awaitingInput = 'add_package_features';
          
          await sendMessage(chatId, `⏱ Duration: ${duration} months

Step 4/5: Enter package features (separated by commas)
Example: Premium signals, VIP chat, Daily analysis, Personal mentor

Send the features:`);
          return new Response("OK", { status: 200 });
        }

        if (session.awaitingInput === 'add_package_features') {
          const features = text.split(',').map(f => f.trim()).filter(f => f.length > 0);
          session.packageData.features = features;
          session.awaitingInput = 'add_package_confirm';
          
          const summary = `📋 *Package Summary:*

📦 Name: ${session.packageData.name}
💰 Price: $${session.packageData.price}
⏱ Duration: ${session.packageData.duration_months} months
✨ Features: ${features.join(', ')}

Is this correct? Reply with 'yes' to create or 'no' to cancel:`;
          
          await sendMessage(chatId, summary);
          return new Response("OK", { status: 200 });
        }

        if (session.awaitingInput === 'add_package_confirm') {
          if (text.toLowerCase() === 'yes') {
            try {
              const { data, error } = await supabaseAdmin
                .from('subscription_plans')
                .insert([session.packageData])
                .select('*')
                .single();
              
              if (error) throw error;
              
              session.awaitingInput = null;
              session.packageData = null;
              
              await sendMessage(chatId, `✅ *Package Created Successfully!*

📦 ${data.name} has been added to your VIP packages.
💰 Price: $${data.price}
📋 ID: \`${data.id}\`

Users can now select this package!`);
            } catch (error) {
              await sendMessage(chatId, "❌ Error creating package. Please try again.");
            }
          } else {
            session.awaitingInput = null;
            session.packageData = null;
            await sendMessage(chatId, "❌ Package creation cancelled.");
          }
          return new Response("OK", { status: 200 });
        }

        // Handle promo code creation flow
        if (session.awaitingInput === 'create_promo_code') {
          session.promoData.code = text.toUpperCase();
          session.awaitingInput = 'create_promo_discount_type';
          
          const discountKeyboard = {
            inline_keyboard: [
              [{ text: "💰 Fixed Amount ($)", callback_data: "discount_fixed" }],
              [{ text: "📊 Percentage (%)", callback_data: "discount_percentage" }]
            ]
          };
          
          await sendMessage(chatId, `🎁 Promo Code: "${text.toUpperCase()}"

Step 2/5: Select discount type:`, discountKeyboard);
          return new Response("OK", { status: 200 });
        }

        if (session.awaitingInput === 'create_promo_discount_value') {
          const value = parseFloat(text);
          if (isNaN(value) || value <= 0) {
            await sendMessage(chatId, "❌ Invalid value. Please enter a valid number:");
            return new Response("OK", { status: 200 });
          }
          
          session.promoData.discount_value = value;
          session.awaitingInput = 'create_promo_max_uses';
          
          await sendMessage(chatId, `💰 Discount: ${session.promoData.discount_type === 'percentage' ? value + '%' : '$' + value}

Step 4/5: Enter maximum uses (or 0 for unlimited)
Example: 100, 50, 0

Send the maximum uses:`);
          return new Response("OK", { status: 200 });
        }

        if (session.awaitingInput === 'create_promo_max_uses') {
          const maxUses = parseInt(text);
          if (isNaN(maxUses) || maxUses < 0) {
            await sendMessage(chatId, "❌ Invalid number. Please enter 0 or a positive number:");
            return new Response("OK", { status: 200 });
          }
          
          session.promoData.max_uses = maxUses === 0 ? null : maxUses;
          session.awaitingInput = 'create_promo_expiry';
          
          await sendMessage(chatId, `🔢 Max Uses: ${maxUses === 0 ? 'Unlimited' : maxUses}

Step 5/5: Enter expiry date
Format: YYYY-MM-DD
Example: 2024-12-31

Send the expiry date:`);
          return new Response("OK", { status: 200 });
        }

        if (session.awaitingInput === 'create_promo_expiry') {
          const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
          if (!dateRegex.test(text)) {
            await sendMessage(chatId, "❌ Invalid date format. Please use YYYY-MM-DD (e.g., 2024-12-31):");
            return new Response("OK", { status: 200 });
          }
          
          const expiryDate = new Date(text);
          if (expiryDate <= new Date()) {
            await sendMessage(chatId, "❌ Expiry date must be in the future. Please enter a valid date:");
            return new Response("OK", { status: 200 });
          }
          
          session.promoData.valid_until = expiryDate.toISOString();
          session.awaitingInput = 'create_promo_confirm';
          
          const summary = `📋 *Promo Code Summary:*

🏷 Code: ${session.promoData.code}
💰 Discount: ${session.promoData.discount_type === 'percentage' ? session.promoData.discount_value + '%' : '$' + session.promoData.discount_value}
🔢 Max Uses: ${session.promoData.max_uses || 'Unlimited'}
📅 Expires: ${text}

Is this correct? Reply with 'yes' to create or 'no' to cancel:`;
          
          await sendMessage(chatId, summary);
          return new Response("OK", { status: 200 });
        }

        if (session.awaitingInput === 'create_promo_confirm') {
          if (text.toLowerCase() === 'yes') {
            try {
              const promoData = {
                ...session.promoData,
                description: `${session.promoData.discount_value}${session.promoData.discount_type === 'percentage' ? '%' : '$'} off special offer`,
                valid_from: new Date().toISOString(),
                is_active: true,
                current_uses: 0
              };
              
              const { data, error } = await supabaseAdmin
                .from('promotions')
                .insert([promoData])
                .select('*')
                .single();
              
              if (error) throw error;
              
              session.awaitingInput = null;
              session.promoData = null;
              
              await sendMessage(chatId, `✅ *Promo Code Created Successfully!*

🎁 Code: \`${data.code}\`
💰 Discount: ${data.discount_type === 'percentage' ? data.discount_value + '%' : '$' + data.discount_value}
📅 Valid until: ${new Date(data.valid_until).toLocaleDateString()}
📋 ID: \`${data.id}\`

The promo code is now active and ready to use!`);
            } catch (error) {
              await sendMessage(chatId, "❌ Error creating promo code. Please try again.");
            }
          } else {
            session.awaitingInput = null;
            session.promoData = null;
            await sendMessage(chatId, "❌ Promo code creation cancelled.");
          }
          return new Response("OK", { status: 200 });
        }
      }
    }

    // Handle callback queries (button presses)
    if (update.callback_query) {
      const data = update.callback_query.data;
      
      switch (true) {
        case data === 'view_packages':
          try {
            const packages = await getSubscriptionPlans();
            let packagesMessage = "💎 *VIP Membership Packages*\n\n";
            
            const packageKeyboard = {
              inline_keyboard: []
            };

            if (packages.length > 0) {
              packages.forEach((pkg: any, index: number) => {
                packagesMessage += `${index + 1}. **${pkg.name}**\n`;
                packagesMessage += `   💰 Price: $${pkg.price}/${pkg.duration_months}mo\n`;
                packagesMessage += `   ✨ Features: ${pkg.features ? pkg.features.join(', ') : 'Premium VIP benefits'}\n\n`;
                
                packageKeyboard.inline_keyboard.push([{
                  text: `📦 Select ${pkg.name}`,
                  callback_data: `select_package_${pkg.id}`
                }]);
              });
            }
            
            packageKeyboard.inline_keyboard.push([{ text: "🔙 Back to Menu", callback_data: "back_to_main" }]);
            
            await sendMessage(chatId, packagesMessage, packageKeyboard);
          } catch (error) {
            await sendMessage(chatId, "❌ Unable to load packages. Please try again later.");
          }
          break;

        case data.startsWith('select_package_'):
          const packageId = data.replace('select_package_', '');
          
          try {
            const { data: packageData, error } = await supabase
              .from('subscription_plans')
              .select('*')
              .eq('id', packageId)
              .single();

            if (error || !packageData) {
              await sendMessage(chatId, "❌ Package not found. Please try again.");
              break;
            }

            const paymentMessage = `💳 *Payment for ${packageData.name}*

📦 Package: ${packageData.name}
💰 Price: $${packageData.price}
⏱ Duration: ${packageData.duration_months} month(s)
✨ Features: ${packageData.features ? packageData.features.join(', ') : 'Premium features included'}

Choose your payment method:`;

            const paymentKeyboard = {
              inline_keyboard: [
                [{ text: "💳 Credit/Debit Card", callback_data: `pay_card_${packageId}` }],
                [{ text: "₿ Cryptocurrency", callback_data: `pay_crypto_${packageId}` }],
                [{ text: "🏦 Bank Transfer", callback_data: `pay_bank_${packageId}` }],
                [{ text: "🔙 Back to Packages", callback_data: "view_packages" }]
              ]
            };

            await sendMessage(chatId, paymentMessage, paymentKeyboard);
          } catch (error) {
            await sendMessage(chatId, "❌ Error loading package details. Please try again.");
          }
          break;

        case data.startsWith('pay_bank_'):
          const bankPackageId = data.replace('pay_bank_', '');
          
          try {
            const { data: packageData } = await supabase
              .from('subscription_plans')
              .select('*')
              .eq('id', bankPackageId)
              .single();

            if (!packageData) {
              await sendMessage(chatId, "❌ Package not found. Please try again.");
              break;
            }

            // Create payment record
            const { data: payment, error } = await supabaseAdmin
              .from('payments')
              .insert([{
                user_id: botUser.id, // Use the bot_user UUID
                plan_id: bankPackageId,
                payment_method: 'bank_transfer',
                amount: packageData.price,
                status: 'pending',
                currency: 'USD'
              }])
              .select('*')
              .single();

            if (error) {
              await sendMessage(chatId, "❌ Error creating payment. Please try again.");
              break;
            }

            const bankMessage = `🏦 *Bank Transfer Payment*

📦 Package: ${packageData.name}
💰 Amount: $${packageData.price}
📋 Payment ID: ${payment.id}

**Select Bank Account for Transfer:**

**1. BML (MVR)**
👤 ABDL.M.I.AFLHAL
💳 \`7730000133061\`

**2. MIB (MVR)**  
👤 ABDL.M.I.AFLHAL
💳 \`9010310167224100\`

**3. MIB (USD)**
👤 ABDL.M.I.AFLHAL
💳 \`9013101672242000\`

📋 **Payment Reference:** \`${payment.id}\`

📤 **Next Steps:**
1. Transfer the exact amount to any account above
2. Include the payment reference number
3. Upload your receipt/proof of payment
4. Wait for admin approval (24-48 hours)

Please upload your payment receipt now:`;

            const bankKeyboard = {
              inline_keyboard: [
                [{ text: "📤 Upload Receipt", callback_data: `upload_receipt_${payment.id}` }],
                [{ text: "💬 Contact Support", callback_data: "contact_support" }],
                [{ text: "🔙 Main Menu", callback_data: "back_to_main" }]
              ]
            };

            await sendMessage(chatId, bankMessage, bankKeyboard);
          } catch (error) {
            await sendMessage(chatId, "❌ Error processing payment. Please try again.");
          }
          break;

        case data.startsWith('upload_receipt_'):
          const receiptPaymentId = data.replace('upload_receipt_', '');
          const receiptSession = getUserSession(userId);
          receiptSession.awaitingInput = `upload_receipt_${receiptPaymentId}`;
          
          await sendMessage(chatId, `📤 *Upload Payment Receipt*

Please send your payment receipt as:
• 📷 Photo/Image
• 📄 PDF Document  
• 🗂 Any file format

Make sure the receipt clearly shows:
✅ Transaction amount
✅ Date and time
✅ Reference number: ${receiptPaymentId}

Send your receipt now:`);
          break;

        case data.startsWith('approve_payment_'):
          if (!isAdmin(userId)) {
            await sendMessage(chatId, "❌ Unauthorized access.");
            break;
          }
          
          const approvePaymentId = data.replace('approve_payment_', '');
          const approveSuccess = await handlePaymentDecision(approvePaymentId, 'approve', userId);
          
          if (approveSuccess) {
            await sendMessage(chatId, `✅ Payment ${approvePaymentId} has been approved and user has been granted VIP access.`);
          } else {
            await sendMessage(chatId, `❌ Failed to approve payment ${approvePaymentId}.`);
          }
          break;

        case data.startsWith('reject_payment_'):
          if (!isAdmin(userId)) {
            await sendMessage(chatId, "❌ Unauthorized access.");
            break;
          }
          
          const rejectPaymentId = data.replace('reject_payment_', '');
          const rejectSuccess = await handlePaymentDecision(rejectPaymentId, 'reject', userId);
          
          if (rejectSuccess) {
            await sendMessage(chatId, `❌ Payment ${rejectPaymentId} has been rejected and user has been notified.`);
          } else {
            await sendMessage(chatId, `❌ Failed to reject payment ${rejectPaymentId}.`);
          }
          break;

        case data === 'back_to_main':
          const mainMenuMessage = `🎯 *Dynamic Capital VIP*

Welcome back! Choose what you'd like to do:`;

          const mainKeyboard = {
            inline_keyboard: [
              [
                { text: "💎 Join VIP Community", callback_data: "view_packages" },
                { text: "🎓 Education Hub", callback_data: "view_education" }
              ],
              [
                { text: "📊 Market Analysis", callback_data: "market_overview" },
                { text: "🎯 Trading Signals", callback_data: "trading_signals" }
              ],
              [
                { text: "🎁 Active Promotions", callback_data: "view_promotions" },
                { text: "👤 My Account", callback_data: "user_status" }
              ],
              [
                { text: "ℹ️ About Us", callback_data: "about_us" },
                { text: "💬 Get Support", callback_data: "contact_support" }
              ]
            ]
          };

          await sendMessage(chatId, mainMenuMessage, mainKeyboard);
          break;

        case data === 'contact_support':
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
          break;

        case data === 'view_faq':
          const faqs = await getFAQs();
          let faqMessage = "❓ *Frequently Asked Questions*\n\n";
          
          faqs.forEach((faq, index) => {
            faqMessage += `**${index + 1}. ${faq.question}**\n`;
            faqMessage += `${faq.answer}\n\n`;
          });

          const faqKeyboard = {
            inline_keyboard: [
              [{ text: "💬 Ask Support", callback_data: "contact_support" }],
              [{ text: "🔙 Back to Menu", callback_data: "back_to_main" }]
            ]
          };

          await sendMessage(chatId, faqMessage, faqKeyboard);
          break;

        case data === 'view_promotions':
          try {
            const promotions = await getActivePromotions();
            let promoMessage = "🎁 *Active Promotions*\n\n";
            
            if (promotions.length > 0) {
              promotions.forEach((promo: any) => {
                promoMessage += `🏷 **${promo.description || 'Special Offer'}**\n`;
                promoMessage += `💰 Discount: ${promo.discount_type === 'percentage' ? promo.discount_value + '%' : '$' + promo.discount_value} OFF\n`;
                promoMessage += `🔑 Code: \`${promo.code}\`\n`;
                promoMessage += `📅 Valid until: ${new Date(promo.valid_until).toLocaleDateString()}\n\n`;
              });
              
              promoMessage += "💡 *How to use:*\n";
              promoMessage += "Copy the promo code and mention it when making your payment!\n";
            } else {
              promoMessage += "No active promotions at the moment.\nFollow us for updates on upcoming deals!";
            }

            const promoKeyboard = {
              inline_keyboard: [
                [{ text: "💎 Join VIP Community", callback_data: "view_packages" }],
                [{ text: "🔙 Back to Menu", callback_data: "back_to_main" }]
              ]
            };

            await sendMessage(chatId, promoMessage, promoKeyboard);
          } catch (error) {
            await sendMessage(chatId, "❌ Unable to load promotions. Please try again later.");
          }
          break;

        // Admin Management Commands
        case data === 'admin_welcome':
          if (!isAdmin(userId)) {
            await sendMessage(chatId, "❌ Unauthorized access.");
            break;
          }
          
          const welcomeManageMessage = `💬 *Welcome Message Management*
          
Current welcome message is displayed when users send /start command.

Choose an action:`;

          const welcomeKeyboard = {
            inline_keyboard: [
              [{ text: "📝 Edit Welcome Message", callback_data: "edit_welcome" }],
              [{ text: "👀 Preview Welcome Message", callback_data: "preview_welcome" }],
              [{ text: "🔙 Back to Admin", callback_data: "back_to_admin" }]
            ]
          };

          await sendMessage(chatId, welcomeManageMessage, welcomeKeyboard);
          break;

        case data === 'edit_welcome':
          if (!isAdmin(userId)) {
            await sendMessage(chatId, "❌ Unauthorized access.");
            break;
          }
          
          const session = getUserSession(userId);
          session.awaitingInput = 'edit_welcome_message';
          
          await sendMessage(chatId, `📝 *Edit Welcome Message*

Please send the new welcome message you'd like to use.

You can use:
• **Bold text** for emphasis
• *Italic text* for style
• Emojis 🎯
• Line breaks for formatting

Send your new welcome message now:`);
          break;

        case data === 'preview_welcome':
          if (!isAdmin(userId)) {
            await sendMessage(chatId, "❌ Unauthorized access.");
            break;
          }
          
          const currentWelcome = `🎯 *Welcome to Dynamic Capital VIP!*

👋 Hello ${firstName}! Ready to join our exclusive trading community?

🌟 *What Our VIP Community Offers:*
• 🔥 Premium trading signals & alerts
• 📊 Daily market analysis & insights  
• 🎓 Professional mentorship programs
• 💎 Exclusive VIP chat access
• 📈 Live market outlook sessions
• 🎯 Personalized trading strategies

🆓 *Free Member Benefits:*
• Basic market updates
• Limited community access
• 3 educational resources per month

💎 *Ready to unlock VIP benefits?*
Choose an option below:`;

          await sendMessage(chatId, `📋 *Current Welcome Message Preview:*\n\n${currentWelcome}`);
          break;

        case data === 'admin_packages':
          if (!isAdmin(userId)) {
            await sendMessage(chatId, "❌ Unauthorized access.");
            break;
          }
          
          const packagesMessage = `📦 *Package Management*

Manage VIP subscription packages.

Choose an action:`;

          const packagesKeyboard = {
            inline_keyboard: [
              [{ text: "➕ Add New Package", callback_data: "add_package" }],
              [{ text: "📋 View All Packages", callback_data: "view_all_packages" }],
              [{ text: "✏️ Edit Package", callback_data: "edit_package_list" }],
              [{ text: "🗑 Delete Package", callback_data: "delete_package_list" }],
              [{ text: "🔙 Back to Admin", callback_data: "back_to_admin" }]
            ]
          };

          await sendMessage(chatId, packagesMessage, packagesKeyboard);
          break;

        case data === 'add_package':
          if (!isAdmin(userId)) {
            await sendMessage(chatId, "❌ Unauthorized access.");
            break;
          }
          
          const addSession = getUserSession(userId);
          addSession.awaitingInput = 'add_package_name';
          addSession.packageData = {};
          
          await sendMessage(chatId, `➕ *Add New Package*

Step 1/5: Enter the package name
Example: "Premium VIP", "Gold Membership"

Send the package name:`);
          break;

        case data === 'view_all_packages':
          if (!isAdmin(userId)) {
            await sendMessage(chatId, "❌ Unauthorized access.");
            break;
          }
          
          try {
            const packages = await getSubscriptionPlans();
            let packagesList = "📋 *All Packages*\n\n";
            
            if (packages.length > 0) {
              packages.forEach((pkg: any, index: number) => {
                packagesList += `${index + 1}. **${pkg.name}**\n`;
                packagesList += `   💰 Price: $${pkg.price}\n`;
                packagesList += `   ⏱ Duration: ${pkg.duration_months} months\n`;
                packagesList += `   📋 ID: \`${pkg.id}\`\n\n`;
              });
            } else {
              packagesList += "No packages found.";
            }

            const viewKeyboard = {
              inline_keyboard: [
                [{ text: "🔙 Back to Packages", callback_data: "admin_packages" }]
              ]
            };

            await sendMessage(chatId, packagesList, viewKeyboard);
          } catch (error) {
            await sendMessage(chatId, "❌ Error loading packages.");
          }
          break;

        case data === 'admin_promos':
          if (!isAdmin(userId)) {
            await sendMessage(chatId, "❌ Unauthorized access.");
            break;
          }
          
          const promosMessage = `🎁 *Promo Code Management*

Manage promotional codes and discounts.

Choose an action:`;

          const promosKeyboard = {
            inline_keyboard: [
              [{ text: "➕ Create Promo Code", callback_data: "create_promo" }],
              [{ text: "📋 View All Promos", callback_data: "view_all_promos" }],
              [{ text: "✏️ Edit Promo Code", callback_data: "edit_promo_list" }],
              [{ text: "🗑 Delete Promo Code", callback_data: "delete_promo_list" }],
              [{ text: "🔙 Back to Admin", callback_data: "back_to_admin" }]
            ]
          };

          await sendMessage(chatId, promosMessage, promosKeyboard);
          break;

        case data === 'create_promo':
          if (!isAdmin(userId)) {
            await sendMessage(chatId, "❌ Unauthorized access.");
            break;
          }
          
          const promoSession = getUserSession(userId);
          promoSession.awaitingInput = 'create_promo_code';
          promoSession.promoData = {};
          
          await sendMessage(chatId, `➕ *Create Promo Code*

Step 1/5: Enter the promo code
Example: "SAVE20", "WELCOME50"

Send the promo code:`);
          break;

        case data === 'view_all_promos':
          if (!isAdmin(userId)) {
            await sendMessage(chatId, "❌ Unauthorized access.");
            break;
          }
          
          try {
            const { data: promos } = await supabaseAdmin
              .from('promotions')
              .select('*')
              .order('created_at', { ascending: false });
            
            let promosList = "📋 *All Promo Codes*\n\n";
            
            if (promos && promos.length > 0) {
              promos.forEach((promo: any, index: number) => {
                const status = promo.is_active ? "🟢 Active" : "🔴 Inactive";
                promosList += `${index + 1}. **${promo.code}**\n`;
                promosList += `   💰 Discount: ${promo.discount_type === 'percentage' ? promo.discount_value + '%' : '$' + promo.discount_value}\n`;
                promosList += `   📅 Valid until: ${new Date(promo.valid_until).toLocaleDateString()}\n`;
                promosList += `   📊 Status: ${status}\n`;
                promosList += `   🔢 Uses: ${promo.current_uses}/${promo.max_uses || '∞'}\n`;
                promosList += `   📋 ID: \`${promo.id}\`\n\n`;
              });
            } else {
              promosList += "No promo codes found.";
            }

            const viewPromosKeyboard = {
              inline_keyboard: [
                [{ text: "🔙 Back to Promos", callback_data: "admin_promos" }]
              ]
            };

            await sendMessage(chatId, promosList, viewPromosKeyboard);
          } catch (error) {
            await sendMessage(chatId, "❌ Error loading promo codes.");
          }
          break;

        case data === 'back_to_admin':
          if (!isAdmin(userId)) {
            await sendMessage(chatId, "❌ Unauthorized access.");
            break;
          }
          
          const backAdminMessage = `🔐 *Admin Dashboard*

📊 *Available Commands:*
• 📈 View Statistics  
• 👥 Manage Users
• 💰 Manage Payments
• 📢 Send Broadcast
• 💾 Export Data
• 💬 Manage Welcome Message
• 📦 Manage Packages  
• 🎁 Manage Promo Codes

Choose an admin action:`;

          const backAdminKeyboard = {
            inline_keyboard: [
              [
                { text: "📈 Statistics", callback_data: "admin_stats" },
                { text: "👥 Users", callback_data: "admin_users" }
              ],
              [
                { text: "💰 Payments", callback_data: "admin_payments" },
                { text: "📢 Broadcast", callback_data: "admin_broadcast" }
              ],
              [
                { text: "💬 Welcome Message", callback_data: "admin_welcome" },
                { text: "📦 Packages", callback_data: "admin_packages" }
              ],
              [
                { text: "🎁 Promo Codes", callback_data: "admin_promos" },
                { text: "💾 Export Data", callback_data: "admin_export" }
              ],
              [
                { text: "🔙 Main Menu", callback_data: "back_to_main" }
              ]
            ]
          };

          await sendMessage(chatId, backAdminMessage, backAdminKeyboard);
          break;

        case data === 'discount_fixed':
          if (!isAdmin(userId)) {
            await sendMessage(chatId, "❌ Unauthorized access.");
            break;
          }
          
          const fixedSession = getUserSession(userId);
          fixedSession.promoData.discount_type = 'fixed';
          fixedSession.awaitingInput = 'create_promo_discount_value';
          
          await sendMessage(chatId, `💰 Discount Type: Fixed Amount ($)

Step 3/5: Enter the discount amount in USD
Example: 10, 25, 50

Send the discount amount:`);
          break;

        case data === 'discount_percentage':
          if (!isAdmin(userId)) {
            await sendMessage(chatId, "❌ Unauthorized access.");
            break;
          }
          
          const percentSession = getUserSession(userId);
          percentSession.promoData.discount_type = 'percentage';
          percentSession.awaitingInput = 'create_promo_discount_value';
          
          await sendMessage(chatId, `📊 Discount Type: Percentage (%)

Step 3/5: Enter the discount percentage
Example: 10, 20, 25, 50

Send the discount percentage:`);
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
