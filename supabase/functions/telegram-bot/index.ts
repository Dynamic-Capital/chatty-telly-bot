import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Bot, Context, InlineKeyboard, SessionFlavor } from "https://deno.land/x/grammy@v1.21.1/mod.ts";
import { Menu } from "https://deno.land/x/grammy_menu@v1.2.1/mod.ts";
import { OpenAI } from "https://deno.land/x/openai@v4.20.1/mod.ts";
import { load } from "https://deno.land/std@0.212.0/dotenv/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

await load({ export: true });

// --- TYPES ---
interface SessionData {
  openaiClient: OpenAI | null;
  currentModel: string;
  messageHistory: { role: "user" | "assistant"; content: string }[];
  currentContext: string;
  currentApiKey: string | null;
  isSubscribed: boolean;
  subscriptionExpiry: number | null;
  subscriptionType: "monthly" | "yearly" | null;
  usageCount: number;
  lastMessageTime: number | null;
  isRateLimited: boolean;
  isBinancePaySetupComplete: boolean;
  binancePayOrderId: string | null;
  binancePayCheckoutUrl: string | null;
}

type MyContext = Context & SessionFlavor<SessionData>;

// --- CONSTANTS ---
const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const OPENAI_ORG_ID = Deno.env.get("OPENAI_ORG_ID");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
const BINANCE_API_KEY = Deno.env.get("BINANCE_API_KEY");
const BINANCE_SECRET_KEY = Deno.env.get("BINANCE_SECRET_KEY");
const BINANCE_PAY_BASE_URL = "https://bpay.binanceapi.com";
const BINANCE_PAY_SANDBOX_URL = "https://bpay.binance.com";
const BINANCE_PAY_URL = Deno.env.get("ENVIRONMENT") === "production" ? BINANCE_PAY_BASE_URL : BINANCE_PAY_SANDBOX_URL;
const BINANCE_PAY_MERCHANT_ID = Deno.env.get("BINANCE_PAY_MERCHANT_ID");
const ENVIRONMENT = Deno.env.get("ENVIRONMENT");
const FREE_TIER_MAX_MESSAGES = 5;
const RATE_LIMIT_WINDOW = 60 * 1000; // 60 seconds
const RATE_LIMIT_MAX_REQUESTS = 3;
const MONTHLY_SUB_PRICE = 5;
const YEARLY_SUB_PRICE = 50;
const PAYMENT_CURRENCY = "USD";
const PAYMENT_SUCCESS_URL = "https://ai.lamnhan.com/payment-success";
const PAYMENT_CANCEL_URL = "https://ai.lamnhan.com/payment-cancel";
const DEFAULT_MODEL = "gpt-4o-mini";
const CONTEXT_LIMIT = 4096;
const MAX_MESSAGE_HISTORY = 10;

// Admin user IDs (add your Telegram user ID here)
const ADMIN_USER_IDS = [
  "225513686", // The Wandering Trader (@DynamicCapital_Support)
];

// Media file constraints
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_MEDIA_TYPES = ['photo', 'video', 'document'];
const ALLOWED_FILE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.mp4', '.mov', '.pdf', '.doc', '.docx'];

