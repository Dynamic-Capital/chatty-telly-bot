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
    await sendMessage(chatId, "🚫 You've reached your hourly limit of 10 free messages!\\n\\n💎 Upgrade to Premium for unlimited AI conversations!", upgradeKeyboard);
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
        finalMessage += `\\n\\n💬 _${remainingMessages} free messages remaining this hour_`;
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

async function fetchOrCreateBotUser(userId: string, firstName: string, lastName?: string, username?: string) {
  try {
    // First, try to fetch existing user
    const { data: existingUser, error: fetchError } = await supabaseAdmin
      .from('bot_users')
      .select('*')
      .eq('telegram_user_id', userId)
      .single();

    if (existingUser) {
      // Update user info if needed
      const { data: updatedUser, error: updateError } = await supabaseAdmin
        .from('bot_users')
        .update({
          first_name: firstName,
          last_name: lastName,
          username: username,
          last_active: new Date().toISOString()
        })
        .eq('telegram_user_id', userId)
        .select('*')
        .single();

      return updatedUser || existingUser;
    }

    // Create new user
    const { data: newUser, error: createError } = await supabaseAdmin
      .from('bot_users')
      .insert([{
        telegram_user_id: userId,
        first_name: firstName,
        last_name: lastName,
        username: username,
        subscription_status: 'free',
        last_active: new Date().toISOString()
      }])
      .select('*')
      .single();

    if (createError) {
      console.error('Error creating user:', createError);
      return null;
    }

    return newUser;
  } catch (error) {
    console.error('Error in fetchOrCreateBotUser:', error);
    return null;
  }
}