// CSV export functionality
function generateCSV(data: any[], filename: string): string {
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

async function sendCSVFile(ctx: MyContext, data: any[], filename: string, caption: string) {
  try {
    const csvContent = generateCSV(data, filename);
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const buffer = await blob.arrayBuffer();
    
    await ctx.replyWithDocument({
      source: new Uint8Array(buffer),
      filename: `${filename}_${new Date().toISOString().split('T')[0]}.csv`
    }, {
      caption: `${caption}\n\n📊 Records: ${data.length}\n📅 Generated: ${new Date().toLocaleString()}`
    });
  } catch (error) {
    await ctx.reply(`❌ Error generating CSV: ${getErrorMessage(error)}`);
  }
}
const models = [
  { name: "GPT 3.5 Turbo", value: "gpt-3.5-turbo" },
  { name: "GPT 4", value: "gpt-4" },
  { name: "GPT 4 Turbo", value: "gpt-4-turbo-preview" },
];
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// --- UTILS ---
function logStep(message: string, data: any = {}) {
  console.log(`[${new Date().toISOString()}] ${message}`, data);
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

// --- ADMIN FUNCTIONS ---
function isAdmin(userId: string): boolean {
  return ADMIN_USER_IDS.includes(userId);
}

// --- MEDIA FUNCTIONS ---
async function saveMediaFile(
  filename: string,
  filePath: string,
  fileType: string,
  fileSize: number,
  caption: string | null,
  uploadedBy: string,
  telegramFileId: string
) {
  const { data, error } = await supabase
    .from('media_files')
    .insert({
      filename,
      file_path: filePath,
      file_type: fileType,
      file_size: fileSize,
      caption,
      uploaded_by: uploadedBy,
      telegram_file_id: telegramFileId
    })
    .select()
    .single();

  if (error) {
    console.error('Error saving media file:', error);
    throw error;
  }

  return data;
}

async function getMediaFiles(uploadedBy?: string) {
  let query = supabase
    .from('media_files')
    .select('*')
    .order('created_at', { ascending: false });

  if (uploadedBy) {
    query = query.eq('uploaded_by', uploadedBy);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching media files:', error);
    throw error;
  }

  return data;
}

async function createBroadcastMessage(
  title: string,
  content: string,
  mediaFileId?: string,
  targetAudience = { type: 'all' }
) {
  const { data, error } = await supabase
    .from('broadcast_messages')
    .insert({
      title,
      content,
      media_file_id: mediaFileId,
      target_audience: targetAudience,
      delivery_status: 'draft'
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating broadcast message:', error);
    throw error;
  }

  return data;
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

async function updateBroadcastStats(
  broadcastId: string,
  totalRecipients: number,
  successfulDeliveries: number,
  failedDeliveries: number
) {
  const { error } = await supabase
    .from('broadcast_messages')
    .update({
      total_recipients: totalRecipients,
      successful_deliveries: successfulDeliveries,
      failed_deliveries: failedDeliveries,
      delivery_status: 'completed',
      sent_at: new Date().toISOString()
    })
    .eq('id', broadcastId);

  if (error) {
    console.error('Error updating broadcast stats:', error);
  }
}

async function fetchOrCreateBotUser(telegramId: string, firstName?: string, lastName?: string, username?: string) {
  let { data: user, error } = await supabase
    .from("bot_users")
    .select("*")
    .eq("telegram_id", telegramId)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
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

// Legacy function for backward compatibility
async function updateUsageCount(chatId: number) {
  // This is now handled by tracking in bot_users table
  // Keep for backward compatibility but no actual update needed
  console.log(`Usage tracking for chat ${chatId}`);
}

async function fetchOrCreateUser(chatId: number) {
  // Legacy function - redirect to bot user creation
  return await fetchOrCreateBotUser(chatId.toString());
}

async function saveApiKeyToDatabase(chatId: number, apiKey: string) {
  const { error } = await supabase
    .from("users")
    .update({ openai_api_key: apiKey })
    .eq("chat_id", chatId);

  if (error) {
    console.error("Error saving API key to database:", error);
  }
}

async function getApiKeyFromDatabase(chatId: number): Promise<string | null> {
  const { data, error } = await supabase
    .from("users")
    .select("openai_api_key")
    .eq("chat_id", chatId)
    .single();

  if (error) {
    console.error("Error fetching API key from database:", error);
    return null;
  }

  return data ? data.openai_api_key : null;
}

async function saveSubscriptionDetails(
  chatId: number,
  isSubscribed: boolean,
  subscriptionExpiry: number | null,
  subscriptionType: "monthly" | "yearly" | null,
) {
  const { error } = await supabase
    .from("users")
    .update({
      is_subscribed: isSubscribed,
      subscription_expiry: subscriptionExpiry,
      subscription_type: subscriptionType,
    })
    .eq("chat_id", chatId);

  if (error) {
    console.error("Error saving subscription details:", error);
  }
}

async function checkSubscriptionStatus(chatId: number): Promise<{
  isSubscribed: boolean;
  subscriptionExpiry: number | null;
  subscriptionType: "monthly" | "yearly" | null;
}> {
  const { data, error } = await supabase
    .from("users")
    .select("is_subscribed, subscription_expiry, subscription_type")
    .eq("chat_id", chatId)
    .single();

  if (error) {
    console.error("Error fetching subscription status:", error);
    return {
      isSubscribed: false,
      subscriptionExpiry: null,
      subscriptionType: null,
    };
  }

  if (!data) {
    return {
      isSubscribed: false,
      subscriptionExpiry: null,
      subscriptionType: null,
    };
  }

  return {
    isSubscribed: data.is_subscribed || false,
    subscriptionExpiry: data.subscription_expiry || null,
    subscriptionType: data.subscription_type || null,
  };
}

// --- STRIPE ---
import Stripe from "https://esm.sh/stripe@12.17.0?target=deno";

const stripe = new Stripe(STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

async function createStripeCheckoutSession(
  priceId: string,
  successUrl: string,
  cancelUrl: string,
) {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    return session.url;
  } catch (error) {
    console.error("Error creating Stripe checkout session:", error);
    throw error;
  }
}

// --- BINANCE PAY ---
async function generateBinancePayCheckout(
  amount: number,
  chatId: number,
  subscriptionType: string,
) {
  const apiKey = BINANCE_API_KEY;
  const secretKey = BINANCE_SECRET_KEY;
  const merchantId = BINANCE_PAY_MERCHANT_ID;

  if (!apiKey || !secretKey || !merchantId) {
    throw new Error(
      "Binance Pay API Key, Secret Key, and Merchant ID must be set.",
    );
  }

  const apiUrl = `${BINANCE_PAY_URL}/binancepay/openapi/v2/order`;

  const timestamp = Date.now().toString();
  const prepayId = `Subscription_${subscriptionType}_${chatId}_${timestamp}`;

  const data = {
    merchantId: merchantId,
    prepayId: prepayId,
    tradeType: "WEB",
    orderAmount: amount.toString(),
    currency: PAYMENT_CURRENCY,
    orderTitle: `AI Bot ${subscriptionType} Subscription`,
  };

  const payload = JSON.stringify(data);
  const signature = await generateSignature(payload, secretKey, timestamp);

  const headers = {
    "Content-Type": "application/json",
    "X-MBX-APIKEY": apiKey,
    "X-MBX-TIMESTAMP": timestamp,
    "X-MBX-SIGNATURE": signature,
  };

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: headers,
      body: payload,
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Binance Pay API Error:", error);
      throw new Error(`Binance Pay API Error: ${error}`);
    }

    const result = await response.json();
    console.log("Binance Pay API Response:", result);

    if (result.status === "SUCCESS") {
      return {
        checkoutUrl: result.data.checkoutUrl,
        orderId: result.data.orderId,
      };
    } else {
      throw new Error(
        `Binance Pay API Failed: ${result.returnMessage || "Unknown error"}`,
      );
    }
  } catch (error) {
    console.error("Error calling Binance Pay API:", error);
    throw error;
  }
}

async function generateSignature(
  payload: string,
  secretKey: string,
  timestamp: string,
): Promise<string> {
  const data = timestamp + "\n" + payload + "\n";
  
  // Use Web Crypto API for Deno
  const key = new TextEncoder().encode(secretKey);
  const message = new TextEncoder().encode(data);
  
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, message);
  
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

// --- BOT ---
const bot = new Bot<MyContext>(BOT_TOKEN!);

// Install session middleware
import { session } from "https://deno.land/x/grammy@v1.21.1/mod.ts";

bot.use(session({
  initial: (): SessionData => ({
    openaiClient: null,
    currentModel: DEFAULT_MODEL,
    messageHistory: [],
    currentContext: "You are a helpful AI assistant.",
    currentApiKey: null,
    isSubscribed: false,
    subscriptionExpiry: null,
    subscriptionType: null,
    usageCount: 0,
    lastMessageTime: null,
    isRateLimited: false,
    isBinancePaySetupComplete: false,
    binancePayOrderId: null,
    binancePayCheckoutUrl: null,
  }),
}));

// Middleware to check rate limits
bot.use(async (ctx, next) => {
  const now = Date.now();
  const chatId = ctx.chat?.id;

  if (!chatId) {
    console.warn("Chat ID not found.");
    return await next();
  }

  const user = await fetchOrCreateUser(chatId);

  if (!user) {
    console.error("Failed to fetch or create user.");
    return;
  }

  ctx.session.usageCount = user.usage_count || 0;

  if (ctx.session.isRateLimited) {
    await ctx.reply(
      "Too many requests. Please wait a minute before sending another message.",
    );
    return;
  }

  if (ctx.session.lastMessageTime && now - ctx.session.lastMessageTime < RATE_LIMIT_WINDOW) {
    if (ctx.session.usageCount >= RATE_LIMIT_MAX_REQUESTS) {
      ctx.session.isRateLimited = true;
      await ctx.reply(
        "Too many requests. Please wait a minute before sending another message.",
      );
      return;
    }
  }

  ctx.session.lastMessageTime = now;
  await updateUsageCount(chatId);

  await next();
});

// Command to start the bot
bot.command("start", async (ctx) => {
  const telegramId = ctx.from?.id.toString();
  const firstName = ctx.from?.first_name;
  const lastName = ctx.from?.last_name;
  const username = ctx.from?.username;
  
  logStep("Start command", { telegramId });

  if (!telegramId) {
    await ctx.reply("Error: Unable to identify user.");
    return;
  }

  // Fetch or create bot user
  const user = await fetchOrCreateBotUser(telegramId, firstName, lastName, username);

  if (!user) {
    console.error("Failed to fetch or create bot user.");
    return;
  }

  // Check subscription status from bot_users table
  const isSubscribed = user.subscription_expires_at && new Date(user.subscription_expires_at) > new Date();
  ctx.session.isSubscribed = isSubscribed || false;
  ctx.session.subscriptionExpiry = user.subscription_expires_at ? new Date(user.subscription_expires_at).getTime() : null;

  let message = `Welcome to the AI Chat Bot, ${firstName || 'there'}! 🤖\n\n`;
  message += "I'm here to assist you with any questions you may have.\n\n";

  if (isSubscribed) {
    message += `✅ You have an active subscription until ${new Date(user.subscription_expires_at!).toLocaleDateString()}.\n\n`;
  } else {
    message += "📝 You're using the free tier. Use /subscribe to unlock premium features!\n\n";
  }

  message += "💬 Feel free to ask me anything, or use /help to see available commands.";

  await ctx.reply(message);
});

// Command to display help information
bot.command("help", async (ctx) => {
  logStep("Help command", { chatId: ctx.chat.id });
  const helpMessage = `
Available commands:
/start - Start the bot and display welcome message
/help - Display this help message
/model - Select the model you want to use
/context - Set the context for the AI
/apikey - Set your OpenAI API key
/subscribe - Subscribe to a premium plan
/cancel - Cancel your subscription
/status - Check your subscription status
/reset - Reset the bot (clear history and context)
`;
  await ctx.reply(helpMessage);
});

// Command to set the OpenAI API key
bot.command("apikey", async (ctx) => {
  const apiKey = ctx.message?.text?.split(" ")[1];
  const chatId = ctx.chat.id;

  if (!apiKey) {
    await ctx.reply(
      "Please provide an API key. Usage: /apikey YOUR_API_KEY",
    );
    return;
  }

  try {
    // Initialize OpenAI client with the provided API key
    const openai = new OpenAI({ apiKey: apiKey });

    // Call the OpenAI API to verify the API key
    await openai.models.list();

    // If the API key is valid, save it to the database
    await saveApiKeyToDatabase(chatId, apiKey);
    ctx.session.currentApiKey = apiKey;
    ctx.session.openaiClient = openai;

    await ctx.reply("API key saved successfully!");
  } catch (error) {
    console.error("Error validating API key:", error);
    await ctx.reply(
      "Failed to validate API key. Please make sure it is correct.",
    );
  }
});

// Command to select the model
const modelMenu = new Menu("model-menu").dynamic(async (ctx, range) => {
  for (const model of models) {
    range.text(
      {
        text: model.name,
        payload: model.value,
      },
      async (ctx) => {
        ctx.session.currentModel = model.value;
        await ctx.reply(`Model selected: ${model.name}`);
      },
    );
  }
});

bot.command("model", async (ctx) => {
  logStep("Model command", { chatId: ctx.chat.id });
  await ctx.reply("Select a model:", { reply_markup: modelMenu });
});

bot.use(modelMenu);

// Command to set the context
bot.command("context", async (ctx) => {
  const context = ctx.message?.text?.substring(9); // Remove "/context " prefix
  logStep("Context command", { chatId: ctx.chat.id, context: context });
  if (!context) {
    await ctx.reply(
      "Please provide a context. Usage: /context You are a helpful AI assistant.",
    );
    return;
  }

  ctx.session.currentContext = context;
  await ctx.reply("Context updated successfully!");
});

// Command to subscribe to a premium plan
bot.command("subscribe", async (ctx) => {
  logStep("Subscribe command", { chatId: ctx.chat.id });
  const subscriptionKeyboard = new InlineKeyboard()
    .text("Monthly Subscription ($5/month)", "monthly")
    .row()
    .text("Yearly Subscription ($50/year)", "yearly");

  await ctx.reply(
    "Choose a subscription plan:",
    { reply_markup: subscriptionKeyboard },
  );
});

bot.callbackQuery("monthly", async (ctx) => {
  try {
    const chatId = ctx.chat?.id;
    if (!chatId) {
      console.error("Chat ID not found.");
      return;
    }

    // Generate Binance Pay checkout URL
    const { checkoutUrl, orderId } = await generateBinancePayCheckout(
      MONTHLY_SUB_PRICE,
      chatId,
      "monthly",
    );

    // Save Binance Pay order ID to session
    ctx.session.binancePayOrderId = orderId;
    ctx.session.binancePayCheckoutUrl = checkoutUrl;
    ctx.session.isBinancePaySetupComplete = true;

    // Redirect user to Binance Pay checkout URL
    await ctx.reply(`Please complete your payment using this link: ${checkoutUrl}`);
  } catch (error) {
    console.error("Error during monthly subscription:", error);
    await ctx.reply(
      `An error occurred while setting up your subscription. Please try again later. ${getErrorMessage(error)}`,
    );
  }
});

bot.callbackQuery("yearly", async (ctx) => {
  try {
    const chatId = ctx.chat?.id;
    if (!chatId) {
      console.error("Chat ID not found.");
      return;
    }

    // Generate Binance Pay checkout URL
    const { checkoutUrl, orderId } = await generateBinancePayCheckout(
      YEARLY_SUB_PRICE,
      chatId,
      "yearly",
    );

    // Save Binance Pay order ID to session
    ctx.session.binancePayOrderId = orderId;
    ctx.session.binancePayCheckoutUrl = checkoutUrl;
    ctx.session.isBinancePaySetupComplete = true;

    // Redirect user to Binance Pay checkout URL
    await ctx.reply(`Please complete your payment using this link: ${checkoutUrl}`);
  } catch (error) {
    console.error("Error during yearly subscription:", error);
    await ctx.reply(
      `An error occurred while setting up your subscription. Please try again later. ${getErrorMessage(error)}`,
    );
  }
});

// Command to cancel a subscription
bot.command("cancel", async (ctx) => {
  await ctx.reply(
    "To cancel your subscription, please contact support at support@example.com.",
  );
});

// Command to check subscription status
bot.command("status", async (ctx) => {
  const { isSubscribed, subscriptionExpiry, subscriptionType } =
    await checkSubscriptionStatus(ctx.chat.id);

  if (isSubscribed) {
    await ctx.reply(
      `You are subscribed to the ${subscriptionType} plan. Your subscription expires on ${new Date(
        subscriptionExpiry!,
      ).toLocaleDateString()}.`,
    );
  } else {
    await ctx.reply("You are not currently subscribed to a premium plan.");
  }
});

// Command to reset the bot (clear history and context)
bot.command("reset", async (ctx) => {
  logStep("Reset command", { chatId: ctx.chat.id });
  ctx.session.messageHistory = [];
  ctx.session.currentContext = "You are a helpful AI assistant.";
  await ctx.reply("Bot has been reset. Your message history and context have been cleared.");
});

// --- ADMIN COMMANDS ---

// Admin panel command
bot.command("admin", async (ctx) => {
  const userId = ctx.from?.id.toString();
  if (!userId || !isAdmin(userId)) {
    await ctx.reply("❌ Access denied. This command is for administrators only.");
    return;
  }

  const adminKeyboard = new InlineKeyboard()
    .text("📊 View Stats", "admin_stats")
    .text("📢 Create Broadcast", "admin_broadcast")
    .row()
    .text("🖼️ Media Gallery", "admin_media")
    .text("👥 User Management", "admin_users")
    .row()
    .text("📥 Export Data", "admin_export")
    .text("⚙️ Bot Settings", "admin_settings");

  await ctx.reply("🔧 *Admin Panel*\n\nSelect an option:", {
    reply_markup: adminKeyboard,
    parse_mode: "Markdown"
  });
});

// Media upload handling
bot.on(["message:photo", "message:video", "message:document"], async (ctx) => {
  const userId = ctx.from?.id.toString();
  if (!userId || !isAdmin(userId)) {
    return; // Only admins can upload media
  }

  try {
    let fileId: string | undefined;
    let fileSize: number | undefined;
    let fileName: string;
    let fileType: string;

    if (ctx.message.photo) {
      const photo = ctx.message.photo[ctx.message.photo.length - 1]; // Get highest resolution
      fileId = photo.file_id;
      fileSize = photo.file_size;
      fileName = `photo_${Date.now()}.jpg`;
      fileType = 'photo';
    } else if (ctx.message.video) {
      fileId = ctx.message.video.file_id;
      fileSize = ctx.message.video.file_size;
      fileName = ctx.message.video.file_name || `video_${Date.now()}.mp4`;
      fileType = 'video';
    } else if (ctx.message.document) {
      fileId = ctx.message.document.file_id;
      fileSize = ctx.message.document.file_size;
      fileName = ctx.message.document.file_name || `document_${Date.now()}`;
      fileType = 'document';
    }

    if (!fileId) {
      await ctx.reply("❌ Unable to process this file.");
      return;
    }

    if (fileSize && fileSize > MAX_FILE_SIZE) {
      await ctx.reply("❌ File too large. Maximum size is 50MB.");
      return;
    }

    // Get file info from Telegram
    const file = await bot.api.getFile(fileId);
    if (!file.file_path) {
      await ctx.reply("❌ Unable to get file path.");
      return;
    }

    // Download file from Telegram
    const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;
    const fileResponse = await fetch(fileUrl);
    
    if (!fileResponse.ok) {
      await ctx.reply("❌ Failed to download file.");
      return;
    }

    const fileBuffer = await fileResponse.arrayBuffer();
    
    // Upload to Supabase Storage
    const storagePath = `uploads/${Date.now()}_${fileName}`;
    const { error: uploadError } = await supabase.storage
      .from('bot-media')
      .upload(storagePath, fileBuffer, {
        contentType: fileResponse.headers.get('content-type') || 'application/octet-stream'
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      await ctx.reply("❌ Failed to upload file to storage.");
      return;
    }

    // Save to database
    const caption = ctx.message.caption || null;
    await saveMediaFile(
      fileName,
      storagePath,
      fileType,
      fileSize || 0,
      caption,
      userId,
      fileId
    );

    await ctx.reply("✅ Media uploaded successfully!");

  } catch (error) {
    console.error('Media upload error:', error);
    await ctx.reply("❌ Error uploading media. Please try again.");
  }
});

// Admin callback handlers
bot.callbackQuery("admin_stats", async (ctx) => {
  const userId = ctx.from?.id.toString();
  if (!userId || !isAdmin(userId)) {
    await ctx.answerCallbackQuery("❌ Access denied.");
    return;
  }

  try {
    const users = await getAllBotUsers();
    const mediaFiles = await getMediaFiles();
    
    const statsMessage = `📊 *Bot Statistics*\n\n` +
      `👥 Total Users: ${users.length}\n` +
      `🖼️ Media Files: ${mediaFiles.length}\n` +
      `📅 Last Updated: ${new Date().toLocaleString()}`;

    await ctx.editMessageText(statsMessage, { parse_mode: "Markdown" });
  } catch (error) {
    console.error('Error fetching stats:', error);
    await ctx.answerCallbackQuery("❌ Error fetching statistics.");
  }
});

bot.callbackQuery("admin_broadcast", async (ctx) => {
  const userId = ctx.from?.id.toString();
  if (!userId || !isAdmin(userId)) {
    await ctx.answerCallbackQuery("❌ Access denied.");
    return;
  }

  await ctx.editMessageText(
    "📢 *Create Broadcast Message*\n\n" +
    "To create a broadcast:\n" +
    "1. Upload media (optional)\n" +
    "2. Use /broadcast <message> to send\n\n" +
    "Example: `/broadcast Hello everyone! This is a test message.`",
    { parse_mode: "Markdown" }
  );
});

bot.callbackQuery("admin_media", async (ctx) => {
  const userId = ctx.from?.id.toString();
  if (!userId || !isAdmin(userId)) {
    await ctx.answerCallbackQuery("❌ Access denied.");
    return;
  }

  try {
    const mediaFiles = await getMediaFiles();
    
    if (mediaFiles.length === 0) {
      await ctx.editMessageText("🖼️ *Media Gallery*\n\nNo media files uploaded yet.");
      return;
    }

    let mediaList = "🖼️ *Media Gallery*\n\n";
    mediaFiles.slice(0, 10).forEach((file, index) => {
      mediaList += `${index + 1}. ${file.filename} (${file.file_type})\n`;
      if (file.caption) mediaList += `   Caption: ${file.caption}\n`;
      mediaList += `   Uploaded: ${new Date(file.created_at).toLocaleDateString()}\n\n`;
    });

    if (mediaFiles.length > 10) {
      mediaList += `... and ${mediaFiles.length - 10} more files`;
    }

    await ctx.editMessageText(mediaList, { parse_mode: "Markdown" });
  } catch (error) {
    console.error('Error fetching media:', error);
    await ctx.answerCallbackQuery("❌ Error fetching media files.");
  }
});

bot.callbackQuery("admin_export", async (ctx) => {
  const userId = ctx.from?.id.toString();
  if (!userId || !isAdmin(userId)) {
    await ctx.answerCallbackQuery("❌ Access denied.");
    return;
  }

  const exportKeyboard = new InlineKeyboard()
    .text("👥 Export Users", "export_users")
    .text("💳 Export Payments", "export_payments")
    .row()
    .text("📊 Export Subscriptions", "export_subscriptions")
    .text("🎯 Export Promo Analytics", "export_promos")
    .row()
    .text("🔙 Back to Admin", "back_to_admin");

  await ctx.editMessageText(
    "📥 *Export Data*\n\n" +
    "Select what data you want to export as CSV:",
    { 
      reply_markup: exportKeyboard,
      parse_mode: "Markdown" 
    }
  );
});

// Export handlers
bot.callbackQuery("export_users", async (ctx) => {
  const userId = ctx.from?.id.toString();
  if (!userId || !isAdmin(userId)) {
    await ctx.answerCallbackQuery("❌ Access denied.");
    return;
  }

  await ctx.answerCallbackQuery("🔄 Exporting users data...");
  
  try {
    const data = await exportUsersData();
    await sendCSVFile(ctx, data, "bot_users", "👥 Bot Users Export");
  } catch (error) {
    console.error('Export users error:', error);
    await ctx.reply("❌ Error exporting users data. Please try again.");
  }
});

bot.callbackQuery("export_payments", async (ctx) => {
  const userId = ctx.from?.id.toString();
  if (!userId || !isAdmin(userId)) {
    await ctx.answerCallbackQuery("❌ Access denied.");
    return;
  }

  await ctx.answerCallbackQuery("🔄 Exporting payments data...");
  
  try {
    const data = await exportPaymentsData();
    await sendCSVFile(ctx, data, "payments", "💳 Payments Export");
  } catch (error) {
    console.error('Export payments error:', error);
    await ctx.reply("❌ Error exporting payments data. Please try again.");
  }
});

bot.callbackQuery("export_subscriptions", async (ctx) => {
  const userId = ctx.from?.id.toString();
  if (!userId || !isAdmin(userId)) {
    await ctx.answerCallbackQuery("❌ Access denied.");
    return;
  }

  await ctx.answerCallbackQuery("🔄 Exporting subscriptions data...");
  
  try {
    const data = await exportSubscriptionsData();
    await sendCSVFile(ctx, data, "user_subscriptions", "📊 Subscriptions Export");
  } catch (error) {
    console.error('Export subscriptions error:', error);
    await ctx.reply("❌ Error exporting subscriptions data. Please try again.");
  }
});

bot.callbackQuery("export_promos", async (ctx) => {
  const userId = ctx.from?.id.toString();
  if (!userId || !isAdmin(userId)) {
    await ctx.answerCallbackQuery("❌ Access denied.");
    return;
  }

  await ctx.answerCallbackQuery("🔄 Exporting promo analytics...");
  
  try {
    const data = await exportPromoAnalytics();
    await sendCSVFile(ctx, data, "promo_analytics", "🎯 Promo Analytics Export");
  } catch (error) {
    console.error('Export promos error:', error);
    await ctx.reply("❌ Error exporting promo analytics. Please try again.");
  }
});

bot.callbackQuery("back_to_admin", async (ctx) => {
  const userId = ctx.from?.id.toString();
  if (!userId || !isAdmin(userId)) {
    await ctx.answerCallbackQuery("❌ Access denied.");
    return;
  }

  const adminKeyboard = new InlineKeyboard()
    .text("📊 View Stats", "admin_stats")
    .text("📢 Create Broadcast", "admin_broadcast")
    .row()
    .text("🖼️ Media Gallery", "admin_media")
    .text("👥 User Management", "admin_users")
    .row()
    .text("📥 Export Data", "admin_export")
    .text("⚙️ Bot Settings", "admin_settings");

  await ctx.editMessageText("🔧 *Admin Panel*\n\nSelect an option:", {
    reply_markup: adminKeyboard,
    parse_mode: "Markdown"
  });
});

// Broadcast command
bot.command("broadcast", async (ctx) => {
  const userId = ctx.from?.id.toString();
  if (!userId || !isAdmin(userId)) {
    await ctx.reply("❌ Access denied. This command is for administrators only.");
    return;
  }

  const message = ctx.message?.text?.substring(11); // Remove "/broadcast " prefix
  if (!message) {
    await ctx.reply("❌ Please provide a message to broadcast.\nUsage: /broadcast <message>");
    return;
  }

  try {
    await ctx.reply("🚀 Starting broadcast...");
    
    const users = await getAllBotUsers();
    let successCount = 0;
    let failCount = 0;

    // Create broadcast record
    const broadcast = await createBroadcastMessage(
      `Broadcast ${new Date().toLocaleDateString()}`,
      message
    );

    // Send to all users in batches to avoid rate limits
    const batchSize = 30; // Telegram rate limit is 30 messages per second
    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize);
      
      const promises = batch.map(async (user) => {
        try {
          await bot.api.sendMessage(user.telegram_id, message);
          successCount++;
        } catch (error) {
          console.error(`Failed to send to ${user.telegram_id}:`, error);
          failCount++;
        }
      });

      await Promise.all(promises);
      
      // Wait 1 second between batches to respect rate limits
      if (i + batchSize < users.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Update broadcast statistics
    await updateBroadcastStats(broadcast.id, users.length, successCount, failCount);

    await ctx.reply(
      `✅ Broadcast completed!\n\n` +
      `📊 Statistics:\n` +
      `✅ Successful: ${successCount}\n` +
      `❌ Failed: ${failCount}\n` +
      `📍 Total: ${users.length}`
    );

  } catch (error) {
    console.error('Broadcast error:', error);
    await ctx.reply("❌ Error during broadcast. Please try again.");
  }
});

// Handle text messages
bot.on("message:text", async (ctx) => {
  try {
    const chatId = ctx.chat.id;
    const message = ctx.message.text;
    logStep("Message received", { chatId: chatId, message: message });

    // Check if the user is rate-limited
    if (ctx.session.isRateLimited) {
      await ctx.reply(
        "Too many requests. Please wait a minute before sending another message.",
      );
      return;
    }

    // Check subscription status
    if (!ctx.session.isSubscribed) {
      if (ctx.session.usageCount > FREE_TIER_MAX_MESSAGES) {
        await ctx.reply(
          "You have reached the maximum number of free messages. Subscribe to a premium plan to continue using the bot.",
        );
        return;
      }
    }

    // Initialize OpenAI client
    let openai = ctx.session.openaiClient;
    if (!openai) {
      const apiKey = ctx.session.currentApiKey || await getApiKeyFromDatabase(chatId) || OPENAI_API_KEY;
      if (!apiKey) {
        await ctx.reply(
          "Please set an API key using the /apikey command. You can get one at https://platform.openai.com/api-keys.",
        );
        return;
      }
      openai = new OpenAI({ apiKey: apiKey, organization: OPENAI_ORG_ID });
      ctx.session.openaiClient = openai;
      ctx.session.currentApiKey = apiKey;
    }

    // Add user message to message history
    ctx.session.messageHistory.push({ role: "user", content: message });

    // Trim message history to the maximum number of messages
    if (ctx.session.messageHistory.length > MAX_MESSAGE_HISTORY) {
      ctx.session.messageHistory = ctx.session.messageHistory.slice(
        ctx.session.messageHistory.length - MAX_MESSAGE_HISTORY,
      );
    }

    // Prepare messages for OpenAI API
    const messages = [
      { role: "system", content: ctx.session.currentContext },
      ...ctx.session.messageHistory,
    ];

    // Call OpenAI API
    logStep("Calling OpenAI API", {
      model: ctx.session.currentModel,
      messages: messages,
    });
    const completion = await openai.chat.completions.create({
      model: ctx.session.currentModel,
      messages: messages,
      // max_tokens: 200,
    });

    // Get AI response
    const aiResponse = completion.choices[0].message?.content;

    if (!aiResponse) {
      throw new Error("No response from OpenAI API");
    }

    // Add AI response to message history
    ctx.session.messageHistory.push({ role: "assistant", content: aiResponse });

    // Send AI response to user
    logStep("Sending AI response", { chatId: chatId, response: aiResponse });
    await ctx.reply(aiResponse);
  } catch (error) {
    console.error("Error processing message:", error);
    await ctx.reply(
      `An error occurred while processing your message. Please try again later. ${getErrorMessage(error)}`,
    );
  }
});

async function sendMessage(
  botToken: string,
  chatId: number,
  message: string,
  keyboard?: InlineKeyboard,
) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const payload = {
    chat_id: chatId,
    text: message,
    reply_markup: keyboard,
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(
      `Failed to send message to chat ID ${chatId}. Status: ${response.status}, Body: ${errorBody}`,
    );
    throw new Error(
      `Failed to send message. Status: ${response.status}, Body: ${errorBody}`,
    );
  }

  const result = await response.json();
  console.log(`Message sent successfully to chat ID ${chatId}.`, result);
}

// Set the webhook
if (Deno.env.get("SUPABASE_ANON_KEY")) {
  const webhook_url = `https://qeejuomcapbdlhnjqjcc.supabase.co/functions/v1/telegram-bot`;
  await bot.api.setWebhook(webhook_url);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders,
    });
  }

  try {
    const url = new URL(req.url);
    if (url.searchParams.get("reset-bot") === "true") {
      const resetBotUrl =
        `https://qeejuomcapbdlhnjqjcc.supabase.co/functions/v1/reset-bot`;
      const resetResponse = await fetch(resetBotUrl);
      const resetResult = await resetResponse.json();
      return new Response(JSON.stringify(resetResult), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: resetResponse.status,
      });
    }

    if (url.pathname === "/payment-webhook") {
      const body = await req.text();
      const signature = req.headers.get("stripe-signature");

      if (!signature) {
        console.error("Stripe signature missing");
        return new Response("Stripe signature missing", { status: 400 });
      }

      try {
        const event = stripe.webhooks.constructEvent(
          body,
          signature,
          Deno.env.get("STRIPE_WEBHOOK_SECRET")!,
        );

        if (event.type === "checkout.session.completed") {
          const session = event.data.object as Stripe.Checkout.Session;
          const customerId = session.customer;
          const subscriptionId = session.subscription;

          if (!customerId || !subscriptionId) {
            console.error(
              "Customer ID or subscription ID missing in checkout session",
            );
            return new Response(
              "Customer ID or subscription ID missing in checkout session",
              { status: 400 },
            );
          }

          // Fetch subscription details from Stripe
          const subscription = await stripe.subscriptions.retrieve(
            subscriptionId.toString(),
          );

          const subscriptionExpiry = subscription.current_period_end * 1000; // Convert to milliseconds
          const priceId = subscription.items.data[0].price.id;

          let subscriptionType: "monthly" | "yearly" | null = null;
          if (priceId === Deno.env.get("STRIPE_MONTHLY_PRICE_ID")) {
            subscriptionType = "monthly";
          } else if (priceId === Deno.env.get("STRIPE_YEARLY_PRICE_ID")) {
            subscriptionType = "yearly";
          }

          // Fetch customer details to get the metadata
          const customer = await stripe.customers.retrieve(customerId.toString());
          const chatId = (customer as any)?.metadata?.chatId;

          if (!chatId) {
            console.error("Chat ID missing in customer metadata");
            return new Response("Chat ID missing in customer metadata", {
              status: 400,
            });
          }

          // Save subscription details to Supabase
          await saveSubscriptionDetails(
            parseInt(chatId),
            true,
            subscriptionExpiry,
            subscriptionType,
          );

          // Send confirmation message to the user
          const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
          if (!botToken) {
            throw new Error("TELEGRAM_BOT_TOKEN is not set");
          }

          const message =
            `Congratulations! You have successfully subscribed to the ${subscriptionType} plan. Your subscription will expire on ${new Date(subscriptionExpiry).toLocaleDateString()}.`;
          await sendMessage(botToken, parseInt(chatId), message);
        }

        return new Response("Webhook received", { status: 200 });
      } catch (err: any) {
        console.error(`Webhook Error: ${err.message}`);
        return new Response(`Webhook Error: ${err.message}`, { status: 400 });
      }
    }

    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!botToken) {
      throw new Error("TELEGRAM_BOT_TOKEN is not set");
    }

    try {
      const update = await req.json();
      await bot.handleUpdate(update);
    } catch (err) {
      console.error(err);
    }

    await sendMessage(botToken, 631412343, "OK");
    // Return OK response
    return new Response("OK", { status: 200 });
  } catch (error) {
    logStep("ERROR in telegram-bot", {
      message: error instanceof Error ? error.message : String(error),
    });
    return new Response("Internal Server Error", { status: 500 });
  }
});