async function getSubscriptionPlans() {
  try {
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('price', { ascending: true });

    if (error) {
      console.error('Error fetching subscription plans:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getSubscriptionPlans:', error);
    return [];
  }
}

async function getTopCryptos() {
  try {
    if (!BINANCE_API_KEY) {
      console.log('Binance API key not configured');
      return [];
    }

    const response = await fetch('https://api.binance.com/api/v3/ticker/24hr');
    const data = await response.json();
    
    // Filter for USDT pairs and get top 10 by volume
    const usdtPairs = data
      .filter((ticker: any) => ticker.symbol.endsWith('USDT'))
      .sort((a: any, b: any) => parseFloat(b.volume) - parseFloat(a.volume))
      .slice(0, 10);

    return usdtPairs;
  } catch (error) {
    console.error('Error fetching crypto data:', error);
    return [];
  }
}

async function trackDailyAnalytics() {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Check if analytics for today already exist
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('daily_analytics')
      .select('*')
      .eq('date', today)
      .single();

    if (existing) {
      // Update existing record
      const { error: updateError } = await supabaseAdmin
        .from('daily_analytics')
        .update({
          total_users: existing.total_users + 1,
          active_users: existing.active_users + 1
        })
        .eq('date', today);

      if (updateError) {
        console.error('Error updating daily analytics:', updateError);
      }
    } else {
      // Create new record
      const { error: insertError } = await supabaseAdmin
        .from('daily_analytics')
        .insert([{
          date: today,
          total_users: 1,
          active_users: 1,
          new_registrations: 1
        }]);

      if (insertError) {
        console.error('Error inserting daily analytics:', insertError);
      }
    }
  } catch (error) {
    console.error('Error in trackDailyAnalytics:', error);
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
      
      // Admin commands
      if (isAdmin(userId)) {
        if (text === '/admin') {
          const adminKeyboard = {
            inline_keyboard: [
              [
                { text: "📊 Dashboard Stats", callback_data: "admin_stats" },
                { text: "👥 User Management", callback_data: "admin_users" }
              ],
              [
                { text: "📢 Broadcast Message", callback_data: "admin_broadcast" },
                { text: "💳 Payments", callback_data: "admin_payments" }
              ],
              [
                { text: "📥 Export Data", callback_data: "admin_export" },
                { text: "🔧 Bot Settings", callback_data: "admin_settings" }
              ]
            ]
          };
          
          await sendMessage(chatId, "🛠 *Admin Dashboard*\\n\\nSelect an option:", adminKeyboard);
          return new Response("OK", { status: 200 });
        }
      }

      // Handle regular text messages for AI chat
      const session = getUserSession(userId);
      if (session.awaitingInput) {
        // Handle pending input
        if (session.awaitingInput === 'broadcast_message') {
          pendingBroadcasts.set(userId, text);
          session.awaitingInput = null;
          
          const confirmKeyboard = {
            inline_keyboard: [
              [
                { text: "✅ Send to All", callback_data: "confirm_broadcast_all" },
                { text: "👑 Send to VIP Only", callback_data: "confirm_broadcast_vip" }
              ],
              [{ text: "❌ Cancel", callback_data: "cancel_broadcast" }]
            ]
          };
          
          await sendMessage(chatId, `📢 *Broadcast Preview*\\n\\n${text}\\n\\nSelect audience:`, confirmKeyboard);
          return new Response("OK", { status: 200 });
        }
      }

      if (text === '/start') {
        const welcomeMessage = `🤖 *Welcome to AI Trading Assistant!*\n\n👋 Hello ${firstName}! Welcome to our community!\n\n🎉 You've just joined thousands of successful traders!\n\n✨ *What you get access to:*\n• 🤖 AI-powered trading advice\n• 📈 Real-time market analysis\n• 🎓 Professional trading education\n• 💎 Exclusive VIP features\n• 🎯 Personalized trading strategies\n\n🆓 *Free Trial User*\n📊 10 AI messages per hour\n💎 Upgrade to unlock unlimited features!\n\n🚀 Ready to start your trading journey?\nChoose an option below to get started:`;

        const keyboard = {
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

        await sendMessage(chatId, welcomeMessage, keyboard);
        
        // Track daily analytics
        await trackDailyAnalytics();
        
        return new Response("OK", { status: 200 });
      } 
      else if (text?.startsWith('/')) {
        // Handle other bot commands
        await sendMessage(chatId, "Use the menu buttons to navigate 👇");
        return new Response("OK", { status: 200 });
      }
      else {
        // Handle AI chat for regular messages
        await handleAIChat(chatId, text, userId);
        return new Response("OK", { status: 200 });
      }
    }

    // Handle callback queries (button presses)
    if (update.callback_query) {
      const data = update.callback_query.data;
      
      switch (true) {
        case data === 'back_to_main':
          // Return to main menu
          const mainMenuMessage = `🤖 *AI Trading Assistant*\n\nWelcome back! Choose what you'd like to do:`;

          const mainKeyboard = {
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

          await sendMessage(chatId, mainMenuMessage, mainKeyboard);
          break;

        case data === 'start_chat':
          const chatMessage = `💬 *AI Trading Chat*\n\n🤖 I'm your AI trading assistant! Ask me anything about:\n\n📈 Market analysis and trends\n💡 Trading strategies and tips\n📊 Specific cryptocurrency insights\n🎓 Trading education and concepts\n💰 Risk management advice\n\n*Just type your question below and I'll help you!*\n\n💡 _Tip: Be specific for better answers_`;

          const chatKeyboard = {
            inline_keyboard: [
              [
                { text: "📈 Market Overview", callback_data: "market_overview" },
                { text: "💡 Trading Tips", callback_data: "trading_tips" }
              ],
              [
                { text: "🔄 New Topic", callback_data: "new_chat" },
                { text: "🔙 Main Menu", callback_data: "back_to_main" }
              ]
            ]
          };

          await sendMessage(chatId, chatMessage, chatKeyboard);
          break;

        case data === 'new_chat':
          // Clear chat history
          const session = getUserSession(userId);
          session.messageHistory = [];
          
          await sendMessage(chatId, "🔄 *New Chat Started*\\n\\nYour conversation history has been cleared. What would you like to discuss?");
          break;

        case data === 'market_overview':
          try {
            const cryptos = await getTopCryptos();
            let marketMessage = "📈 *Market Overview*\\n\\n";
            
            if (cryptos.length > 0) {
              cryptos.forEach(crypto => {
                const symbol = crypto.symbol.replace('USDT', '');
                const price = parseFloat(crypto.lastPrice).toFixed(2);
                const change = parseFloat(crypto.priceChangePercent).toFixed(2);
                const emoji = change >= 0 ? '🟢' : '🔴';
                
                marketMessage += `${emoji} *${symbol}*: $${price} (${change}%)\\n`;
              });
            } else {
              marketMessage += "Market data temporarily unavailable.";
            }
            
            const marketKeyboard = {
              inline_keyboard: [
                [
                  { text: "🔄 Refresh", callback_data: "market_overview" },
                  { text: "💬 Ask AI", callback_data: "start_chat" }
                ],
                [{ text: "🔙 Main Menu", callback_data: "back_to_main" }]
              ]
            };
            
            await sendMessage(chatId, marketMessage, marketKeyboard);
          } catch (error) {
            await sendMessage(chatId, "❌ Unable to fetch market data. Please try again later.");
          }
          break;

        case data === 'trading_tips':
          const tipsMessage = `💡 *Quick Trading Tips*\n\n🎯 **Risk Management**\n• Never risk more than 2-3% per trade\n• Always set stop losses\n• Diversify your portfolio\n\n📊 **Technical Analysis**\n• Learn to read candlestick patterns\n• Use multiple timeframes\n• Don't rely on one indicator\n\n🧠 **Psychology**\n• Control your emotions\n• Stick to your strategy\n• Keep a trading journal\n\n💰 **Money Management**\n• Start small and scale up\n• Take profits systematically\n• Don't chase losses\n\nWant personalized advice? Chat with our AI!`;

          const tipsKeyboard = {
            inline_keyboard: [
              [
                { text: "💬 Ask AI for Details", callback_data: "start_chat" },
                { text: "📈 Market Analysis", callback_data: "market_overview" }
              ],
              [{ text: "🔙 Main Menu", callback_data: "back_to_main" }]
            ]
          };

          await sendMessage(chatId, tipsMessage, tipsKeyboard);
          break;

        case data === 'view_packages':
          try {
            const packages = await getSubscriptionPlans();
            let packagesMessage = "📦 *Available Packages*\\n\\n";
            
            const packageKeyboard = {
              inline_keyboard: []
            };

            if (packages.length > 0) {
              packages.forEach((pkg: any, index: number) => {
                packagesMessage += `${index + 1}. ${pkg.name}\\n`;
                packagesMessage += `   💰 Price: $${pkg.price}/${pkg.duration_months}mo\\n`;
                packagesMessage += `   ✨ Features: ${pkg.features || 'Priority signals, VIP chat access, Daily market analysis'}\\n\\n`;
                
                packageKeyboard.inline_keyboard.push([{
                  text: `📦 Select ${pkg.name}`,
                  callback_data: `select_package_${pkg.id}`
                }]);
              });
            } else {
              packagesMessage += "No packages available at the moment.";
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

            const paymentMessage = `💳 *Payment for ${packageData.name}*\n\n📦 Package: ${packageData.name}\n💰 Price: $${packageData.price}\n⏱ Duration: ${packageData.duration_months} month(s)\n✨ Features: ${packageData.features || 'Premium features included'}\n\nChoose your payment method:`;

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

        case data.startsWith('pay_'):
          const paymentParts = data.split('_');
          const paymentMethod = paymentParts[1];
          const selectedPackageId = paymentParts[2];

          try {
            // Create payment record
            const { data: payment, error } = await supabaseAdmin
              .from('payments')
              .insert([{
                telegram_user_id: userId,
                subscription_plan_id: selectedPackageId,
                payment_method: paymentMethod,
                status: 'pending'
              }])
              .select('*')
              .single();

            if (error) {
              await sendMessage(chatId, "❌ Error creating payment. Please try again.");
              break;
            }

            const processingMessage = `⏳ *Payment Processing*\n\n📋 Payment ID: ${payment.id}\n💳 Method: ${paymentMethod.toUpperCase()}\n💰 Status: Pending\n\nPlease wait while we generate your payment details...`;

            await sendMessage(chatId, processingMessage);

            // Here you would integrate with actual payment processors
            // For now, we'll simulate the payment flow

            const paymentDetailsMessage = `💳 *Payment Details*\n\n📋 Order ID: ${payment.id}\n💰 Amount: $${payment.amount || '49.00'}\n💳 Method: ${paymentMethod.toUpperCase()}\n\n${paymentMethod === 'bank' ? 
              '🏦 **Bank Transfer Details:**\\nAccount: 1234567890\\nRouting: 987654321\\nMemo: ' + payment.id :
              paymentMethod === 'crypto' ?
              '₿ **Cryptocurrency Payment:**\\nBTC Address: bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh\\nAmount: 0.0012 BTC\\nMemo: ' + payment.id :
              '💳 **Card Payment:**\\nRedirecting to secure payment portal...'
            }\n\n⚠️ **Important:**\n• Include Payment ID: ${payment.id}\n• Payment expires in 30 minutes\n• Contact support if needed\n\nCheck payment status anytime:`;

            const statusKeyboard = {
              inline_keyboard: [
                [{ text: "🔍 Check Payment Status", callback_data: `check_payment_${payment.id}` }],
                [
                  { text: "💬 Contact Support", callback_data: "contact_support" },
                  { text: "🔙 Main Menu", callback_data: "back_to_main" }
                ]
              ]
            };

            await sendMessage(chatId, paymentDetailsMessage, statusKeyboard);
          } catch (error) {
            await sendMessage(chatId, "❌ Error processing payment. Please try again.");
          }
          break;

        case data.startsWith('check_payment_'):
          const paymentId = data.replace('check_payment_', '');
          
          try {
            const { data: payment, error } = await supabaseAdmin
              .from('payments')
              .select('*')
              .eq('id', paymentId)
              .single();

            if (error || !payment) {
              await sendMessage(chatId, "❌ Payment not found. Please check your Payment ID.");
              break;
            }

            let statusMessage = `🔍 *Payment Status*\\n\\n`;
            statusMessage += `📋 Payment ID: ${payment.id}\\n`;
            statusMessage += `💰 Amount: $${payment.amount}\\n`;
            statusMessage += `📅 Created: ${new Date(payment.created_at).toLocaleDateString()}\\n\\n`;

            if (payment.status === 'completed') {
              statusMessage += `✅ Status: **PAID** ✅\\n`;
              statusMessage += `🎉 Your subscription is now active!\\n`;
              statusMessage += `Thank you for choosing our service!`;
            } else if (payment.status === 'pending') {
              statusMessage += `⏳ Status: **PENDING**\\n`;
              statusMessage += `Waiting for payment confirmation...\\n`;
              statusMessage += `This usually takes 5-15 minutes.`;
            } else {
              statusMessage += `❌ Status: **${payment.status.toUpperCase()}**\\n`;
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
          break;

        case data === 'contact_support':
          const supportMessage = "💬 *Contact Support*\\n\\n" +
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
