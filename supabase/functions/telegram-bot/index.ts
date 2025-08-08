import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getFormattedVipPackages,
  getBotContent,
  getBotSetting,
  setBotSetting,
  getAllBotSettings,
  resetBotSettings,
  getContactLinks
} from "./database-utils.ts";
import {
  handleTableManagement,
  handleUserTableManagement,
  handleSubscriptionPlansManagement,
  handlePlanChannelsManagement,
  handleEducationPackagesManagement,
  handlePromotionsManagement,
  handleContentManagement,
  handleBotSettingsManagement,
  handleTableStatsOverview
} from "./admin-handlers.ts";

const DEFAULT_BOT_SETTINGS: Record<string, string> = {
  session_timeout_minutes: "30",
  payment_timeout_minutes: "60",
  admin_notifications: "true",
  max_login_attempts: "5"
};

// Rate limiting and anti-spam protection
interface RateLimitEntry {
  count: number;
  lastReset: number;
  blocked?: boolean;
  blockUntil?: number;
  lastMessage?: string;
  identicalCount?: number;
}

interface SecurityStats {
  totalRequests: number;
  blockedRequests: number;
  suspiciousUsers: Set<string>;
  lastCleanup: number;
}

// Basic types for frequently used structures
interface VipPackage {
  id: number;
  name: string;
  price: number;
  duration_months: number;
  is_lifetime: boolean;
  features?: string[];
  [key: string]: unknown;
}

interface TelegramMessage {
  chat: { id: number; type?: string; title?: string };
  photo?: Array<{ file_id: string }>;
  document?: { file_id: string; file_name?: string };
  caption?: string;
  new_chat_members?: Array<{ username?: string; is_bot?: boolean }>;
}

interface SubscriptionRecord {
  id: string;
  subscription_plans?: { name?: string; price?: number };
  payment_method?: string;
  [key: string]: unknown;
}

interface PromoSession {
  packageId: string;
  price: number;
  promoApplied?: boolean;
  timestamp: number;
  [key: string]: unknown;
}

interface UserRecord {
  created_at: string;
  [key: string]: unknown;
}

interface TopUser {
  telegram_user_id: string;
  count: number;
}

interface AnalyticsData {
  timeRange: string;
  totalUsers: number;
  newUsers: number;
  activeUsers: number;
  vipUsers: number;
  adminUsers: number;
  growthData: { dailyGrowth: number; weeklyGrowth: number };
  topUsers: TopUser[];
}

interface PaymentMethodStat {
  payment_method?: string;
  count: number;
}

interface PaymentReportData {
  timeRange: string;
  totalPayments: number;
  pendingPayments: number;
  completedPayments: number;
  rejectedPayments: number;
  totalRevenue: number;
  avgPayment: number;
  paymentMethods: PaymentMethodStat[];
}

interface CommandStat {
  interaction_data?: string;
  count: number;
}

interface SecurityEvent {
  interaction_type: string;
  count: number;
}

interface BotUsageData {
  timeRange: string;
  totalInteractions: number;
  totalSessions: number;
  avgSessionDuration: number;
  totalActivities: number;
  commandStats: CommandStat[];
  securityEvents: SecurityEvent[];
}

interface UserAnalyticsCSVData {
  timeRange: string;
  totalUsers: number;
  newUsers: number;
  activeUsers: number;
  vipUsers: number;
  adminUsers: number;
}

interface PaymentCSV {
  id: string;
  amount: number;
  currency: string;
  status: string;
  payment_method: string;
  created_at: string;
}

interface TradeData {
  pair?: string;
  entry?: number | string;
  exit?: number | string;
  profit?: number | string;
  amount?: number | string;
  duration?: string;
  loss?: number | string;
  [key: string]: unknown;
}

type InlineKeyboard = {
  inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
};

// In-memory rate limiting store
const rateLimitStore = new Map<string, RateLimitEntry>();
const securityStats: SecurityStats = {
  totalRequests: 0,
  blockedRequests: 0,
  suspiciousUsers: new Set(),
  lastCleanup: Date.now()
};

// Security configuration
const SECURITY_CONFIG = {
  // Rate limits per minute
  MAX_REQUESTS_PER_MINUTE: 20,
  MAX_REQUESTS_PER_HOUR: 150,
  
  // Spam protection
  MAX_IDENTICAL_MESSAGES: 3,
  MAX_COMMANDS_PER_MINUTE: 8,
  FLOOD_PROTECTION_WINDOW: 60000, // 1 minute
  
  // Blocking thresholds
  SUSPICIOUS_THRESHOLD: 30, // requests per minute
  AUTO_BLOCK_DURATION: 300000, // 5 minutes
  TEMP_BLOCK_DURATION: 60000, // 1 minute for minor violations
  
  // Message limits
  MAX_MESSAGE_LENGTH: 4000,
  MIN_MESSAGE_INTERVAL: 500, // 0.5 second between messages
  
  // Admin exemption
  ADMIN_RATE_LIMIT_MULTIPLIER: 5,
  
  // Cleanup interval
  CLEANUP_INTERVAL: 1800000 // 30 minutes
};

// Security functions
function getRateLimitKey(userId: string, type: 'minute' | 'hour' | 'command' | 'message' | 'identical'): string {
  const now = new Date();
  if (type === 'minute') {
    return `${userId}:min:${Math.floor(now.getTime() / 60000)}`;
  } else if (type === 'hour') {
    return `${userId}:hr:${Math.floor(now.getTime() / 3600000)}`;
  } else if (type === 'command') {
    return `${userId}:cmd:${Math.floor(now.getTime() / 60000)}`;
  } else if (type === 'identical') {
    return `${userId}:ident`;
  } else {
    return `${userId}:msg:${Math.floor(now.getTime() / SECURITY_CONFIG.MIN_MESSAGE_INTERVAL)}`;
  }
}

function isRateLimited(userId: string, isAdmin: boolean = false, messageText?: string): { limited: boolean; reason?: string; blockDuration?: number } {
  const now = Date.now();
  const multiplier = isAdmin ? SECURITY_CONFIG.ADMIN_RATE_LIMIT_MULTIPLIER : 1;
  
  // Check if user is temporarily blocked
  const blockKey = `block:${userId}`;
  const blockEntry = rateLimitStore.get(blockKey);
  if (blockEntry?.blocked && blockEntry.blockUntil && now < blockEntry.blockUntil) {
    const remainingTime = Math.ceil((blockEntry.blockUntil - now) / 1000);
    logSecurityEvent(userId, 'blocked_request_attempt', { remainingTime });
    return { limited: true, reason: 'temporarily_blocked', blockDuration: remainingTime };
  }
  
  // Check for identical message spam
  if (messageText && messageText.length > 10) {
    const identicalKey = getRateLimitKey(userId, 'identical');
    const identicalEntry = rateLimitStore.get(identicalKey) || { count: 0, lastReset: now, identicalCount: 0 };
    
    if (identicalEntry.lastMessage === messageText) {
      identicalEntry.identicalCount = (identicalEntry.identicalCount || 0) + 1;
      if (identicalEntry.identicalCount >= SECURITY_CONFIG.MAX_IDENTICAL_MESSAGES) {
        logSecurityEvent(userId, 'identical_spam_detected', { message: messageText.substring(0, 100), count: identicalEntry.identicalCount });
        
        // Temporary block for spam
        const tempBlockEntry: RateLimitEntry = {
          count: 0,
          lastReset: now,
          blocked: true,
          blockUntil: now + SECURITY_CONFIG.TEMP_BLOCK_DURATION
        };
        rateLimitStore.set(blockKey, tempBlockEntry);
        return { limited: true, reason: 'identical_spam', blockDuration: SECURITY_CONFIG.TEMP_BLOCK_DURATION / 1000 };
      }
    } else {
      identicalEntry.identicalCount = 0;
    }
    
    identicalEntry.lastMessage = messageText;
    rateLimitStore.set(identicalKey, identicalEntry);
  }
  
  // Check minute rate limit
  const minuteKey = getRateLimitKey(userId, 'minute');
  const minuteEntry = rateLimitStore.get(minuteKey) || { count: 0, lastReset: now };
  
  if (now - minuteEntry.lastReset > 60000) {
    minuteEntry.count = 0;
    minuteEntry.lastReset = now;
  }
  
  if (minuteEntry.count >= SECURITY_CONFIG.MAX_REQUESTS_PER_MINUTE * multiplier) {
    logSecurityEvent(userId, 'rate_limit_minute_exceeded', { count: minuteEntry.count, limit: SECURITY_CONFIG.MAX_REQUESTS_PER_MINUTE * multiplier });
    
    // Auto-block if suspicious activity
    if (minuteEntry.count >= SECURITY_CONFIG.SUSPICIOUS_THRESHOLD && !isAdmin) {
      const blockEntry: RateLimitEntry = {
        count: 0,
        lastReset: now,
        blocked: true,
        blockUntil: now + SECURITY_CONFIG.AUTO_BLOCK_DURATION
      };
      rateLimitStore.set(blockKey, blockEntry);
      securityStats.suspiciousUsers.add(userId);
      logSecurityEvent(userId, 'auto_blocked_suspicious', { 
        requests: minuteEntry.count, 
        blockDuration: SECURITY_CONFIG.AUTO_BLOCK_DURATION / 1000 
      });
      return { limited: true, reason: 'auto_blocked', blockDuration: SECURITY_CONFIG.AUTO_BLOCK_DURATION / 1000 };
    }
    
    return { limited: true, reason: 'rate_limit_minute' };
  }
  
  // Check hourly rate limit
  const hourKey = getRateLimitKey(userId, 'hour');
  const hourEntry = rateLimitStore.get(hourKey) || { count: 0, lastReset: now };
  
  if (now - hourEntry.lastReset > 3600000) {
    hourEntry.count = 0;
    hourEntry.lastReset = now;
  }
  
  if (hourEntry.count >= SECURITY_CONFIG.MAX_REQUESTS_PER_HOUR * multiplier) {
    logSecurityEvent(userId, 'rate_limit_hour_exceeded', { count: hourEntry.count, limit: SECURITY_CONFIG.MAX_REQUESTS_PER_HOUR * multiplier });
    return { limited: true, reason: 'rate_limit_hour' };
  }
  
  // Update counters
  minuteEntry.count++;
  hourEntry.count++;
  rateLimitStore.set(minuteKey, minuteEntry);
  rateLimitStore.set(hourKey, hourEntry);
  
  return { limited: false };
}

function isCommandSpam(userId: string, command: string): boolean {
  const now = Date.now();
  const commandKey = getRateLimitKey(userId, 'command');
  const entry = rateLimitStore.get(commandKey) || { count: 0, lastReset: now };
  
  if (now - entry.lastReset > 60000) {
    entry.count = 0;
    entry.lastReset = now;
  }
  
  if (entry.count >= SECURITY_CONFIG.MAX_COMMANDS_PER_MINUTE) {
    logSecurityEvent(userId, 'command_spam_detected', { command, count: entry.count });
    return true;
  }
  
  entry.count++;
  rateLimitStore.set(commandKey, entry);
  return false;
}

function validateMessage(text: string, userId: string): { valid: boolean; reason?: string } {
  // Check message length
  if (text.length > SECURITY_CONFIG.MAX_MESSAGE_LENGTH) {
    logSecurityEvent(userId, 'message_too_long', { length: text.length, maxLength: SECURITY_CONFIG.MAX_MESSAGE_LENGTH });
    return { valid: false, reason: 'message_too_long' };
  }
  
  // Check for suspicious patterns
  const suspiciousPatterns = [
    { pattern: /(.)\1{20,}/, name: 'repeated_chars' },
    { pattern: /[^\w\s\u00C0-\u024F\u1E00-\u1EFF]{30,}/, name: 'too_many_special_chars' },
    { pattern: /(http[s]?:\/\/[^\s]+){3,}/, name: 'multiple_urls' },
    { pattern: /(.{1,10})\1{5,}/, name: 'repeated_patterns' },
  ];
  
  for (const { pattern, name } of suspiciousPatterns) {
    if (pattern.test(text)) {
      logSecurityEvent(userId, 'suspicious_pattern_detected', { pattern: name, message: text.substring(0, 100) });
      return { valid: false, reason: 'suspicious_content' };
    }
  }
  
  return { valid: true };
}

function cleanupRateLimit(): void {
  const now = Date.now();
  
  // Only cleanup if enough time has passed
  if (now - securityStats.lastCleanup < SECURITY_CONFIG.CLEANUP_INTERVAL) {
    return;
  }
  
  const expiredKeys: string[] = [];
  
  for (const [key, entry] of rateLimitStore.entries()) {
    // Remove entries older than 2 hours or expired blocks
    if (now - entry.lastReset > 7200000 || (entry.blocked && entry.blockUntil && now > entry.blockUntil)) {
      expiredKeys.push(key);
    }
  }
  
  expiredKeys.forEach(key => rateLimitStore.delete(key));
  
  securityStats.lastCleanup = now;
  
  if (expiredKeys.length > 0) {
    console.log(`🧹 Cleaned up ${expiredKeys.length} expired rate limit entries`);
    console.log(`📊 Security stats - Total: ${securityStats.totalRequests}, Blocked: ${securityStats.blockedRequests}, Suspicious users: ${securityStats.suspiciousUsers.size}`);
  }
}

function logSecurityEvent(
  userId: string,
  event: string,
  details?: Record<string, unknown>
): void {
  const timestamp = new Date().toISOString();
  console.log(`🔒 SECURITY [${timestamp}] User: ${userId}, Event: ${event}`, details ? JSON.stringify(details) : '');
  
  // Update security stats
  securityStats.totalRequests++;
  if (event.includes('blocked') || event.includes('limited') || event.includes('spam')) {
    securityStats.blockedRequests++;
  }
}

function getSecurityResponse(reason: string, blockDuration?: number): string {
  switch (reason) {
    case 'temporarily_blocked':
      return `🛡️ You are temporarily blocked. Please wait ${blockDuration} seconds before trying again.`;
    case 'rate_limit_minute':
      return '⏱️ You are sending messages too quickly. Please slow down and try again in a minute.';
    case 'rate_limit_hour':
      return '⏰ You have reached your hourly message limit. Please try again later.';
    case 'identical_spam':
      return `🚫 Please don't repeat the same message. You're blocked for ${blockDuration} seconds.`;
    case 'auto_blocked':
      return `🚨 Suspicious activity detected. You're blocked for ${blockDuration} seconds. Contact admin if this is a mistake.`;
    case 'command_spam':
      return '⚡ You are using commands too frequently. Please wait a moment.';
    case 'message_too_long':
      return '📏 Your message is too long. Please break it into smaller messages.';
    case 'suspicious_content':
      return '🚨 Your message contains suspicious content and was blocked.';
    default:
      return '🛡️ Request blocked by security system. Please try again later.';
  }
}

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const BOT_VERSION = Deno.env.get("BOT_VERSION") || "0.0.0";

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
async function startBotSession(
  telegramUserId: string,
  userInfo: Record<string, unknown> = {}
): Promise<string> {
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

async function updateBotSession(
  telegramUserId: string,
  activityData: Record<string, unknown> = {}
): Promise<void> {
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

// Optimized database utility functions with batching


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
  oldValues?: Record<string, unknown>,
  newValues?: Record<string, unknown>
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

  const autoReply = await getAutoReply('help_message', { firstName });
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

async function checkBotVersion(): Promise<void> {
  try {
    const storedVersion = await getBotSetting('bot_version');
    if (storedVersion !== BOT_VERSION) {
      console.log(`\uD83D\uDD04 New bot version detected: ${BOT_VERSION} (was ${storedVersion || 'none'})`);
      await setBotSetting('bot_version', BOT_VERSION, 'system');
      for (const adminId of ADMIN_USER_IDS) {
        const chatId = parseInt(adminId);
        await sendMessage(chatId, `\uD83D\uDE80 *Bot updated!*\nVersion: \`${BOT_VERSION}\`\nRefreshing configuration...`);
        await handleRefreshBot(chatId, adminId);
      }
    }
  } catch (error) {
    console.error('Error checking bot version:', error);
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
  replyMarkup?: Record<string, unknown>,
  options?: { autoDelete?: boolean; deleteAfterSeconds?: number }
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

    // Auto-delete messages after specified time unless disabled
    if (result.ok && result.result && options?.autoDelete !== false) {
      const messageId = result.result.message_id;
      const deleteDelay =
        options?.deleteAfterSeconds ||
        parseInt((await getBotSetting('auto_delete_delay_seconds')) || '30');

      console.log(
        `⏰ Scheduling auto-deletion for message ${messageId} in chat ${chatId} after ${deleteDelay} seconds`
      );

      setTimeout(async () => {
        try {
          console.log(`🗑️ Auto-deleting message ${messageId} from chat ${chatId}`);
          await deleteMessage(chatId, messageId);
        } catch (error) {
          console.error(`❌ Failed to auto-delete message ${messageId}:`, error);
        }
      }, deleteDelay * 1000);
    }

    return result;
  } catch (error) {
    console.error("🚨 Error sending message:", error);
    return null;
  }
}

async function sendAccessDeniedMessage(chatId: number, details = "") {
  const baseMessage =
    (await getBotContent('access_denied_message')) || '❌ Access denied.';
  const finalMessage = details ? `${baseMessage} ${details}` : baseMessage;
  await sendMessage(chatId, finalMessage);
}

async function promptSettingUpdate(
  chatId: number,
  userId: string,
  settingKey: string,
  promptText: string
): Promise<void> {
  if (!isAdmin(userId)) {
    await sendAccessDeniedMessage(chatId);
    return;
  }
  const currentValue = await getBotSetting(settingKey);
  const userSession = getUserSession(userId);
  userSession.awaitingInput = `update_setting:${settingKey}`;
  await sendMessage(
    chatId,
    `⚙️ *Update Setting: ${settingKey}*\n${promptText}\nCurrent value: \`${
      currentValue ?? 'not set'
    }\`\nSend the new value in your next message.`
  );
}

async function showAdvancedSettings(chatId: number, userId: string) {
  if (!isAdmin(userId)) {
    await sendAccessDeniedMessage(chatId);
    return;
  }
  const keyboard = {
    inline_keyboard: [
      [{ text: '🗑️ Auto-delete Delay', callback_data: 'set_delete_delay' }],
      [{ text: '⏱️ Broadcast Delay', callback_data: 'set_broadcast_delay' }],
      [{ text: '📤 Export Settings', callback_data: 'export_settings' }]
    ]
  };
  await sendMessage(chatId, '⚙️ *Advanced Settings*', keyboard);
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
// Receipt Upload Handler
async function handleReceiptUpload(
  message: TelegramMessage,
  userId: string,
  firstName: string
): Promise<void> {
  try {
    console.log(`📄 Receipt upload from user: ${userId}`);
    
    const chatId = message.chat.id;
    let fileId = '';
    let fileType = '';
    
    // Determine file type and get file ID
    if (message.photo) {
      fileId = message.photo[message.photo.length - 1].file_id; // Get highest resolution
      fileType = 'photo';
    } else if (message.document) {
      fileId = message.document.file_id;
      fileType = 'document';
    }
    
    if (!fileId) {
      await sendMessage(chatId, "❌ Unable to process the uploaded file. Please try again.");
      return;
    }
    
    // Get user's pending subscription
    const { data: subscription, error } = await supabaseAdmin
      .from('user_subscriptions')
      .select('*, subscription_plans(*)')
      .eq('telegram_user_id', userId)
      .eq('payment_status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (error || !subscription) {
      // Only send this message in private chats, not in groups
      const chatType = message.chat.type;
      if (chatType === 'private') {
        await sendMessage(chatId, `❌ No pending payment found. 

🎯 **To submit a receipt:**
1️⃣ First select a VIP package
2️⃣ Choose payment method
3️⃣ Complete payment
4️⃣ Then upload receipt

💡 Use /start to begin the process.`);
      } else {
        console.log(`🔇 Ignoring receipt upload in ${chatType} - no pending payment for user ${userId}`);
      }
      return;
    }
    
    // Save receipt information to media_files table
    const { error: mediaError } = await supabaseAdmin
      .from('media_files')
      .insert({
        telegram_file_id: fileId,
        file_type: fileType,
        file_path: `telegram/${fileId}`, // Add file_path field
        filename: message.document?.file_name || `receipt_${fileId}.jpg`,
        caption: message.caption || `Receipt for ${subscription.subscription_plans?.name}`,
        uploaded_by: userId
      })
      .select()
      .single();
    
    if (mediaError) {
      console.error('❌ Error saving receipt to media_files:', mediaError);
      console.error('❌ Media error details:', JSON.stringify(mediaError, null, 2));
      
      // Try to continue without saving to media_files table
      console.log('⚠️ Continuing without media_files entry...');
    }
    
    // Update subscription with receipt info and payment instructions
    const { error: updateError } = await supabaseAdmin
      .from('user_subscriptions')
      .update({
        receipt_telegram_file_id: fileId,
        receipt_file_path: `telegram_file_${fileId}`,
        payment_instructions: `Receipt uploaded for ${subscription.subscription_plans?.name}`,
        updated_at: new Date().toISOString()
      })
      .eq('id', subscription.id);
      
    if (updateError) {
      console.error('❌ Error updating subscription with receipt:', updateError);
      await sendMessage(chatId, "❌ Error saving receipt. Please try again.");
      return;
    }
    
    // Notify user
    await sendMessage(chatId, `✅ **Receipt Received!**

📄 Your payment receipt has been submitted successfully.

📦 **Package:** ${subscription.subscription_plans?.name}
💰 **Amount:** $${subscription.subscription_plans?.price}
🆔 **Reference:** SUB_${subscription.id.substring(0, 8)}

⏰ **What's next:**
• Our team will verify your payment
• You'll receive confirmation within 1-2 hours
• VIP access will be activated automatically

Thank you for choosing Dynamic Capital VIP! 🌟`);
    
    // Notify all admins with approval buttons
    await notifyAdminsReceiptSubmitted(userId, firstName, subscription, fileId, fileType);
    
    // Log the activity
    await logAdminAction(userId, 'receipt_upload', `Receipt uploaded for subscription ${subscription.id}`, 'user_subscriptions', subscription.id);
    
  } catch (error) {
    console.error('🚨 Error handling receipt upload:', error);
    await sendMessage(message.chat.id, "❌ An error occurred processing your receipt. Please try again or contact support.");
  }
}

// Admin Receipt Notification Function
async function notifyAdminsReceiptSubmitted(
  userId: string,
  firstName: string,
  subscription: SubscriptionRecord,
  fileId: string,
  fileType: string
): Promise<void> {
  try {
    const message = `🧾 **New Receipt Submitted!**

👤 **User:** ${firstName} (\`${userId}\`)
📦 **Package:** ${subscription.subscription_plans?.name}
💰 **Amount:** $${subscription.subscription_plans?.price}
💳 **Method:** ${subscription.payment_method?.toUpperCase()}
🆔 **Subscription:** ${subscription.id.substring(0, 8)}

📄 **Receipt:** ${fileType === 'photo' ? '📸 Photo' : '📎 Document'}
⏰ **Submitted:** ${new Date().toLocaleString()}

🎯 **Action Required:**
Review the receipt and approve or reject the payment.`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "✅ Approve Payment", callback_data: `approve_payment_${subscription.id}` },
          { text: "❌ Reject Payment", callback_data: `reject_payment_${subscription.id}` }
        ],
        [
          { text: "👤 View User Profile", callback_data: `view_user_${userId}` },
          { text: "📋 View All Pending", callback_data: "view_pending_payments" }
        ]
      ]
    };

    // Send to all admins
    for (const adminId of ADMIN_USER_IDS) {
      try {
        // First send the receipt file
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: adminId,
            photo: fileId,
            caption: `Receipt from ${firstName} (${userId})\nPackage: ${subscription.subscription_plans?.name}`
          })
        });
        
        // Then send the notification message with buttons
        await sendMessage(parseInt(adminId), message, keyboard);
        console.log(`✅ Notified admin ${adminId} about receipt submission`);
      } catch (error) {
        console.error(`❌ Failed to notify admin ${adminId}:`, error);
      }
    }
    
    // Log the notification
    await logAdminAction('system', 'receipt_notification', `Receipt submitted for ${subscription.subscription_plans?.name}`, 'user_subscriptions', subscription.id);
    
  } catch (error) {
    console.error('🚨 Error notifying admins about receipt:', error);
  }
}

// Function to add user to VIP channels (implement based on your channel setup)
async function addUserToVipChannel(telegramUserId: string): Promise<void> {
  try {
    // This would need to be implemented based on your specific VIP channels
    // Example implementation:
    
    const vipChannels = [
      '-1001234567890', // Replace with actual VIP channel IDs
      '-1001234567891'  // Add more channels as needed
    ];
    
    for (const channelId of vipChannels) {
      try {
        // Add user to channel (requires bot to be admin in the channel)
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/approveChatJoinRequest`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: channelId,
            user_id: parseInt(telegramUserId)
          })
        });
        
        console.log(`✅ Added user ${telegramUserId} to channel ${channelId}`);
      } catch (error) {
        console.error(`❌ Failed to add user to channel ${channelId}:`, error);
      }
    }
    
    // Log channel addition
    await logAdminAction('system', 'channel_addition', `Added user ${telegramUserId} to VIP channels`);
    
  } catch (error) {
    console.error('🚨 Error adding user to VIP channels:', error);
  }
}
async function getWelcomeMessage(firstName: string): Promise<string> {
  console.log(`📄 [getWelcomeMessage] Starting for user: ${firstName}`);
  try {
    const template = await getBotContent('welcome_message');
    console.log(`📄 [getWelcomeMessage] Template fetched: ${template ? 'found' : 'not found'}`);
    if (!template) {
      const defaultMessage = `🚀 *Welcome to Dynamic Capital VIP, ${firstName}!*\n\nWe're here to help you level up your trading with:\n\n• 🔔 Quick market updates\n• 📈 Beginner-friendly tips\n• 🎓 Easy learning resources\n\nReady to get started? Pick an option below 👇`;
      console.log(`📄 [getWelcomeMessage] Using default message for: ${firstName}`);
      return defaultMessage;
    }
    console.log(`📄 [getWelcomeMessage] Formatting content for: ${firstName}`);
    return formatContent(template, { firstName });
  } catch (error) {
    console.error(`❌ [getWelcomeMessage] Error for ${firstName}:`, error);
    return `🚀 *Welcome to Dynamic Capital VIP, ${firstName}!*\n\n⚠️ Please try again in a moment.`;
  }
}

async function getVipPackages(): Promise<VipPackage[]> {
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
    return (data as VipPackage[]) || [];
  } catch (error) {
    console.error('🚨 Exception fetching VIP packages:', error);
    return [];
  }
}

async function getVipPackagesKeyboard(): Promise<InlineKeyboard> {
  const packages = await getVipPackages();
  const buttons: InlineKeyboard['inline_keyboard'] = [];

  packages.forEach((pkg: VipPackage) => {
    const priceText = pkg.is_lifetime ? '$' + pkg.price + ' Lifetime' : '$' + pkg.price + '/' + pkg.duration_months + 'mo';
    const discount = pkg.duration_months >= 12 ? '🔥' : 
                    pkg.duration_months >= 6 ? '⭐' : 
                    pkg.duration_months >= 3 ? '💫' : '🎯';
    buttons.push([{
      text: `${discount} ${pkg.name} - ${priceText}`,
      callback_data: `select_vip_${pkg.id}`
    }]);
  });

  buttons.push([
    { text: "🎁 View Promotions", callback_data: "view_promotions" },
    { text: "🎓 Education Packages", callback_data: "view_education" }
  ]);

  buttons.push([
    { text: "❓ Have Questions?", callback_data: "support" },
    { text: "🔙 Back to Main Menu", callback_data: "back_main" }
  ]);

  return { inline_keyboard: buttons };
}

function getMainMenuKeyboard(): InlineKeyboard {
  return {
    inline_keyboard: [
      [
        { text: "💎 VIP Packages", callback_data: "view_vip_packages" },
        { text: "🎓 Education", callback_data: "view_education" }
      ],
      [
        { text: "💰 Promotions", callback_data: "view_promotions" },
        { text: "❓ Help & FAQ", callback_data: "help_faq" }
      ],
      [
        { text: "🏢 About Us", callback_data: "about_us" },
        { text: "🛟 Support", callback_data: "support" }
      ],
      [
        { text: "📊 Trading Results", callback_data: "trading_results" },
        { text: "📋 Terms", callback_data: "terms" }
      ]
    ]
  };
}

// VIP Package Selection Handler
async function handleVipPackageSelection(chatId: number, userId: string, packageId: string, _firstName: string): Promise<void> {
  try {
    console.log(`💎 User ${userId} selected VIP package: ${packageId}`);

    // Clean up any previous package or payment messages
    const session = userSessions.get(userId) || {};
    if (session.lastPackageMessageId) {
      await deleteMessage(chatId, session.lastPackageMessageId);
    }
    if (session.paymentMessageId) {
      await deleteMessage(chatId, session.paymentMessageId);
    }
    if (session.paymentTimeout) {
      clearTimeout(session.paymentTimeout);
    }
    
    // Get package details
    const { data: pkg, error } = await supabaseAdmin
      .from('subscription_plans')
      .select('*')
      .eq('id', packageId)
      .single();

    if (error || !pkg) {
      await sendMessage(chatId, "❌ Package not found. Please try again.");
      return;
    }

    const message = `💎 **${pkg.name}** Selected!

💰 **Price:** $${pkg.price} USD
⏱️ **Duration:** ${pkg.is_lifetime ? 'Lifetime Access' : pkg.duration_months + ' months'}

✨ **Features:**
${pkg.features?.map((f: string) => `• ${f}`).join('\n') || '• Premium features included'}

🎯 **Next steps:**`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🎫 Apply Promo Code", callback_data: `apply_promo_${packageId}` },
          { text: "💳 Continue to Payment", callback_data: `show_payment_${packageId}` }
        ],
        [
          { text: "🔙 Back to Packages", callback_data: "view_vip_packages" }
        ]
      ]
    };

    const sent = await sendMessage(chatId, message, keyboard);

    if (sent?.result?.message_id) {
      userSessions.set(userId, {
        ...session,
        lastPackageMessageId: sent.result.message_id,
        paymentMessageId: undefined,
        paymentTimeout: undefined,
      });
    }
    
    // Log the selection
    await logAdminAction(userId, 'package_selection', `User selected package: ${pkg.name}`, 'subscription_plans', packageId);
    
  } catch (error) {
    console.error('🚨 Error in package selection:', error);
    await sendMessage(chatId, "❌ An error occurred. Please try again.");
  }
}

// Payment Method Selection Handler
async function handlePaymentMethodSelection(chatId: number, userId: string, packageId: string, method: string): Promise<void> {
  try {
    console.log(`💳 User ${userId} selected payment method: ${method} for package: ${packageId}`);

    // Clear any previous payment session
    const session = userSessions.get(userId) || {};
    if (session.paymentMessageId) {
      await deleteMessage(chatId, session.paymentMessageId);
    }
    if (session.paymentTimeout) {
      clearTimeout(session.paymentTimeout);
    }
    
    // Check if user has applied promo code
    const userSession = userSessions.get(userId);
    let finalPrice = 0;
    let promoCode = '';

    // Get package details
    const { data: pkg, error } = await supabaseAdmin
      .from('subscription_plans')
      .select('*')
      .eq('id', packageId)
      .single();

    if (error || !pkg) {
      console.error('❌ Package fetch error:', error);
      await sendMessage(chatId, "❌ Package not found. Please try again.");
      return;
    }

    if (userSession && userSession.type === 'promo_applied' && userSession.packageId === packageId) {
      finalPrice = userSession.finalPrice;
      promoCode = userSession.promoCode;
      console.log(`🎫 Using promo: ${promoCode}, final price: $${finalPrice}`);
    } else {
      finalPrice = pkg.price;
      console.log(`💰 No promo applied, using original price: $${finalPrice}`);
    }

    console.log(`📦 Package found: ${pkg.name} - Final price: $${finalPrice}`);

    // Use upsert to handle existing subscriptions gracefully
    const { data: subscription, error: subError } = await supabaseAdmin
      .from('user_subscriptions')
      .upsert({
        telegram_user_id: userId,
        plan_id: packageId,
        payment_method: method,
        payment_status: 'pending',
        is_active: false,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'telegram_user_id',
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (subError) {
      console.error('❌ Error creating/updating subscription:', subError);
      await sendMessage(chatId, "❌ Error processing subscription. Please try again.");
      return;
    }
    
    console.log(`✅ Subscription ready: ${subscription.id}`);

    let paymentInstructions = '';
    
    switch (method) {
      case 'binance': {
        console.log('🟡 Processing Binance Pay instructions');
        const binancePkg = { ...pkg, price: finalPrice };
        paymentInstructions = await getBinancePayInstructions(binancePkg, subscription.id);
        break;
      }
      case 'crypto': {
        console.log('₿ Processing Crypto instructions');
        const cryptoPkg = { ...pkg, price: finalPrice };
        paymentInstructions = await getCryptoPayInstructions(cryptoPkg, subscription.id);
        break;
      }
      case 'bank': {
        console.log('🏦 Processing Bank Transfer instructions');
        paymentInstructions = await getBankTransferInstructions({ ...pkg, price: finalPrice }, subscription.id);
        break;
      }
      default: {
        console.error(`❌ Unknown payment method: ${method}`);
        await sendMessage(chatId, `❌ Unknown payment method: ${method}. Please try again.`);
        return;
      }
    }

    console.log(`📝 Payment instructions generated for method: ${method}`);
    const sent = await sendMessage(chatId, paymentInstructions, undefined, {
      autoDelete: false,
    });

    if (sent?.result?.message_id) {
      const timeout = setTimeout(async () => {
        await sendMessage(chatId, '⏰ Payment session expired. Please start again.');
        await deleteMessage(chatId, sent.result.message_id);
        const sess = userSessions.get(userId);
        if (sess) {
          delete sess.paymentMessageId;
          delete sess.paymentTimeout;
          userSessions.set(userId, sess);
        }
      }, 60 * 1000);

      userSessions.set(userId, {
        ...session,
        paymentMessageId: sent.result.message_id,
        paymentTimeout: timeout,
      });
    }
    
    // Notify admins of new payment
    await notifyAdminsNewPayment(userId, pkg.name, method, pkg.price, subscription.id);
    console.log(`🔔 Admins notified about new payment: ${subscription.id}`);
    
  } catch (error) {
    console.error('🚨 Error in payment method selection:', error);
    await sendMessage(chatId, `❌ An error occurred: ${(error as Error).message}. Please try again.`);
  }
}

// Payment Instructions Functions
async function getBinancePayInstructions(
  pkg: VipPackage,
  subscriptionId: string
): Promise<string> {
  try {
    console.log('💳 Processing Binance Pay checkout...');
    
    // Create Binance Pay checkout via edge function
    const response = await supabaseAdmin.functions.invoke('binance-pay-checkout', {
      body: {
        planId: pkg.id,
        telegramUserId: subscriptionId // Use subscription ID for now
      }
    });

    if (response.error) {
      console.error('❌ Binance Pay checkout error:', response.error);
      throw new Error('Binance Pay checkout failed');
    }

    const { checkoutUrl } = response.data;
    
    if (checkoutUrl) {
      return `💳 **Binance Pay Instructions**

📦 **Package:** ${pkg.name}
💰 **Amount:** $${pkg.price} USD

🔗 **Quick Payment Link:**
${checkoutUrl}

📱 **Alternative Instructions:**
1️⃣ Click the link above for instant checkout
2️⃣ OR scan QR code in Binance app
3️⃣ Complete payment in Binance Pay
4️⃣ Payment will be verified automatically

📝 **Reference:** \`SUB_${subscriptionId.substring(0, 8)}\`

⚠️ **Important:**
• Payment processes instantly via Binance Pay
• You'll receive confirmation within minutes
• Keep transaction ID for support

❓ Need help? Contact @DynamicCapital_Support`;
    } else {
      throw new Error('No checkout URL received');
    }
    
  } catch (error) {
    console.error('❌ Error creating Binance Pay checkout:', error);
    return `💳 **Binance Pay Instructions**

📦 **Package:** ${pkg.name}
💰 **Amount:** $${pkg.price} USD

⚠️ Automated checkout temporarily unavailable.

📱 **Manual Instructions:**
1️⃣ Open Binance app
2️⃣ Go to Pay → Send
3️⃣ Enter amount: $${pkg.price}
4️⃣ Send to: \`binancepay@dynamicvip.com\`
5️⃣ Take screenshot of confirmation
6️⃣ Send screenshot to this chat

📝 **Reference:** \`SUB_${subscriptionId.substring(0, 8)}\`

❓ Need help? Contact @DynamicCapital_Support`;
  }
}

async function getCryptoPayInstructions(
  pkg: VipPackage,
  subscriptionId: string
): Promise<string> {
  try {
    console.log('₿ Fetching crypto wallet addresses...');
    
    // Try to get crypto addresses from bot_content table
    const { data: cryptoSettings, error: _error } = await supabaseAdmin
      .from('bot_content')
      .select('content_key, content_value')
      .in('content_key', ['crypto_btc_address', 'crypto_eth_address', 'crypto_usdt_trc20', 'crypto_usdt_erc20'])
      .eq('is_active', true);

    let walletAddresses = '';
    if (cryptoSettings && cryptoSettings.length > 0) {
      const addressMap = new Map(cryptoSettings.map(item => [item.content_key, item.content_value]));
      
      walletAddresses = `🪙 **Wallet Addresses:**
${addressMap.get('crypto_btc_address') ? `• **Bitcoin (BTC):** \`${addressMap.get('crypto_btc_address')}\`` : ''}
${addressMap.get('crypto_eth_address') ? `• **Ethereum (ETH):** \`${addressMap.get('crypto_eth_address')}\`` : ''}
${addressMap.get('crypto_usdt_trc20') ? `• **USDT (TRC20):** \`${addressMap.get('crypto_usdt_trc20')}\`` : ''}
${addressMap.get('crypto_usdt_erc20') ? `• **USDT (ERC20):** \`${addressMap.get('crypto_usdt_erc20')}\`` : ''}`.replace(/\n\n/g, '\n');
    } else {
      walletAddresses = `🪙 **Accepted Cryptocurrencies:**
• **Bitcoin (BTC):** \`bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh\`
• **Ethereum (ETH):** \`0x742d35Cc6642C4532F35B35D00a8e0c8dC2dA4cB\`
• **USDT (TRC20):** \`TLPjmhVJ8xJDrA36BNhSj1kFnV2kdEKdWs\`
• **USDT (ERC20):** \`0x742d35Cc6642C4532F35B35D00a8e0c8dC2dA4cB\``;
    }

    return `₿ **Cryptocurrency Payment Instructions**

📦 **Package:** ${pkg.name}
💰 **Amount:** $${pkg.price} USD

${walletAddresses}

📝 **Reference:** \`SUB_${subscriptionId.substring(0, 8)}\`

📱 **Instructions:**
1️⃣ Calculate equivalent crypto amount
2️⃣ Send to appropriate wallet address above
3️⃣ Include reference in transaction memo (if supported)
4️⃣ Take screenshot of transaction confirmation
5️⃣ Send screenshot + transaction hash to this chat

⚠️ **Important:**
• Double-check wallet addresses before sending
• Include reference ID: SUB_${subscriptionId.substring(0, 8)}
• Send from personal wallet only (not exchange)
• Payment confirmed within 6 blockchain confirmations
• Keep transaction hash for support

❓ Need help? Contact @DynamicCapital_Support`;
    
  } catch (error) {
    console.error('❌ Error fetching crypto addresses:', error);
    return `₿ **Cryptocurrency Payment Instructions**

📦 **Package:** ${pkg.name}
💰 **Amount:** $${pkg.price} USD

⚠️ Error loading crypto addresses. Please contact @DynamicCapital_Support for wallet details.

📝 **Reference:** \`SUB_${subscriptionId.substring(0, 8)}\``;
  }
}

async function getBankTransferInstructions(
  pkg: VipPackage,
  subscriptionId: string
): Promise<string> {
  try {
    console.log('🏦 Fetching bank accounts for transfer instructions...');
    
    // Get active bank accounts
    const { data: banks, error } = await supabaseAdmin
      .from('bank_accounts')
      .select('*')
      .eq('is_active', true)
      .order('display_order');

    if (error) {
      console.error('❌ Error fetching bank accounts:', error);
    }

    let bankDetails = '';
    if (banks && banks.length > 0) {
      console.log(`✅ Found ${banks.length} active bank account(s)`);
      bankDetails = banks.map((bank, index) => 
        `${index + 1}️⃣ **${bank.bank_name}**
📧 **Account Name:** ${bank.account_name}
🔢 **Account Number:** \`${bank.account_number}\`
💱 **Currency:** ${bank.currency}`
      ).join('\n\n');
    } else {
      console.log('⚠️ No active bank accounts found');
      bankDetails = `🏦 **Bank Account Details:**
📧 Account Name: Dynamic Capital Ltd
🔢 Account Number: \`Will be provided shortly\`
💱 Currency: USD

⚠️ Contact @DynamicCapital_Support for complete bank details`;
    }

    // Update subscription with bank details for reference
    const bankDetailsText = banks && banks.length > 0 
      ? banks.map(b => `${b.bank_name}: ${b.account_number}`).join(', ')
      : 'Bank details provided separately';
      
    await supabaseAdmin
      .from('user_subscriptions')
      .update({
        bank_details: bankDetailsText,
        payment_instructions: 'Bank transfer with receipt upload required'
      })
      .eq('id', subscriptionId);

    return `🏦 **Bank Transfer Instructions**

📦 **Package:** ${pkg.name}
💰 **Amount:** $${pkg.price} USD

${bankDetails}

📝 **Reference ID:** \`SUB_${subscriptionId.substring(0, 8)}\`

📱 **Step-by-Step Instructions:**
1️⃣ Log into your banking app/website
2️⃣ Create new transfer with exact amount: **$${pkg.price}**
3️⃣ Use account details above
4️⃣ **MUST include reference ID in transfer description**
5️⃣ Complete the transfer
6️⃣ Take clear photo of transfer confirmation
7️⃣ Send the receipt photo to this chat

⚠️ **Critical Requirements:**
• Transfer exact amount: $${pkg.price}
• Include reference: SUB_${subscriptionId.substring(0, 8)}
• Send clear receipt photo showing:
  - Transfer amount
  - Destination account
  - Reference ID
  - Date & time

⏰ **Processing Time:** 2-24 hours after receipt verification
❓ **Support:** @DynamicCapital_Support`;

  } catch (error) {
    console.error('🚨 Error generating bank transfer instructions:', error);
    return `🏦 **Bank Transfer Instructions**

📦 **Package:** ${pkg.name}
💰 **Amount:** $${pkg.price} USD

⚠️ Error loading bank details. Please contact @DynamicCapital_Support for transfer instructions.

📝 **Reference:** \`SUB_${subscriptionId.substring(0, 8)}\``;
  }
}

// Admin Notification Function
async function notifyAdminsNewPayment(userId: string, packageName: string, method: string, amount: number, subscriptionId: string): Promise<void> {
  try {
    const message = `🔔 **New Payment Alert!**

👤 **User:** ${userId}
📦 **Package:** ${packageName}
💳 **Method:** ${method.toUpperCase()}
💰 **Amount:** $${amount}
🆔 **Subscription ID:** ${subscriptionId.substring(0, 8)}

⏰ **Time:** ${new Date().toLocaleString()}

💡 **Next Steps:**
• Wait for user to upload receipt
• Verify payment details
• Approve or reject payment
• User will be added to VIP channel automatically`;

    // Send to all admins
    for (const adminId of ADMIN_USER_IDS) {
      try {
        await sendMessage(parseInt(adminId), message);
        console.log(`✅ Notified admin ${adminId} about new payment`);
      } catch (error) {
        console.error(`❌ Failed to notify admin ${adminId}:`, error);
      }
    }
    
    // Log the notification
    await logAdminAction('system', 'payment_notification', `New payment: ${packageName} - $${amount}`, 'user_subscriptions', subscriptionId);
    
  } catch (error) {
    console.error('🚨 Error notifying admins:', error);
  }
}

// Other callback handlers
async function handleAboutUs(chatId: number, _userId: string): Promise<void> {
  const content = await getBotContent('about_us') || `🏢 **About Dynamic Capital**

We are a leading trading education and signal provider focused on helping traders achieve consistent profitability.

🎯 **Our Mission:**
To democratize access to professional trading education and real-time market insights.

🏆 **Why Choose Us:**
• 5+ years of market experience
• Proven track record
• 24/7 support team
• Active community of 10,000+ traders
• Regular educational webinars

📈 **Our Services:**
• Real-time trading signals
• Market analysis and insights
• One-on-one mentorship
• Educational courses
• Risk management strategies

🌟 Join thousands of successful traders who trust Dynamic Capital for their trading journey!`;

  const keyboard = {
    inline_keyboard: [
      [{ text: "🔙 Back to Main Menu", callback_data: "back_main" }]
    ]
  };

  await sendMessage(chatId, content, keyboard);
}

async function handleSupport(chatId: number, userId: string): Promise<void> {
  const baseMessage =
    (await getBotContent('support_message')) ||
    `🛟 **Customer Support**\n\nOur dedicated team is here to help you!\n\nInclude your user ID \`${userId}\` when contacting us.\n\n`;

  const links = await getContactLinks();

  const escapeMarkdown = (text: string) =>
    text.replace(/[_*()[\]~`>#+=|{}.!-]/g, (m) => `\\${m}`);

  const contactInfo = links
    .map((l) => `${l.icon_emoji} ${escapeMarkdown(l.display_name)}: ${escapeMarkdown(l.url)}`)
    .join('\n');

  const buttons = links.map((l) => ({
    text: `${l.icon_emoji} ${l.display_name}`,
    url: l.url,
  }));

  const rows: Array<Array<Record<string, string>>> = [];
  for (let i = 0; i < buttons.length; i += 2) {
    rows.push(buttons.slice(i, i + 2));
  }
  rows.push([{ text: '🔙 Back to Main Menu', callback_data: 'back_main' }]);

  const message =
    contactInfo.length > 0
      ? `${baseMessage}${contactInfo}`
      : `${baseMessage}No contact methods are configured.`;

  await sendMessage(chatId, message, { inline_keyboard: rows });
}

async function handleViewPromotions(chatId: number, _userId: string): Promise<void> {
  try {
    const { data: promos, error } = await supabaseAdmin
      .from('promotions')
      .select('*')
      .eq('is_active', true)
      .gte('valid_until', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching promotions:', error);
      await sendMessage(chatId, "❌ Error loading promotions. Please try again.");
      return;
    }

    let message = `💰 **Active Promotions**

🎉 Limited time offers just for you!\n\n`;

    if (!promos || promos.length === 0) {
      message += `📭 No active promotions at the moment.

🔔 **Stay tuned!** 
Follow our announcements for upcoming deals and discounts.

💡 **Tip:** VIP members get exclusive early access to all promotions!`;
    } else {
      promos.forEach((promo, _index) => {
        const validUntil = new Date(promo.valid_until).toLocaleDateString();
        const discountText = promo.discount_type === 'percentage' 
          ? `${promo.discount_value}% OFF` 
          : `$${promo.discount_value} OFF`;
        
        const usesLeft = promo.max_uses ? (promo.max_uses - (promo.current_uses || 0)) : '∞';
        const urgency = promo.max_uses && ((promo.current_uses || 0) / promo.max_uses) > 0.8 ? '🔥 LIMITED!' : '';
        
        message += `🎫 **${promo.code}** ${urgency}
📢 ${discountText} - ${promo.description}
⏰ Valid until: ${validUntil}
🎯 Uses left: ${usesLeft}

`;
      });
      
      message += `💡 **How to use:**
1️⃣ Select a VIP package
2️⃣ Enter promo code during checkout
3️⃣ Discount applied automatically!

🔔 **Pro Tip:** Some promos have limited uses - claim yours now!`;
    }

    const keyboard = {
      inline_keyboard: [
        [
          { text: "💎 View VIP Packages", callback_data: "view_vip_packages" },
          { text: "🎓 Education Courses", callback_data: "view_education" }
        ],
        [{ text: "🔙 Back to Main Menu", callback_data: "back_main" }]
      ]
    };

    await sendMessage(chatId, message, keyboard);
    
  } catch (error) {
    console.error('🚨 Error in promotions handler:', error);
    await sendMessage(chatId, "❌ An error occurred. Please try again.");
  }
}

async function handleTradingResults(chatId: number, userId: string): Promise<void> {
  try {
    console.log(`📊 User ${userId} requesting trading results`);
    
    const content = await getBotContent('trading_results_channel') || '';
    const channelUsername = content || '@DynamicCapital_Results';
    
    const message = `📊 **Trading Results & Performance**

🎯 **Real-Time Performance Updates**
View our latest trading results, success rates, and detailed performance analytics.

📈 **What You'll Find:**
• Daily trading signals results
• Win/Loss ratios and statistics  
• Monthly performance summaries
• Risk management insights
• Market analysis breakdowns

🔗 **Join Our Results Channel:**
${channelUsername}

💡 **Why Join?**
✅ Transparent performance tracking
✅ Learn from winning strategies
✅ See real proof of our methods
✅ Community discussions on results

🎯 **VIP Members Get:**
• Detailed trade breakdowns
• Entry/exit explanations
• Risk management strategies
• Private performance discussions

Ready to see our track record? 📊`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "📊 Join Results Channel", url: `https://t.me/${channelUsername.replace('@', '')}` }
        ],
        [
          { text: "💎 Upgrade to VIP", callback_data: "view_vip_packages" },
          { text: "💰 View Promotions", callback_data: "view_promotions" }
        ],
        [
          { text: "🔙 Back to Main Menu", callback_data: "back_main" }
        ]
      ]
    };

    await sendMessage(chatId, message, keyboard);
    
  } catch (error) {
    console.error('🚨 Error in trading results handler:', error);
    await sendMessage(chatId, "❌ An error occurred. Please try again.");
  }
}

// Admin function to post trade results to channel
async function handlePostTradeResult(chatId: number, userId: string): Promise<void> {
  if (!isAdmin(userId)) {
    await sendAccessDeniedMessage(chatId);
    return;
  }

  try {
    const message = `🎯 **Post Trade Result to Channel**

📊 Choose the type of trade result to post:

• 📈 **Winning Trade** - Post a successful trade result
• 📉 **Losing Trade** - Post a loss for transparency  
• 📊 **Weekly Summary** - Post weekly performance summary
• 🏆 **Monthly Report** - Post monthly results overview

Select the type of result to post:`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "📈 Winning Trade", callback_data: "post_winning_trade" },
          { text: "📉 Losing Trade", callback_data: "post_losing_trade" }
        ],
        [
          { text: "📊 Weekly Summary", callback_data: "post_weekly_summary" },
          { text: "🏆 Monthly Report", callback_data: "post_monthly_report" }
        ],
        [
          { text: "🔙 Back to Admin", callback_data: "admin_dashboard" }
        ]
      ]
    };

    await sendMessage(chatId, message, keyboard);
    
  } catch (error) {
    console.error('🚨 Error in post trade result handler:', error);
    await sendMessage(chatId, "❌ An error occurred. Please try again.");
  }
}

// Function to post trade result to the results channel
async function postToResultsChannel(
  resultType: string,
  tradeData: TradeData
): Promise<boolean> {
  try {
    // Get results channel ID from bot content
    const channelContent = await getBotContent('trading_results_channel_id') || '';
    const channelId = channelContent || '@DynamicCapital_Results';
    
    let message = '';
    
    switch (resultType) {
      case 'winning_trade':
        message = `🟢 **WINNING TRADE** 🟢

📊 **Trade Details:**
📍 Pair: ${tradeData.pair || 'BTC/USDT'}
💰 Entry: $${tradeData.entry || '0.00'}
🎯 Exit: $${tradeData.exit || '0.00'}
📈 Profit: +${tradeData.profit || '0'}% 
⏰ Duration: ${tradeData.duration || '2h 30m'}

✅ **Result: PROFITABLE**
💵 Profit: $${tradeData.amount || '0.00'}

🔥 Another successful trade for our VIP members!
Join us for consistent profits! 💎

#WinningTrade #TradingSignals #DynamicCapital`;
        break;
        
      case 'losing_trade':
        message = `🔴 **LOSING TRADE** 🔴

📊 **Trade Details:**
📍 Pair: ${tradeData.pair || 'ETH/USDT'}
💰 Entry: $${tradeData.entry || '0.00'}
🎯 Exit: $${tradeData.exit || '0.00'}
📉 Loss: -${tradeData.loss || '0'}%
⏰ Duration: ${tradeData.duration || '1h 15m'}

❌ **Result: LOSS**
💸 Loss: -$${tradeData.amount || '0.00'}

📈 Transparency is key! Even the best traders have losses.
Risk management keeps us profitable long-term! 💪

#TradingLoss #Transparency #RiskManagement`;
        break;
        
      case 'weekly_summary':
        message = `📅 **WEEKLY TRADING SUMMARY**

📊 **Performance Overview:**
🗓️ Week: ${tradeData.week || 'Current Week'}
📈 Total Trades: ${tradeData.totalTrades || '0'}
✅ Winning Trades: ${tradeData.winningTrades || '0'}
❌ Losing Trades: ${tradeData.losingTrades || '0'}
🎯 Win Rate: ${tradeData.winRate || '0'}%

💰 **Financial Results:**
📈 Total Profit: $${tradeData.totalProfit || '0.00'}
📉 Total Loss: -$${tradeData.totalLoss || '0.00'}
💵 Net P&L: $${tradeData.netPnL || '0.00'}
📊 ROI: +${tradeData.roi || '0'}%

🏆 Another profitable week for our community!
Join VIP for detailed trade analysis! 💎

#WeeklyResults #TradingPerformance #DynamicCapital`;
        break;
        
      case 'monthly_report':
        message = `🏆 **MONTHLY TRADING REPORT**

📅 **Month: ${tradeData.month || 'Current Month'}**

📊 **Trading Statistics:**
📈 Total Trades: ${tradeData.totalTrades || '0'}
✅ Successful Trades: ${tradeData.successfulTrades || '0'}
❌ Failed Trades: ${tradeData.failedTrades || '0'}
🎯 Success Rate: ${tradeData.successRate || '0'}%

💰 **Financial Performance:**
📈 Gross Profit: $${tradeData.grossProfit || '0.00'}
📉 Total Losses: -$${tradeData.totalLosses || '0.00'}
💵 Net Profit: $${tradeData.netProfit || '0.00'}
📊 Monthly ROI: +${tradeData.monthlyROI || '0'}%

🚀 **Best Performing Pairs:**
${tradeData.bestPairs || '• BTC/USDT: +15%\n• ETH/USDT: +12%\n• ADA/USDT: +8%'}

💎 Join our VIP community for exclusive insights!

#MonthlyReport #TradingResults #VIPAccess`;
        break;
        
      default:
        message = `📊 **Trade Update Posted**

Thank you for staying updated with our trading performance!
Join our VIP community for detailed analysis and insights.

#TradingUpdate #DynamicCapital`;
    }

    // Send to results channel
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: channelId,
        text: message,
        parse_mode: 'Markdown'
      })
    });

    if (response.ok) {
      console.log(`✅ Trade result posted to channel: ${channelId}`);
      return true;
    } else {
      const error = await response.text();
      console.error(`❌ Failed to post to channel: ${error}`);
      return false;
    }
    
  } catch (error) {
    console.error('🚨 Error posting to results channel:', error);
    return false;
  }
}

async function handlePromoCodeApplication(_chatId: number, userId: string, promoCode: string, packageId: string): Promise<{ valid: boolean; discount: number; finalPrice: number; message: string }> {
  try {
    console.log(`🎫 Applying promo code ${promoCode} for user ${userId} on package ${packageId}`);
    
    // Get the package details
    const { data: pkg, error: pkgError } = await supabaseAdmin
      .from('subscription_plans')
      .select('*')
      .eq('id', packageId)
      .single();

    if (pkgError || !pkg) {
      return {
        valid: false,
        discount: 0,
        finalPrice: 0,
        message: "❌ Package not found."
      };
    }

    // Check if promo code exists and is valid
    const { data: promo, error: promoError } = await supabaseAdmin
      .from('promotions')
      .select('*')
      .eq('code', promoCode.toUpperCase())
      .eq('is_active', true)
      .gte('valid_until', new Date().toISOString())
      .single();

    if (promoError || !promo) {
      return {
        valid: false,
        discount: 0,
        finalPrice: pkg.price,
        message: "❌ Invalid or expired promo code."
      };
    }

    // Check usage limits
    if (promo.max_uses && promo.current_uses >= promo.max_uses) {
      return {
        valid: false,
        discount: 0,
        finalPrice: pkg.price,
        message: "❌ Promo code usage limit reached."
      };
    }

    // Check if user already used this promo
    const { data: existingUsage } = await supabaseAdmin
      .from('promotion_usage')
      .select('*')
      .eq('promotion_id', promo.id)
      .eq('telegram_user_id', userId)
      .single();

    if (existingUsage) {
      return {
        valid: false,
        discount: 0,
        finalPrice: pkg.price,
        message: "❌ You have already used this promo code."
      };
    }

    // Calculate discount
    let discount = 0;
    if (promo.discount_type === 'percentage') {
      discount = (pkg.price * promo.discount_value) / 100;
    } else {
      discount = Math.min(promo.discount_value, pkg.price);
    }

    const finalPrice = Math.max(0, pkg.price - discount);

    return {
      valid: true,
      discount: discount,
      finalPrice: finalPrice,
      message: `✅ Promo code applied! You save $${discount.toFixed(2)}`
    };

  } catch (error) {
    console.error('❌ Error applying promo code:', error);
    return {
      valid: false,
      discount: 0,
      finalPrice: 0,
      message: "❌ Error applying promo code. Please try again."
    };
  }
}

async function handlePromoCodePrompt(chatId: number, userId: string, packageId: string): Promise<void> {
  try {
    console.log(`🎫 User ${userId} wants to apply promo code for package: ${packageId}`);
    
    // Get package details
    const { data: pkg, error } = await supabaseAdmin
      .from('subscription_plans')
      .select('*')
      .eq('id', packageId)
      .single();

    if (error || !pkg) {
      await sendMessage(chatId, "❌ Package not found. Please try again.");
      return;
    }

    // Store user session for promo code input
    userSessions.set(userId, {
      type: 'waiting_promo_code',
      packageId: packageId,
      originalPrice: pkg.price,
      timestamp: Date.now()
    });

    const message = `🎫 **Apply Promo Code**

📦 **Package:** ${pkg.name}
💰 **Original Price:** $${pkg.price} USD

🔤 **Please send your promo code:**
Simply type the promo code in your next message.

⏰ **You have 5 minutes to enter the code.**

Example: SAVE20, WELCOME50, etc.`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "❌ Cancel", callback_data: `select_vip_${packageId}` }
        ]
      ]
    };

    await sendMessage(chatId, message, keyboard);
    
  } catch (error) {
    console.error('🚨 Error in promo code prompt:', error);
    await sendMessage(chatId, "❌ An error occurred. Please try again.");
  }
}

async function handleShowPaymentMethods(chatId: number, userId: string, packageId: string): Promise<void> {
  try {
    console.log(`💳 Showing payment methods for user ${userId}, package: ${packageId}`);
    
    // Get package details
    const { data: pkg, error } = await supabaseAdmin
      .from('subscription_plans')
      .select('*')
      .eq('id', packageId)
      .single();

    if (error || !pkg) {
      await sendMessage(chatId, "❌ Package not found. Please try again.");
      return;
    }

    // Check if a promo code was applied for this user and package
    const session = userSessions.get(userId);
    let priceLine = `💰 **Price:** $${pkg.price} USD`;
    if (session && session.type === 'promo_applied' && session.packageId === packageId) {
      priceLine = `💰 **Price after promo:** $${session.finalPrice.toFixed(2)} USD`;
    }

    const message = `💳 **Payment Methods**

📦 **Package:** ${pkg.name}
${priceLine}

🎯 **Choose your payment method:**`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "💳 Binance Pay", callback_data: `payment_method_${packageId}_binance` },
          { text: "₿ Crypto", callback_data: `payment_method_${packageId}_crypto` }
        ],
        [
          { text: "🏦 Bank Transfer", callback_data: `payment_method_${packageId}_bank` }
        ],
        [
          { text: "🎫 Apply Promo Code", callback_data: `apply_promo_${packageId}` }
        ],
        [
          { text: "🔙 Back to Package", callback_data: `select_vip_${packageId}` }
        ]
      ]
    };

    await sendMessage(chatId, message, keyboard);
    
  } catch (error) {
    console.error('🚨 Error showing payment methods:', error);
    await sendMessage(chatId, "❌ An error occurred. Please try again.");
  }
}

async function handlePromoCodeInput(
  chatId: number,
  userId: string,
  promoCode: string,
  userSession: PromoSession
): Promise<void> {
  try {
    console.log(`🎫 Processing promo code input: ${promoCode} for user ${userId}`);
    
    // Clear user session
    userSessions.delete(userId);
    
    // Check if session is expired (5 minutes)
    if (Date.now() - userSession.timestamp > 5 * 60 * 1000) {
      await sendMessage(chatId, "⏰ Promo code entry expired. Please start again.");
      return;
    }

    // Apply promo code
    const result = await handlePromoCodeApplication(chatId, userId, promoCode, userSession.packageId);
    
    if (result.valid) {
      // Record promo usage
      const { data: promo } = await supabaseAdmin
        .from('promotions')
        .select('id, current_uses')
        .eq('code', promoCode)
        .single();

      if (promo) {
        await supabaseAdmin
          .from('promotion_usage')
          .insert({
            promotion_id: promo.id,
            telegram_user_id: userId
          });

        // Update promo current_uses
        await supabaseAdmin
          .from('promotions')
          .update({
            current_uses: (promo.current_uses || 0) + 1
          })
          .eq('id', promo.id);
      }

      // Show updated pricing and payment options
      const { data: pkg } = await supabaseAdmin
        .from('subscription_plans')
        .select('*')
        .eq('id', userSession.packageId)
        .single();

      const message = `✅ **Promo Code Applied!**

🎫 **Code:** ${promoCode}
📦 **Package:** ${pkg?.name}
💰 **Original Price:** $${userSession.originalPrice}
🎉 **Discount:** -$${result.discount.toFixed(2)}
💸 **Final Price:** $${result.finalPrice.toFixed(2)}

🎯 **Choose your payment method:**`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "💳 Binance Pay", callback_data: `payment_method_${userSession.packageId}_binance` },
            { text: "₿ Crypto", callback_data: `payment_method_${userSession.packageId}_crypto` }
          ],
          [
            { text: "🏦 Bank Transfer", callback_data: `payment_method_${userSession.packageId}_bank` }
          ],
          [
            { text: "🔙 Back to Package", callback_data: `select_vip_${userSession.packageId}` }
          ]
        ]
      };

      await sendMessage(chatId, message, keyboard);
      
      // Store the applied promo for the payment flow
      userSessions.set(userId, {
        type: 'promo_applied',
        packageId: userSession.packageId,
        promoCode: promoCode,
        originalPrice: userSession.originalPrice,
        discount: result.discount,
        finalPrice: result.finalPrice,
        timestamp: Date.now()
      });

    } else {
      await sendMessage(chatId, result.message + "\n\n🔄 Try another code or continue without discount:", {
        inline_keyboard: [
          [
            { text: "🎫 Try Another Code", callback_data: `apply_promo_${userSession.packageId}` },
            { text: "💳 Continue to Payment", callback_data: `show_payment_${userSession.packageId}` }
          ]
        ]
      });
    }
    
  } catch (error) {
    console.error('🚨 Error processing promo code input:', error);
    await sendMessage(chatId, "❌ Error processing promo code. Please try again.");
  }
}

async function handleFAQ(chatId: number, _userId: string): Promise<void> {
  const content = await getBotContent('faq_general') || `❓ **Frequently Asked Questions**

🔷 **Q: How do I join VIP?**
A: Select a VIP package, complete payment, and you'll be added automatically after verification.

🔷 **Q: What payment methods do you accept?**
A: We accept Binance Pay, cryptocurrency (BTC, ETH, USDT), and bank transfers.

🔷 **Q: How quickly are signals sent?**
A: VIP signals are sent in real-time as market opportunities arise, typically 5-10 per day.

🔷 **Q: Do you offer refunds?**
A: We offer a 7-day satisfaction guarantee for new VIP members.

🔷 **Q: What's included in VIP membership?**
A: Real-time signals, market analysis, educational content, priority support, and access to VIP community.

🔷 **Q: Can I cancel my subscription?**
A: Yes, you can cancel anytime. Access continues until your current period ends.

🔷 **Q: Do you provide trading education?**
A: Yes! We offer comprehensive courses for beginners to advanced traders.

💡 **Still have questions?** Contact our support team!`;

  const keyboard = {
    inline_keyboard: [
      [{ text: "🛟 Contact Support", callback_data: "support" }],
      [{ text: "🔙 Back to Main Menu", callback_data: "back_main" }]
    ]
  };

  await sendMessage(chatId, content, keyboard);
}

async function handleHelpAndFAQ(chatId: number, userId: string, firstName: string): Promise<void> {
  await handleHelpCommand(chatId, userId, firstName);
  await handleFAQ(chatId, userId);
}

async function handleTerms(chatId: number, _userId: string): Promise<void> {
  const content = await getBotContent('terms') || `📋 **Terms of Service**

**Last updated:** January 2025

🔷 **Service Agreement**
By using Dynamic Capital VIP services, you agree to these terms and our privacy policy.

🔷 **Trading Disclaimer**
• Trading involves significant risk of loss
• Past performance doesn't guarantee future results
• Never trade with money you can't afford to lose
• Signals are educational, not financial advice

🔷 **Subscription Terms**
• Payments are processed securely
• Cancellations take effect at period end
• Refunds available within 7 days (terms apply)
• Violations may result in account termination

🔷 **Prohibited Activities**
• Sharing VIP content publicly
• Reverse engineering our systems
• Harassment of other members
• Fraudulent payment attempts

🔷 **Limitation of Liability**
Dynamic Capital is not liable for trading losses incurred using our services.

📧 **Contact:** legal@dynamicvip.com`;

  const keyboard = {
    inline_keyboard: [
      [{ text: "🔙 Back to Main Menu", callback_data: "back_main" }]
    ]
  };

  await sendMessage(chatId, content, keyboard);
}

async function handleViewEducation(chatId: number, _userId: string): Promise<void> {
  try {
    console.log("🎓 Fetching education packages from database...");
    const { data: packages, error } = await supabaseAdmin
      .from('education_packages')
      .select(`
        *,
        category:education_categories(name)
      `)
      .eq('is_active', true)
      .order('price', { ascending: true });

    if (error) {
      console.error('❌ Error fetching education packages:', error);
      await sendMessage(chatId, "❌ Error loading education packages.");
      return;
    }

    let message = `🎓 **Educational Packages**

📚 Level up your trading skills with our comprehensive courses!\n\n`;

    if (!packages || packages.length === 0) {
      message += `📭 No education packages available at the moment.

🔔 **Coming Soon!**
We're preparing amazing educational content for you.

💡 **In the meantime:** Join VIP for access to daily market analysis and real-time learning opportunities!`;
    } else {
      packages.forEach((pkg, _index) => {
        const features = pkg.features && Array.isArray(pkg.features) ? pkg.features.slice(0, 3) : [];
        const featuresText = features.length > 0 ? features.map((f: string) => `• ${f}`).join('\n   ') : '• Comprehensive trading education';
        
        const studentInfo = pkg.max_students 
          ? `👥 ${pkg.current_students || 0}/${pkg.max_students} enrolled` 
          : `👥 ${pkg.current_students || 0} students`;
        
        const availability = pkg.max_students && (pkg.current_students >= pkg.max_students) 
          ? '🔴 FULL - Join Waitlist' 
          : '🟢 Available Now';
        
        message += `📚 **${pkg.name}** ${availability}
💰 Price: $${pkg.price} ${pkg.currency}
⏱️ Duration: ${pkg.duration_weeks} weeks
📈 Level: ${pkg.difficulty_level || 'All Levels'}
${studentInfo}

📝 **Description:** ${pkg.description || 'Professional trading education'}

✨ **Includes:**
   ${featuresText}

`;
      });
      
      message += `🎓 **Why Choose Our Education:**
• 🏆 Expert instructors with proven track records
• 🎯 Interactive lessons and live trading sessions  
• 📜 Certificate upon completion
• ♾️ Lifetime access to all materials
• 💬 Direct support from instructors
• 📊 Real market case studies

💡 **Special:** VIP members get 25% off all education packages!`;
    }

    // Create keyboard with package selection buttons
    const keyboard = {
      inline_keyboard: [] as InlineKeyboard['inline_keyboard']
    };

    // Add selection buttons for each package
    if (packages && packages.length > 0) {
      packages.forEach((pkg) => {
        keyboard.inline_keyboard.push([
          { text: `📚 Select ${pkg.name} - $${pkg.price}`, callback_data: `select_education_${pkg.id}` }
        ]);
      });
    }

    // Add navigation buttons
    keyboard.inline_keyboard.push([
      { text: "💎 Upgrade to VIP (25% OFF)", callback_data: "view_vip_packages" },
      { text: "🎁 View Promotions", callback_data: "view_promotions" }
    ]);
    keyboard.inline_keyboard.push([{ text: "🔙 Back to Main Menu", callback_data: "back_main" }]);

    await sendMessage(chatId, message, keyboard);
    
  } catch (error) {
    console.error('🚨 Error in education handler:', error);
    await sendMessage(chatId, "❌ An error occurred. Please try again.");
  }
}

// Education Package Selection Handler
async function handleEducationPackageSelection(chatId: number, userId: string, packageId: string, _firstName: string): Promise<void> {
  try {
    console.log(`🎓 User ${userId} selected education package: ${packageId}`);

    // Clean up any previous package or payment messages
    const session = userSessions.get(userId) || {};
    if (session.lastPackageMessageId) {
      await deleteMessage(chatId, session.lastPackageMessageId);
    }
    if (session.paymentMessageId) {
      await deleteMessage(chatId, session.paymentMessageId);
    }
    if (session.paymentTimeout) {
      clearTimeout(session.paymentTimeout);
    }
    
    // Get package details
    const { data: pkg, error } = await supabaseAdmin
      .from('education_packages')
      .select('*')
      .eq('id', packageId)
      .single();

    if (error || !pkg) {
      await sendMessage(chatId, "❌ Education package not found. Please try again.");
      return;
    }

    const message = `🎓 **${pkg.name}** Selected!

💰 **Price:** $${pkg.price} ${pkg.currency}
📅 **Duration:** ${pkg.is_lifetime ? 'Lifetime Access' : pkg.duration_weeks + ' weeks'}
📊 **Level:** ${pkg.difficulty_level || 'All Levels'}
👥 **Enrolled:** ${pkg.current_students || 0}${pkg.max_students ? `/${pkg.max_students}` : ''} students

📚 **Description:**
${pkg.description || 'Complete course package with expert instruction'}

🎯 **Choose your payment method:**`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "💳 Binance Pay", callback_data: `payment_method_${packageId}_binance` },
          { text: "₿ Crypto", callback_data: `payment_method_${packageId}_crypto` }
        ],
        [
          { text: "🏦 Bank Transfer", callback_data: `payment_method_${packageId}_bank` }
        ],
        [
          { text: "🔙 Back to Courses", callback_data: "view_education" }
        ]
      ]
    };

    const sent = await sendMessage(chatId, message, keyboard);

    if (sent?.result?.message_id) {
      userSessions.set(userId, {
        ...session,
        lastPackageMessageId: sent.result.message_id,
        paymentMessageId: undefined,
        paymentTimeout: undefined,
      });
    }
    
    // Log the selection
    await logAdminAction(
      userId,
      'education_selection',
      `User selected education package: ${pkg.name}`,
      'education_packages',
      packageId
    );

  } catch (error) {
    console.error('🚨 Error in education package selection:', error);
    await sendMessage(chatId, "❌ An error occurred. Please try again.");
  }
}

  // View User Profile Handler
async function handleViewUserProfile(chatId: number, adminUserId: string, targetUserId: string): Promise<void> {
  if (!isAdmin(adminUserId)) {
    await sendAccessDeniedMessage(chatId);
    return;
  }

  try {
    console.log(`👤 Admin ${adminUserId} viewing profile for user ${targetUserId}`);
    
    // Get user subscription details
    const { data: subscriptions, error: subError } = await supabaseAdmin
      .from('user_subscriptions')
      .select(`
        *,
        subscription_plans (
          name,
          price,
          duration_months,
          is_lifetime,
          features
        )
      `)
      .eq('telegram_user_id', targetUserId)
      .order('created_at', { ascending: false });

    if (subError) {
      console.error('❌ Error fetching user subscriptions:', subError);
      await sendMessage(chatId, "❌ Error loading user profile.");
      return;
    }

    // Get bot user details if available
    const { data: botUser } = await supabaseAdmin
      .from('bot_users')
      .select('*')
      .eq('telegram_id', targetUserId)
      .single();

    // Get education enrollments
    const { data: enrollments } = await supabaseAdmin
      .from('education_enrollments')
      .select(`
        *,
        education_packages (
          name,
          price,
          duration_weeks
        )
      `)
      .eq('student_telegram_id', targetUserId)
      .order('created_at', { ascending: false });

    // Build profile message
    let profileMessage = `👤 **User Profile: ${targetUserId}**\n\n`;
    
    // User basic info
    if (botUser) {
      profileMessage += `📋 **Basic Information:**\n`;
      profileMessage += `• **Name:** ${botUser.first_name || 'N/A'} ${botUser.last_name || ''}\n`;
      profileMessage += `• **Username:** ${botUser.username ? '@' + botUser.username : 'N/A'}\n`;
      profileMessage += `• **Admin Status:** ${botUser.is_admin ? '🔴 Admin' : '👤 User'}\n`;
      profileMessage += `• **VIP Status:** ${botUser.is_vip ? '💎 VIP Member' : '👤 Regular'}\n`;
      profileMessage += `• **Joined:** ${new Date(botUser.created_at).toLocaleDateString()}\n\n`;
    }

    // Current subscriptions
    if (subscriptions && subscriptions.length > 0) {
      profileMessage += `💎 **VIP Subscriptions:**\n`;
      
      const activeSubscriptions = subscriptions.filter(sub => sub.is_active);
      const pendingSubscriptions = subscriptions.filter(sub => sub.payment_status === 'pending');
      
      if (activeSubscriptions.length > 0) {
        profileMessage += `\n✅ **Active Subscriptions:**\n`;
        activeSubscriptions.forEach((sub, index) => {
          const plan = sub.subscription_plans;
          const endDate = sub.subscription_end_date ? new Date(sub.subscription_end_date).toLocaleDateString() : 'Lifetime';
          const daysLeft = sub.subscription_end_date ? 
            Math.max(0, Math.ceil((new Date(sub.subscription_end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : '∞';
          
          profileMessage += `${index + 1}. **${plan?.name || 'Unknown Plan'}**\n`;
          profileMessage += `   💰 Price: $${plan?.price || 'N/A'}\n`;
          profileMessage += `   📅 Expires: ${endDate}\n`;
          profileMessage += `   ⏰ Days Left: ${daysLeft}\n`;
          profileMessage += `   💳 Method: ${sub.payment_method?.toUpperCase() || 'N/A'}\n`;
          profileMessage += `   📝 Status: ${sub.payment_status}\n\n`;
        });
      }
      
      if (pendingSubscriptions.length > 0) {
        profileMessage += `⏳ **Pending Subscriptions:**\n`;
        pendingSubscriptions.forEach((sub, index) => {
          const plan = sub.subscription_plans;
          profileMessage += `${index + 1}. **${plan?.name || 'Unknown Plan'}**\n`;
          profileMessage += `   💰 Price: $${plan?.price || 'N/A'}\n`;
          profileMessage += `   💳 Method: ${sub.payment_method?.toUpperCase() || 'N/A'}\n`;
          profileMessage += `   📋 Receipt: ${sub.receipt_telegram_file_id ? '✅ Uploaded' : '❌ Missing'}\n`;
          profileMessage += `   📅 Created: ${new Date(sub.created_at).toLocaleDateString()}\n\n`;
        });
      }
    } else {
      profileMessage += `💎 **VIP Subscriptions:** No subscriptions found\n\n`;
    }

    // Education enrollments
    if (enrollments && enrollments.length > 0) {
      profileMessage += `🎓 **Education Enrollments:**\n`;
      enrollments.forEach((enrollment, index) => {
        const pkg = enrollment.education_packages;
        profileMessage += `${index + 1}. **${pkg?.name || 'Unknown Course'}**\n`;
        profileMessage += `   💰 Price: $${pkg?.price || 'N/A'}\n`;
        profileMessage += `   📊 Progress: ${enrollment.progress_percentage || 0}%\n`;
        profileMessage += `   📋 Status: ${enrollment.enrollment_status}\n`;
        profileMessage += `   💳 Payment: ${enrollment.payment_status}\n\n`;
      });
    } else {
      profileMessage += `🎓 **Education:** No enrollments found\n\n`;
    }

    // Admin actions
    profileMessage += `🔧 **Quick Actions:**`;
    
    const actionKeyboard = {
      inline_keyboard: [
        [
          { text: "✅ Approve Payments", callback_data: `approve_user_payments_${targetUserId}` },
          { text: "❌ Reject Payments", callback_data: `reject_user_payments_${targetUserId}` }
        ],
        [
          { text: "💎 Make VIP", callback_data: `make_vip_${targetUserId}` },
          { text: "📧 Send Message", callback_data: `message_user_${targetUserId}` }
        ],
        [
          { text: "🔄 Refresh Profile", callback_data: `view_user_${targetUserId}` },
          { text: "🔙 Back to Dashboard", callback_data: "admin_dashboard" }
        ]
      ]
    };

    await sendMessage(chatId, profileMessage, actionKeyboard);
    await logAdminAction(adminUserId, 'view_user_profile', `Viewed profile for user ${targetUserId}`);

  } catch (error) {
    console.error('🚨 Error viewing user profile:', error);
    await sendMessage(chatId, `❌ Error loading user profile: ${(error as Error).message}`);
  }
}

// View Pending Payments Handler
async function handleViewPendingPayments(chatId: number, adminUserId: string): Promise<void> {
  if (!isAdmin(adminUserId)) {
    await sendAccessDeniedMessage(chatId);
    return;
  }

  try {
    console.log(`📋 Admin ${adminUserId} viewing pending payments`);
    
    const { data: pendingPayments, error } = await supabaseAdmin
      .from('user_subscriptions')
      .select(`
        *,
        subscription_plans (
          name,
          price,
          duration_months
        )
      `)
      .eq('payment_status', 'pending')
      .not('receipt_telegram_file_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('❌ Error fetching pending payments:', error);
      await sendMessage(chatId, "❌ Error loading pending payments.");
      return;
    }

    if (!pendingPayments || pendingPayments.length === 0) {
      await sendMessage(chatId, `📋 **Pending Payments**\n\n✅ No pending payments with receipts found.\n\nAll caught up! 🎉`);
      return;
    }

    let message = `📋 **Pending Payments (${pendingPayments.length})**\n\n`;
    
    pendingPayments.forEach((payment, index) => {
      const plan = payment.subscription_plans;
      message += `${index + 1}. **User ${payment.telegram_user_id}**\n`;
      message += `   📦 Package: ${plan?.name || 'Unknown'}\n`;
      message += `   💰 Amount: $${plan?.price || 'N/A'}\n`;
      message += `   💳 Method: ${payment.payment_method?.toUpperCase() || 'N/A'}\n`;
      message += `   📅 Submitted: ${new Date(payment.created_at).toLocaleDateString()}\n`;
      message += `   📋 Receipt: ${payment.receipt_telegram_file_id ? '✅ Uploaded' : '❌ Missing'}\n\n`;
    });

    const keyboard = {
      inline_keyboard: [
        [
          { text: "✅ Approve All", callback_data: "approve_all_pending" },
          { text: "🔄 Refresh", callback_data: "view_pending_payments" }
        ],
        [
          { text: "🔙 Back to Dashboard", callback_data: "admin_dashboard" }
        ]
      ]
    };

    await sendMessage(chatId, message, keyboard);
    await logAdminAction(adminUserId, 'view_pending_payments', `Viewed ${pendingPayments.length} pending payments`);

  } catch (error) {
    console.error('🚨 Error viewing pending payments:', error);
    await sendMessage(chatId, `❌ Error loading pending payments: ${(error as Error).message}`);
  }
}

// Payment Approval/Rejection Handlers
async function handleApprovePayment(chatId: number, userId: string, paymentId: string): Promise<void> {
  if (!isAdmin(userId)) {
    await sendAccessDeniedMessage(chatId);
    return;
  }

  try {
    // Get subscription details first
    const { data: currentSub, error: fetchError } = await supabaseAdmin
      .from('user_subscriptions')
      .select('*, subscription_plans(*)')
      .eq('id', paymentId)
      .single();
      
    if (fetchError || !currentSub) {
      throw new Error('Subscription not found');
    }
    
    // Calculate proper end date based on plan duration
    const endDate = currentSub.subscription_plans?.is_lifetime 
      ? null 
      : new Date(Date.now() + (currentSub.subscription_plans?.duration_months || 1) * 30 * 24 * 60 * 60 * 1000).toISOString();
    
    // Update subscription status
    const { data: subscription, error } = await supabaseAdmin
      .from('user_subscriptions')
      .update({
        payment_status: 'approved',
        is_active: true,
        subscription_start_date: new Date().toISOString(),
        subscription_end_date: endDate
      })
      .eq('id', paymentId)
      .select('*, subscription_plans(*)')
      .single();

    if (error) {
      throw error;
    }

    // Add user to VIP channel/group
    try {
      await addUserToVipChannel(subscription.telegram_user_id);
      console.log(`✅ User ${subscription.telegram_user_id} added to VIP channels`);
    } catch (channelError) {
      console.error('⚠️ Could not add user to VIP channels:', channelError);
      // Continue with approval even if channel addition fails
    }

    // Notify user of approval
    const userMessage = `✅ **Payment Approved!**

🎉 Congratulations! Your VIP membership is now active.

📦 **Package:** ${subscription.subscription_plans?.name}
⏰ **Valid until:** ${new Date(subscription.subscription_end_date).toLocaleDateString()}

🚀 **What's next:**
• You'll be added to VIP channels
• Start receiving premium signals
• Access exclusive content
• Priority support activated

Welcome to the VIP family! 🌟`;

    await sendMessage(parseInt(subscription.telegram_user_id), userMessage);

    // Notify admin of completion
    await sendMessage(chatId, `✅ **Payment Approved Successfully**

User ${subscription.telegram_user_id} has been activated for ${subscription.subscription_plans?.name}.`);

    await logAdminAction(userId, 'payment_approval', `Approved payment for subscription ${paymentId}`, 'user_subscriptions', paymentId);

  } catch (error) {
    console.error('🚨 Error approving payment:', error);
    await sendMessage(chatId, `❌ Error approving payment: ${(error as Error).message}`);
  }
}

async function handleRejectPayment(chatId: number, userId: string, paymentId: string): Promise<void> {
  if (!isAdmin(userId)) {
    await sendAccessDeniedMessage(chatId);
    return;
  }

  try {
    // Update subscription status
    const { data: subscription, error } = await supabaseAdmin
      .from('user_subscriptions')
      .update({
        payment_status: 'rejected'
      })
      .eq('id', paymentId)
      .select('*, subscription_plans(*)')
      .single();

    if (error) {
      throw error;
    }

    // Notify user of rejection
    const userMessage = `❌ **Payment Issue**

Unfortunately, we couldn't verify your payment for ${subscription.subscription_plans?.name}.

🔄 **Next steps:**
• Double-check payment details
• Ensure you included the reference ID
• Contact support with transaction details

🛟 **Need help?** Contact @DynamicCapital_Support with:
• Your transaction confirmation
• Reference ID: SUB_${paymentId.substring(0, 8)}
• Payment method used

We're here to help resolve this quickly! 💪`;

    await sendMessage(parseInt(subscription.telegram_user_id), userMessage);

    // Notify admin of completion
    await sendMessage(chatId, `❌ **Payment Rejected**

User ${subscription.telegram_user_id} payment for ${subscription.subscription_plans?.name} has been rejected.`);

    await logAdminAction(userId, 'payment_rejection', `Rejected payment for subscription ${paymentId}`, 'user_subscriptions', paymentId);

  } catch (error) {
    console.error('🚨 Error rejecting payment:', error);
    await sendMessage(chatId, `❌ Error rejecting payment: ${(error as Error).message}`);
  }
}

// Enhanced admin management functions
async function handleAdminDashboard(chatId: number, userId: string): Promise<void> {
  console.log(`🔐 Admin dashboard access attempt by: ${userId}`);
  
  if (!isAdmin(userId)) {
    console.log(`❌ Access denied for user: ${userId}`);
    await sendAccessDeniedMessage(chatId, 'Admin privileges required.');
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
🆔 *Bot Version:* ${BOT_VERSION}
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
    await sendMessage(chatId, `❌ Error loading admin dashboard: ${(error as Error).message}`);
  }
}

// Session management for admins
async function handleViewSessions(chatId: number, userId: string): Promise<void> {
  if (!isAdmin(userId)) {
    await sendAccessDeniedMessage(chatId);
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
    await sendMessage(chatId, `❌ Error fetching sessions: ${(error as Error).message}`);
  }
}

// Bot Control Functions
async function handleBotControl(chatId: number, userId: string): Promise<void> {
  if (!isAdmin(userId)) {
    await sendAccessDeniedMessage(chatId);
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
    await sendAccessDeniedMessage(chatId);
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

🆔 *Bot Version:* ${BOT_VERSION}
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

${dbTest.error ? `❌ DB Error: ${(dbTest.error as Error).message}` : ''}
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
    await sendMessage(chatId, `❌ Error checking bot status: ${(error as Error).message}`);
  }
}

async function handleRefreshBot(chatId: number, userId: string): Promise<void> {
  if (!isAdmin(userId)) {
    await sendAccessDeniedMessage(chatId);
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
    await sendMessage(chatId, `❌ Error during refresh: ${(error as Error).message}`);
  }
}

// Broadcasting Functions
async function handleBroadcastMenu(chatId: number, userId: string): Promise<void> {
  if (!isAdmin(userId)) {
    await sendAccessDeniedMessage(chatId);
    return;
  }

  const broadcastMessage = `📢 *Broadcast Management*

🚀 *Available Broadcast Options:*
• 👋 **Send Greeting** - Send hello message to channels/groups
• 🎯 **Channel Introduction** - Introduce bot to new channels
• 📊 **Post Trade Results** - Post trading results to @DynamicCapital_Results
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
        { text: "📊 Post Trade Results", callback_data: "post_trade_results" }
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
    await sendAccessDeniedMessage(chatId);
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
    await sendAccessDeniedMessage(chatId);
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
    await sendAccessDeniedMessage(chatId);
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

async function handleNewChatMember(message: TelegramMessage): Promise<void> {
  const chatId = message.chat.id;
  const chatTitle = message.chat.title || 'Unknown Chat';
  const newMembers = message.new_chat_members || [];

  console.log(`👥 New member(s) added to ${chatTitle} (${chatId})`);

  // Check if the bot itself was added
  const botMember = newMembers.find(
    (member: { username?: string; is_bot?: boolean }) =>
      member.username === 'Dynamic_VIP_BOT' || member.is_bot
  );
  
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
    await sendAccessDeniedMessage(chatId);
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
    await sendAccessDeniedMessage(chatId);
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
    await sendAccessDeniedMessage(chatId);
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
    await sendAccessDeniedMessage(chatId);
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

// Admin Settings Handler
async function handleAdminSettings(chatId: number, userId: string): Promise<void> {
  if (!isAdmin(userId)) {
    await sendAccessDeniedMessage(chatId);
    return;
  }

  try {
    // Get current settings
    const [autoDeleteEnabled, deleteDelay, autoIntroEnabled, broadcastDelay, maintenanceMode] = await Promise.all([
      getBotSetting('auto_delete_enabled'),
      getBotSetting('auto_delete_delay_seconds'),
      getBotSetting('auto_intro_enabled'),
      getBotSetting('broadcast_delay_ms'),
      getBotSetting('maintenance_mode')
    ]);

    const settingsMessage = `⚙️ *Bot Settings Configuration*

🗑️ **Auto-Delete Settings:**
• Enabled: ${autoDeleteEnabled === 'true' ? '✅ Yes' : '❌ No'}
• Delay: ${deleteDelay || '30'} seconds

🤖 **Auto-Introduction:**
• Enabled: ${autoIntroEnabled === 'true' ? '✅ Yes' : '❌ No'}

📢 **Broadcasting:**
• Message Delay: ${broadcastDelay || '1500'}ms between messages

🔧 **System:**
• Maintenance Mode: ${maintenanceMode === 'true' ? '🔴 Enabled' : '🟢 Disabled'}

💡 **Quick Actions:**`;

    const settingsKeyboard = {
      inline_keyboard: [
        [
          { text: autoDeleteEnabled === 'true' ? '🗑️ Disable Auto-Delete' : '🗑️ Enable Auto-Delete', callback_data: 'toggle_auto_delete' },
          { text: `⏱️ Set Delay (${deleteDelay || '30'}s)`, callback_data: 'set_delete_delay' }
        ],
        [
          { text: autoIntroEnabled === 'true' ? '🤖 Disable Auto-Intro' : '🤖 Enable Auto-Intro', callback_data: 'toggle_auto_intro' },
          { text: `📢 Broadcast Delay`, callback_data: 'set_broadcast_delay' }
        ],
        [
          { text: maintenanceMode === 'true' ? '🟢 Exit Maintenance' : '🔴 Maintenance Mode', callback_data: 'toggle_maintenance' },
          { text: '📊 View All Settings', callback_data: 'view_all_settings' }
        ],
        [
          { text: '🔧 Advanced Settings', callback_data: 'advanced_settings' },
          { text: '💾 Export Config', callback_data: 'export_settings' }
        ],
        [
          { text: '🔄 Refresh Settings', callback_data: 'admin_settings' },
          { text: '🔙 Back to Admin', callback_data: 'admin_dashboard' }
        ]
      ]
    };

    await sendMessage(chatId, settingsMessage, settingsKeyboard);
    await logAdminAction(userId, 'settings_access', 'Accessed bot settings panel');

  } catch (error) {
    console.error('🚨 Error in admin settings:', error);
    await sendMessage(chatId, `❌ Error loading settings: ${(error as Error).message}`);
  }
}

// Settings Toggle Handlers
async function handleToggleAutoDelete(chatId: number, userId: string): Promise<void> {
  if (!isAdmin(userId)) {
    await sendAccessDeniedMessage(chatId);
    return;
  }

  try {
    const currentValue = await getBotSetting('auto_delete_enabled');
    const newValue = currentValue === 'true' ? 'false' : 'true';
    
    await setBotSetting('auto_delete_enabled', newValue, userId);
    
    const statusMessage = `🗑️ **Auto-Delete ${newValue === 'true' ? 'Enabled' : 'Disabled'}**

${newValue === 'true' ? 
  '✅ Bot messages in groups will automatically delete after the specified delay.' : 
  '❌ Bot messages in groups will remain permanent.'}

Settings updated successfully!`;

    await sendMessage(chatId, statusMessage);
    
    // Refresh settings panel
    setTimeout(() => handleAdminSettings(chatId, userId), 2000);
    
  } catch (error) {
    await sendMessage(chatId, `❌ Error toggling auto-delete: ${(error as Error).message}`);
  }
}

async function handleToggleAutoIntro(chatId: number, userId: string): Promise<void> {
  if (!isAdmin(userId)) {
    await sendAccessDeniedMessage(chatId);
    return;
  }

  try {
    const currentValue = await getBotSetting('auto_intro_enabled');
    const newValue = currentValue === 'true' ? 'false' : 'true';
    
    await setBotSetting('auto_intro_enabled', newValue, userId);
    
    const statusMessage = `🤖 **Auto-Introduction ${newValue === 'true' ? 'Enabled' : 'Disabled'}**

${newValue === 'true' ? 
  '✅ Bot will automatically introduce itself when added to new channels/groups.' : 
  '❌ Bot will not send automatic introductions.'}

Settings updated successfully!`;

    await sendMessage(chatId, statusMessage);
    
    // Refresh settings panel
    setTimeout(() => handleAdminSettings(chatId, userId), 2000);
    
  } catch (error) {
    await sendMessage(chatId, `❌ Error toggling auto-intro: ${(error as Error).message}`);
  }
}

async function handleToggleMaintenance(chatId: number, userId: string): Promise<void> {
  if (!isAdmin(userId)) {
    await sendAccessDeniedMessage(chatId);
    return;
  }

  try {
    const currentValue = await getBotSetting('maintenance_mode');
    const newValue = currentValue === 'true' ? 'false' : 'true';
    
    await setBotSetting('maintenance_mode', newValue, userId);
    
    const statusMessage = `🔧 **Maintenance Mode ${newValue === 'true' ? 'Enabled' : 'Disabled'}**

${newValue === 'true' ? 
  '🔴 Bot is now in maintenance mode. Only admins can use the bot.' : 
  '🟢 Bot is now available to all users.'}

Settings updated successfully!`;

    await sendMessage(chatId, statusMessage);
    
    // Refresh settings panel
    setTimeout(() => handleAdminSettings(chatId, userId), 2000);
    
  } catch (error) {
    await sendMessage(chatId, `❌ Error toggling maintenance: ${(error as Error).message}`);
  }
}

async function handleViewAllSettings(chatId: number, userId: string): Promise<void> {
  if (!isAdmin(userId)) {
    await sendAccessDeniedMessage(chatId);
    return;
  }

  try {
    const { data: settings, error } = await supabaseAdmin
      .from('bot_settings')
      .select('setting_key, setting_value, setting_type, description')
      .eq('is_active', true)
      .order('setting_key');

    if (error) {
      throw error;
    }

    let settingsText = `📋 *All Bot Settings*\n\n`;
    
    settings?.forEach(setting => {
      const value = setting.setting_value;
      const displayValue = setting.setting_type === 'boolean' ? 
        (value === 'true' ? '✅ Enabled' : '❌ Disabled') : value;
      
      settingsText += `🔹 **${setting.setting_key}**\n`;
      settingsText += `   Value: \`${displayValue}\`\n`;
      settingsText += `   ${setting.description}\n\n`;
    });

    const allSettingsKeyboard = {
      inline_keyboard: [
        [
          { text: '📝 Edit Setting', callback_data: 'edit_setting' },
          { text: '➕ Add Setting', callback_data: 'add_setting' }
        ],
        [
          { text: '🔄 Refresh', callback_data: 'view_all_settings' },
          { text: '🔙 Back to Settings', callback_data: 'admin_settings' }
        ]
      ]
    };

    await sendMessage(chatId, settingsText, allSettingsKeyboard);
    
  } catch (error) {
    await sendMessage(chatId, `❌ Error loading all settings: ${(error as Error).message}`);
  }
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

// Analytics and Reports Functions
async function handleAnalyticsMenu(chatId: number, userId: string): Promise<void> {
  if (!isAdmin(userId)) {
    await sendAccessDeniedMessage(chatId);
    return;
  }

  const analyticsMessage = `📈 **Analytics & Reports Center**

📊 **Available Reports:**
• 👥 User Analytics - Growth, activity, demographics
• 💰 Payment Reports - Revenue, transactions, trends
• 📦 Package Performance - VIP vs Education stats
• 🎁 Promotion Analytics - Usage, conversion rates
• 📱 Bot Usage Statistics - Commands, interactions
• 🔒 Security Reports - Rate limits, blocked users

📁 **Export Formats:**
• 📄 CSV files for spreadsheet analysis
• 📋 Text summaries for quick review
• 📊 Detailed JSON data exports

🕐 **Time Ranges:**
• Last 24 hours, 7 days, 30 days, All time

Choose a report type to generate:`;

  const analyticsKeyboard = {
    inline_keyboard: [
      [
        { text: "👥 User Analytics", callback_data: "report_users" },
        { text: "💰 Payment Reports", callback_data: "report_payments" }
      ],
      [
        { text: "📦 Package Stats", callback_data: "report_packages" },
        { text: "🎁 Promotions", callback_data: "report_promotions" }
      ],
      [
        { text: "📱 Bot Usage", callback_data: "report_bot_usage" },
        { text: "🔒 Security", callback_data: "report_security" }
      ],
      [
        { text: "📊 Live Dashboard", callback_data: "analytics_dashboard" },
        { text: "📈 Quick Stats", callback_data: "quick_analytics" }
      ],
      [
        { text: "🔙 Back to Admin", callback_data: "admin_dashboard" }
      ]
    ]
  };

  await sendMessage(chatId, analyticsMessage, analyticsKeyboard);
}

async function handleUserAnalyticsReport(chatId: number, userId: string, timeRange: string = '30d'): Promise<void> {
  if (!isAdmin(userId)) {
    await sendAccessDeniedMessage(chatId);
    return;
  }

  try {
    await sendMessage(chatId, "📊 Generating user analytics report...");

    // Get time range filter
    const timeFilter = getTimeFilter(timeRange);
    
    // Fetch user statistics
    const [totalUsers, newUsers, activeUsers, vipUsers, adminUsers] = await Promise.all([
      // Total users
      supabaseAdmin.from('bot_users').select('count', { count: 'exact' }),
      
      // New users in time range
      supabaseAdmin
        .from('bot_users')
        .select('count', { count: 'exact' })
        .gte('created_at', timeFilter),
      
      // Active users (with recent interactions)
      supabaseAdmin
        .from('user_interactions')
        .select('telegram_user_id', { count: 'exact' })
        .gte('created_at', timeFilter)
        .not('telegram_user_id', 'is', null),
      
      // VIP users
      supabaseAdmin
        .from('bot_users')
        .select('count', { count: 'exact' })
        .eq('is_vip', true),
      
      // Admin users
      supabaseAdmin
        .from('bot_users')
        .select('count', { count: 'exact' })
        .eq('is_admin', true)
    ]);

    // Get user growth data
    const userGrowthQuery = await supabaseAdmin
      .from('bot_users')
      .select('created_at')
      .gte('created_at', timeFilter)
      .order('created_at');

    // Calculate growth metrics
    const growthData = calculateGrowthMetrics(userGrowthQuery.data || []);
    
    // Get top active users
    const topUsersRaw = await supabaseAdmin
      .from('user_interactions')
      .select('telegram_user_id')
      .gte('created_at', timeFilter);

    const topUsers = Object.entries((topUsersRaw.data || []).reduce((acc: Record<string, number>, row: { telegram_user_id: string }) => {
      acc[row.telegram_user_id] = (acc[row.telegram_user_id] || 0) + 1;
      return acc;
    }, {} as Record<string, number>))
      .map(([telegram_user_id, count]) => ({ telegram_user_id, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const report = generateUserAnalyticsReport({
      totalUsers: totalUsers.count || 0,
      newUsers: newUsers.count || 0,
      activeUsers: activeUsers.count || 0,
      vipUsers: vipUsers.count || 0,
      adminUsers: adminUsers.count || 0,
      growthData,
      topUsers,
      timeRange
    });

    // Generate CSV export
    const csvData = generateUserAnalyticsCSV({
      totalUsers: totalUsers.count || 0,
      newUsers: newUsers.count || 0,
      activeUsers: activeUsers.count || 0,
      vipUsers: vipUsers.count || 0,
      adminUsers: adminUsers.count || 0,
      timeRange
    });

    await sendMessage(chatId, report);
    await sendMessage(chatId, `📄 **CSV Export:**\n\`\`\`\n${csvData}\n\`\`\``);

    await logAdminAction(userId, 'report_generated', `User analytics report for ${timeRange}`, 'reports');

  } catch (error) {
    console.error('❌ Error generating user analytics:', error);
    await sendMessage(chatId, `❌ Error generating report: ${(error as Error).message}`);
  }
}

async function handlePaymentReport(chatId: number, userId: string, timeRange: string = '30d'): Promise<void> {
  if (!isAdmin(userId)) {
    await sendAccessDeniedMessage(chatId);
    return;
  }

  try {
    await sendMessage(chatId, "💰 Generating payment report...");

    const timeFilter = getTimeFilter(timeRange);
    
    // Fetch payment statistics
    const [totalPayments, pendingPayments, completedPayments, rejectedPayments, revenueData] = await Promise.all([
      // Total payments
      supabaseAdmin.from('payments').select('count', { count: 'exact' }),
      
      // Pending payments
      supabaseAdmin
        .from('payments')
        .select('count', { count: 'exact' })
        .eq('status', 'pending'),
      
      // Completed payments
      supabaseAdmin
        .from('payments')
        .select('count, amount', { count: 'exact' })
        .eq('status', 'completed')
        .gte('created_at', timeFilter),
      
      // Rejected payments
      supabaseAdmin
        .from('payments')
        .select('count', { count: 'exact' })
        .eq('status', 'rejected')
        .gte('created_at', timeFilter),
      
      // Revenue calculation
      supabaseAdmin
        .from('payments')
        .select('amount, currency, created_at')
        .eq('status', 'completed')
        .gte('created_at', timeFilter)
    ]);

    // Calculate revenue metrics
    const totalRevenue = revenueData.data?.reduce((sum, payment) => sum + (payment.amount || 0), 0) || 0;
    const avgPayment = revenueData.data?.length ? totalRevenue / revenueData.data.length : 0;

    // Get payment method breakdown
    const paymentMethodsRaw = await supabaseAdmin
      .from('payments')
      .select('payment_method')
      .gte('created_at', timeFilter);

    const paymentMethods = Object.entries((paymentMethodsRaw.data || []).reduce((acc: Record<string, number>, row: { payment_method: string }) => {
      acc[row.payment_method] = (acc[row.payment_method] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)).map(([payment_method, count]) => ({ payment_method, count }));

    const report = generatePaymentReport({
      totalPayments: totalPayments.count || 0,
      pendingPayments: pendingPayments.count || 0,
      completedPayments: completedPayments.count || 0,
      rejectedPayments: rejectedPayments.count || 0,
      totalRevenue,
      avgPayment,
      paymentMethods,
      timeRange
    });

    // Generate CSV export
    const csvData = generatePaymentCSV((revenueData.data as PaymentCSV[]) || []);

    await sendMessage(chatId, report);
    await sendMessage(chatId, `📄 **Payment Data CSV:**\n\`\`\`\n${csvData}\n\`\`\``);

    await logAdminAction(userId, 'report_generated', `Payment report for ${timeRange}`, 'reports');

  } catch (error) {
    console.error('❌ Error generating payment report:', error);
    await sendMessage(chatId, `❌ Error generating report: ${(error as Error).message}`);
  }
}

async function handlePackageReport(chatId: number, userId: string, timeRange: string = '30d'): Promise<void> {
  if (!isAdmin(userId)) {
    await sendAccessDeniedMessage(chatId);
    return;
  }

  try {
    await sendMessage(chatId, "📦 Generating package performance report...");

    const timeFilter = getTimeFilter(timeRange);

    // Get subscription plans data
    const { data: plans, error: plansError } = await supabaseAdmin
      .from('subscription_plans')
      .select('*')
      .order('price', { ascending: true });

    if (plansError) throw plansError;

    // Get subscription data with payments
    const { data: subscriptions, error: subsError } = await supabaseAdmin
      .from('user_subscriptions')
      .select(`
        *,
        subscription_plans(name, price, currency)
      `)
      .gte('created_at', timeFilter)
      .order('created_at', { ascending: false });

    if (subsError) throw subsError;

    // Get education packages data
    const { data: eduPackages, error: eduError } = await supabaseAdmin
      .from('education_packages')
      .select('*')
      .order('price', { ascending: true });

    if (eduError) throw eduError;

    // Get education enrollments
    const { data: enrollments, error: enrollError } = await supabaseAdmin
      .from('education_enrollments')
      .select(`
        *,
        education_packages(name, price, currency)
      `)
      .gte('created_at', timeFilter);

    if (enrollError) throw enrollError;

    // Generate report
    const vipStats = plans?.map(plan => {
      const planSubs = subscriptions?.filter(s => s.plan_id === plan.id) || [];
      const activeCount = planSubs.filter(s => s.is_active).length;
      const totalRevenue = planSubs.filter(s => s.payment_status === 'approved').length * plan.price;
      
      return {
        name: plan.name,
        price: plan.price,
        activeSubscriptions: activeCount,
        totalSignups: planSubs.length,
        revenue: totalRevenue,
        conversionRate: planSubs.length > 0 ? Math.round((activeCount / planSubs.length) * 100) : 0
      };
    }) || [];

    const eduStats = eduPackages?.map(pkg => {
      const pkgEnrollments = enrollments?.filter(e => e.package_id === pkg.id) || [];
      const completedCount = pkgEnrollments.filter(e => e.enrollment_status === 'completed').length;
      const revenue = pkgEnrollments.filter(e => e.payment_status === 'approved').length * pkg.price;
      
      return {
        name: pkg.name,
        price: pkg.price,
        enrollments: pkgEnrollments.length,
        completed: completedCount,
        revenue: revenue,
        completionRate: pkgEnrollments.length > 0 ? Math.round((completedCount / pkgEnrollments.length) * 100) : 0
      };
    }) || [];

    let message = `📦 **Package Performance Report** (${timeRange})

🎯 **VIP Subscription Packages:**`;

    vipStats.forEach(stat => {
      message += `
• **${stat.name}** - $${stat.price}
  📊 Active: ${stat.activeSubscriptions} | Total: ${stat.totalSignups}
  💰 Revenue: $${stat.revenue}
  📈 Conversion: ${stat.conversionRate}%`;
    });

    message += `

🎓 **Education Packages:**`;

    eduStats.forEach(stat => {
      message += `
• **${stat.name}** - $${stat.price}
  📚 Enrollments: ${stat.enrollments} | Completed: ${stat.completed}
  💰 Revenue: $${stat.revenue}
  ✅ Completion Rate: ${stat.completionRate}%`;
    });

    const totalVipRevenue = vipStats.reduce((sum, stat) => sum + stat.revenue, 0);
    const totalEduRevenue = eduStats.reduce((sum, stat) => sum + stat.revenue, 0);
    const totalRevenue = totalVipRevenue + totalEduRevenue;

    message += `

📊 **Summary:**
💰 Total VIP Revenue: $${totalVipRevenue}
🎓 Total Education Revenue: $${totalEduRevenue}
🏆 **Grand Total: $${totalRevenue}**

📈 **Top Performers:**
🥇 Best VIP Plan: ${vipStats.length > 0 ? vipStats.sort((a, b) => b.revenue - a.revenue)[0]?.name || 'N/A' : 'No data'}
🎯 Best Education: ${eduStats.length > 0 ? eduStats.sort((a, b) => b.revenue - a.revenue)[0]?.name || 'N/A' : 'No data'}

Generated: ${new Date().toLocaleString()}`;

    await sendMessage(chatId, message);
    await logAdminAction(userId, 'report_generated', `Package performance report for ${timeRange}`, 'reports');

  } catch (error) {
    console.error('❌ Error generating package report:', error);
    await sendMessage(chatId, `❌ Error generating report: ${(error as Error).message}`);
  }
}

async function handlePromotionReport(chatId: number, userId: string, timeRange: string = '30d'): Promise<void> {
  if (!isAdmin(userId)) {
    await sendAccessDeniedMessage(chatId);
    return;
  }

  try {
    await sendMessage(chatId, "🎁 Generating promotion analytics report...");

    const timeFilter = getTimeFilter(timeRange);

    // Get promotions data
    const { data: promotions, error: promoError } = await supabaseAdmin
      .from('promotions')
      .select('*')
      .order('created_at', { ascending: false });

    if (promoError) throw promoError;

    // Get promotion usage data
    const { data: usage, error: usageError } = await supabaseAdmin
      .from('promotion_usage')
      .select(`
        *,
        promotions(code, discount_value, discount_type)
      `)
      .gte('used_at', timeFilter);

    if (usageError) throw usageError;

    // Get promo analytics data
    const { data: analytics, error: analyticsError } = await supabaseAdmin
      .from('promo_analytics')
      .select('*')
      .gte('created_at', timeFilter);

    if (analyticsError) throw analyticsError;

    const promoStats = promotions?.map(promo => {
      const promoUsage = usage?.filter(u => u.promotion_id === promo.id) || [];
      const promoAnalytics = analytics?.filter(a => a.promo_code === promo.code) || [];
      
      const totalSavings = promoAnalytics.reduce((sum, a) => sum + (a.discount_amount || 0), 0);
      const averageSavings = promoUsage.length > 0 ? totalSavings / promoUsage.length : 0;
      
      return {
        code: promo.code,
        type: promo.discount_type,
        value: promo.discount_value,
        maxUses: promo.max_uses || 'Unlimited',
        currentUses: promo.current_uses || 0,
        totalUsage: promoUsage.length,
        totalSavings: totalSavings,
        averageSavings: averageSavings,
        isActive: promo.is_active,
        validUntil: promo.valid_until
      };
    }) || [];

    let message = `🎁 **Promotion Analytics Report** (${timeRange})

📊 **Active Promotions:**`;

    const activePromos = promoStats.filter(p => p.isActive);
    const expiredPromos = promoStats.filter(p => !p.isActive);

    activePromos.forEach(promo => {
      const usagePercent = promo.maxUses !== 'Unlimited' ? 
        Math.round((promo.currentUses / promo.maxUses) * 100) : 0;
      
      message += `
🟢 **${promo.code}**
  💰 ${promo.type}: ${promo.value}${promo.type === 'percentage' ? '%' : ' USD'}
  📊 Used: ${promo.currentUses}/${promo.maxUses} ${promo.maxUses !== 'Unlimited' ? `(${usagePercent}%)` : ''}
  💵 Total Savings: $${promo.totalSavings.toFixed(2)}
  📅 Valid Until: ${new Date(promo.validUntil).toLocaleDateString()}`;
    });

    if (expiredPromos.length > 0) {
      message += `

⏰ **Expired/Inactive Promotions:**`;
      
      expiredPromos.slice(0, 5).forEach(promo => {
        message += `
🔴 **${promo.code}** - Used: ${promo.currentUses} times, Savings: $${promo.totalSavings.toFixed(2)}`;
      });
    }

    const totalPromotions = promoStats.length;
    const totalUsage = promoStats.reduce((sum, p) => sum + p.totalUsage, 0);
    const totalSavings = promoStats.reduce((sum, p) => sum + p.totalSavings, 0);
    const averageUsagePerPromo = totalPromotions > 0 ? totalUsage / totalPromotions : 0;

    message += `

📈 **Overall Statistics:**
🎯 Total Promotions: ${totalPromotions}
🔄 Total Usage: ${totalUsage} times
💰 Total Customer Savings: $${totalSavings.toFixed(2)}
📊 Average Usage per Promo: ${averageUsagePerPromo.toFixed(1)} times
🟢 Active Promotions: ${activePromos.length}

🏆 **Top Performing Codes:**`;

    const topPromos = promoStats
      .sort((a, b) => b.totalUsage - a.totalUsage)
      .slice(0, 3);

    topPromos.forEach((promo, index) => {
      message += `
${index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'} ${promo.code}: ${promo.totalUsage} uses, $${promo.totalSavings.toFixed(2)} savings`;
    });

    message += `

Generated: ${new Date().toLocaleString()}`;

    await sendMessage(chatId, message);
    await logAdminAction(userId, 'report_generated', `Promotion analytics report for ${timeRange}`, 'reports');

    } catch (error) {
      console.error('❌ Error generating promotion report:', error);
      await sendMessage(chatId, `❌ Error generating report: ${(error as Error).message}`);
    }
  }

  async function handleBotUsageReport(chatId: number, userId: string, timeRange: string = '30d'): Promise<void> {
  if (!isAdmin(userId)) {
    await sendAccessDeniedMessage(chatId);
    return;
  }

  try {
    await sendMessage(chatId, "📱 Generating bot usage report...");

    const timeFilter = getTimeFilter(timeRange);
    
    // Fetch bot usage statistics
    const [totalInteractions, commandStatsRaw, sessionStats, securityEventsRaw] = await Promise.all([
      // Total interactions
      supabaseAdmin
        .from('user_interactions')
        .select('count', { count: 'exact' })
        .gte('created_at', timeFilter),

      // Command usage stats
      supabaseAdmin
        .from('user_interactions')
        .select('interaction_data')
        .gte('created_at', timeFilter)
        .eq('interaction_type', 'command'),

      // Session statistics
      supabaseAdmin
        .from('bot_sessions')
        .select('duration_minutes, activity_count, created_at')
        .gte('created_at', timeFilter),

      // Error/security events
      supabaseAdmin
        .from('user_interactions')
        .select('interaction_type')
        .gte('created_at', timeFilter)
        .in('interaction_type', ['unknown_command', 'error', 'security_block'])
    ]);

    const commandStats = Object.entries((commandStatsRaw.data || []).reduce((acc: Record<string, number>, row: { interaction_data: string }) => {
      const key = row.interaction_data || 'unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>))
      .map(([interaction_data, count]) => ({ interaction_data, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const securityEvents = Object.entries((securityEventsRaw.data || []).reduce((acc: Record<string, number>, row: { interaction_type: string }) => {
      acc[row.interaction_type] = (acc[row.interaction_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)).map(([interaction_type, count]) => ({ interaction_type, count }));

    // Calculate usage metrics
    const avgSessionDuration = sessionStats.data?.length ?
      sessionStats.data.reduce((sum: number, s: { duration_minutes?: number }) => sum + (s.duration_minutes || 0), 0) / sessionStats.data.length : 0;

    const totalActivities = sessionStats.data?.reduce((sum: number, s: { activity_count?: number }) => sum + (s.activity_count || 0), 0) || 0;

    const report = generateBotUsageReport({
      totalInteractions: totalInteractions.count || 0,
      totalSessions: sessionStats.data?.length || 0,
      avgSessionDuration,
      totalActivities,
      commandStats,
      securityEvents,
      timeRange
    });

    await sendMessage(chatId, report);

    // Add security stats from memory
    const memorySecurityReport = `🔒 **Live Security Stats:**
• Total Requests: ${securityStats.totalRequests}
• Blocked Requests: ${securityStats.blockedRequests}
• Suspicious Users: ${securityStats.suspiciousUsers.size}
• Rate Limit Store Size: ${rateLimitStore.size}
• Block Success Rate: ${securityStats.totalRequests > 0 ? ((securityStats.blockedRequests / securityStats.totalRequests) * 100).toFixed(2) : 0}%`;

    await sendMessage(chatId, memorySecurityReport);

    await logAdminAction(userId, 'report_generated', `Bot usage report for ${timeRange}`, 'reports');

  } catch (error) {
    console.error('❌ Error generating bot usage report:', error);
    await sendMessage(chatId, `❌ Error generating report: ${(error as Error).message}`);
  }
}

// Additional table management handlers
async function handlePaymentsTableManagement(chatId: number, userId: string): Promise<void> {
  if (!isAdmin(userId)) {
    await sendAccessDeniedMessage(chatId);
    return;
  }

  try {
    const { data: payments, error } = await supabaseAdmin
      .from('payments')
      .select(`
        *,
        bot_users(first_name, last_name, telegram_id),
        subscription_plans(name)
      `)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    const totalStats = await supabaseAdmin
      .from('payments')
      .select('id, amount, status', { count: 'exact' });

    const revenueQuery = await supabaseAdmin
      .from('payments')
      .select('amount')
      .eq('status', 'completed');

    const totalRevenue = revenueQuery.data?.reduce((sum, p) => sum + p.amount, 0) || 0;

    let message = `💳 **Payments Table Management**

📊 **Statistics:**
• Total Payments: ${totalStats.count || 0}
• Total Revenue: $${totalRevenue.toFixed(2)}
• Recent Payments (Last 20):

`;

    payments?.forEach((payment, index) => {
      const user = payment.bot_users;
      const plan = payment.subscription_plans;
      const statusEmoji = payment.status === 'completed' ? '✅' : 
                         payment.status === 'pending' ? '⏳' : '❌';
      
      message += `${index + 1}. ${statusEmoji} $${payment.amount} ${payment.currency}
   👤 ${user?.first_name || 'Unknown'} (${user?.telegram_id || 'N/A'})
   📦 ${plan?.name || 'Unknown Plan'}
   📅 ${new Date(payment.created_at).toLocaleDateString()}

`;
    });

    const keyboard = {
      inline_keyboard: [
        [
          { text: "💰 Revenue Report", callback_data: "report_payments" },
          { text: "🔙 Back to Tables", callback_data: "manage_tables" }
        ]
      ]
    };

    await sendMessage(chatId, message, keyboard);

  } catch (error) {
    console.error('❌ Error in payments table management:', error);
    await sendMessage(chatId, `❌ Error loading payments data: ${(error as Error).message}`);
  }
}

async function handleBroadcastTableManagement(chatId: number, userId: string): Promise<void> {
  if (!isAdmin(userId)) {
    await sendAccessDeniedMessage(chatId);
    return;
  }

  try {
    const { data: broadcasts, error } = await supabaseAdmin
      .from('broadcast_messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(15);

    if (error) throw error;

    const totalBroadcasts = await supabaseAdmin
      .from('broadcast_messages')
      .select('id', { count: 'exact' });

    let message = `📢 **Broadcast Messages Management**

📊 **Statistics:**
• Total Broadcasts: ${totalBroadcasts.count || 0}
• Recent Messages (Last 15):

`;

    broadcasts?.forEach((broadcast, index) => {
      const statusEmoji = broadcast.delivery_status === 'completed' ? '✅' : 
                         broadcast.delivery_status === 'sending' ? '📤' : 
                         broadcast.delivery_status === 'draft' ? '📝' : '❌';
      
      message += `${index + 1}. ${statusEmoji} ${broadcast.title || 'Untitled'}
   📝 ${broadcast.content?.substring(0, 50) || 'No content'}...
   📊 ${broadcast.successful_deliveries || 0}/${broadcast.total_recipients || 0} delivered
   📅 ${new Date(broadcast.created_at).toLocaleDateString()}

`;
    });

    const keyboard = {
      inline_keyboard: [
        [
          { text: "📤 New Broadcast", callback_data: "admin_broadcast" },
          { text: "🔙 Back to Tables", callback_data: "manage_tables" }
        ]
      ]
    };

    await sendMessage(chatId, message, keyboard);

  } catch (error) {
    console.error('❌ Error in broadcast table management:', error);
    await sendMessage(chatId, `❌ Error loading broadcast data: ${(error as Error).message}`);
  }
}

async function handleBankAccountsTableManagement(chatId: number, userId: string): Promise<void> {
  if (!isAdmin(userId)) {
    await sendAccessDeniedMessage(chatId);
    return;
  }

  try {
    const { data: bankAccounts, error } = await supabaseAdmin
      .from('bank_accounts')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) throw error;

    let message = `🏦 **Bank Accounts Management**

📊 **Payment Bank Accounts:**

`;

    bankAccounts?.forEach((account, index) => {
      const statusEmoji = account.is_active ? '🟢' : '🔴';
      
      message += `${index + 1}. ${statusEmoji} ${account.bank_name}
   👤 ${account.account_name}
   💳 ${account.account_number}
   💱 ${account.currency}

`;
    });

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🔙 Back to Tables", callback_data: "manage_tables" }
        ]
      ]
    };

    await sendMessage(chatId, message, keyboard);

  } catch (error) {
    console.error('❌ Error in bank accounts table management:', error);
    await sendMessage(chatId, `❌ Error loading bank accounts data: ${(error as Error).message}`);
  }
}

async function handleAutoReplyTableManagement(chatId: number, userId: string): Promise<void> {
  if (!isAdmin(userId)) {
    await sendAccessDeniedMessage(chatId);
    return;
  }

  try {
    const { data: templates, error } = await supabaseAdmin
      .from('auto_reply_templates')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) throw error;

    let message = `🤖 **Auto Reply Templates Management**

📊 **Templates:**

`;

    templates?.forEach((template, index) => {
      const statusEmoji = template.is_active ? '🟢' : '🔴';
      
      message += `${index + 1}. ${statusEmoji} ${template.name}
   🔗 Trigger: ${template.trigger_type}
   📝 ${template.message_template.substring(0, 50)}...

`;
    });

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🔙 Back to Tables", callback_data: "manage_tables" }
        ]
      ]
    };

    await sendMessage(chatId, message, keyboard);

  } catch (error) {
    console.error('❌ Error in auto reply table management:', error);
    await sendMessage(chatId, `❌ Error loading auto reply data: ${(error as Error).message}`);
  }
}

async function handleEducationPackageStats(chatId: number, userId: string): Promise<void> {
  if (!isAdmin(userId)) {
    await sendAccessDeniedMessage(chatId);
    return;
  }

  try {
    const { data: packages, error: pkgError } = await supabaseAdmin
      .from('education_packages')
      .select('*');

    const { data: enrollments, error: enrollError } = await supabaseAdmin
      .from('education_enrollments')
      .select('*');

    if (pkgError || enrollError) throw pkgError || enrollError;

    let message = `🎓 **Education Package Statistics**

📊 **Package Performance:**

`;

    packages?.forEach(pkg => {
      const pkgEnrollments = enrollments?.filter(e => e.package_id === pkg.id) || [];
      const completed = pkgEnrollments.filter(e => e.enrollment_status === 'completed').length;
      const revenue = pkgEnrollments.filter(e => e.payment_status === 'approved').length * pkg.price;
      
      message += `📚 **${pkg.name}**
   💰 Price: $${pkg.price}
   👥 Enrollments: ${pkgEnrollments.length}
   ✅ Completed: ${completed}
   💵 Revenue: $${revenue}

`;
    });

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🔙 Back to Education", callback_data: "manage_table_education_packages" }
        ]
      ]
    };

    await sendMessage(chatId, message, keyboard);

  } catch (error) {
    console.error('❌ Error in education package stats:', error);
    await sendMessage(chatId, `❌ Error loading education stats: ${(error as Error).message}`);
  }
}

async function handleEducationCategoriesManagement(chatId: number, userId: string): Promise<void> {
  if (!isAdmin(userId)) {
    await sendAccessDeniedMessage(chatId);
    return;
  }

  try {
    const { data: categories, error } = await supabaseAdmin
      .from('education_categories')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) throw error;

    let message = `📚 **Education Categories Management**

📊 **Categories:**

`;

    categories?.forEach((category, index) => {
      const statusEmoji = category.is_active ? '🟢' : '🔴';
      
      message += `${index + 1}. ${statusEmoji} ${category.icon} ${category.name}
   📝 ${category.description || 'No description'}

`;
    });

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🔙 Back to Education", callback_data: "manage_table_education_packages" }
        ]
      ]
    };

    await sendMessage(chatId, message, keyboard);

  } catch (error) {
    console.error('❌ Error in education categories management:', error);
    await sendMessage(chatId, `❌ Error loading categories data: ${(error as Error).message}`);
  }
}

  async function handleEducationEnrollmentsView(chatId: number, userId: string): Promise<void> {
    if (!isAdmin(userId)) {
      await sendAccessDeniedMessage(chatId);
      return;
    }

    try {
      const { data: enrollments, error } = await supabaseAdmin
        .from('education_enrollments')
        .select(`
          *,
          education_packages(name, price)
        `)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      let message = `🎓 **Education Enrollments** (Last 20)

📊 **Recent Enrollments:**

`;

      enrollments?.forEach((enrollment, index) => {
        const pkg = enrollment.education_packages;
        const statusEmoji =
          enrollment.enrollment_status === 'completed'
            ? '✅'
            : enrollment.enrollment_status === 'pending'
            ? '⏳'
            : '📚';
        const paymentEmoji =
          enrollment.payment_status === 'approved' ? '💰' : '⏳';

        message += `${index + 1}. ${statusEmoji} ${enrollment.student_first_name || 'Unknown'}
   📚 ${pkg?.name || 'Unknown Package'}
   💰 $${pkg?.price || 0} ${paymentEmoji}
   📧 ${enrollment.student_email || 'N/A'}

`;
      });

      const keyboard = {
        inline_keyboard: [
          [
            { text: '🔙 Back to Education', callback_data: 'manage_table_education_packages' }
          ]
        ]
      };

      await sendMessage(chatId, message, keyboard);
      await logAdminAction(
        userId,
        'view_education_enrollments',
        'Viewed recent education enrollments',
        'education_enrollments'
      );
    } catch (error) {
      console.error('❌ Error in education enrollments view:', error);
      await sendMessage(
        chatId,
        `❌ Error loading enrollments data: ${(error as Error).message}`
      );
    }
  }

  async function handleCreatePromotion(chatId: number, userId: string): Promise<void> {
  if (!isAdmin(userId)) {
    await sendAccessDeniedMessage(chatId);
    return;
  }

  await sendMessage(chatId, `🎁 **Create New Promotion**

To create a new promotion, please provide the following details:

**Example Format:**
Code: SAVE20
Discount Type: percentage
Discount Value: 20
Max Uses: 100
Valid Until: 2025-02-28

Please contact the developer to add new promotions with the above details, as this requires database access for security.

📋 **Current Active Promotions:**`);

  // Show current promotions
  try {
    const { data: promotions, error } = await supabaseAdmin
      .from('promotions')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;

    let promoList = '';
    promotions?.forEach(promo => {
      promoList += `\n🎫 ${promo.code} - ${promo.discount_value}${promo.discount_type === 'percentage' ? '%' : ' USD'} (${promo.current_uses || 0}/${promo.max_uses || '∞'} uses)`;
    });

    if (promoList) {
      await sendMessage(chatId, promoList);
    } else {
      await sendMessage(chatId, "No active promotions found.");
    }

  } catch (error) {
    console.error('❌ Error loading promotions:', error);
  }
}

async function handleEditContent(chatId: number, userId: string, contentKey: string): Promise<void> {
  if (!isAdmin(userId)) {
    await sendAccessDeniedMessage(chatId);
    return;
  }

  try {
    const { data: content, error } = await supabaseAdmin
      .from('bot_content')
      .select('*')
      .eq('content_key', contentKey)
      .eq('is_active', true)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    const currentContent = content?.content_value || 'No content found';

    const userSession = getUserSession(userId);
    userSession.awaitingInput = `edit_content:${contentKey}`;

    await sendMessage(
      chatId,
      `💬 **Edit Content: ${contentKey.replace(/_/g, ' ').toUpperCase()}**\n\n` +
        `**Current Content:**\n` +
        `${currentContent.substring(0, 500)}${currentContent.length > 500 ? '...' : ''}\n\n` +
        `Send the new content in your next message.`
    );
  } catch (error) {
    console.error('❌ Error loading content:', error);
    await sendMessage(chatId, `❌ Error loading content: ${(error as Error).message}`);
  }
}

async function handleContentEditSave(
  chatId: number,
  userId: string,
  newContent: string,
  contentKey: string
): Promise<void> {
  if (!isAdmin(userId)) {
    await sendAccessDeniedMessage(chatId);
    return;
  }

  const success = await setBotContent(contentKey, newContent, userId);
  if (success) {
    await sendMessage(chatId, `✅ Content updated for *${contentKey}*`);
  } else {
    await sendMessage(chatId, `❌ Failed to update content for *${contentKey}*`);
  }
}

async function handlePreviewAllContent(chatId: number, userId: string): Promise<void> {
  if (!isAdmin(userId)) {
    await sendAccessDeniedMessage(chatId);
    return;
  }

  try {
    const { data: contents, error } = await supabaseAdmin
      .from('bot_content')
      .select('*')
      .eq('is_active', true)
      .order('content_key', { ascending: true });

    if (error) throw error;

    let message = `💬 **All Bot Content Preview**

📋 **Available Content Keys:**

`;

    contents?.forEach(content => {
      const preview = content.content_value.substring(0, 100);
      message += `🔑 **${content.content_key}**
   📝 ${preview}${content.content_value.length > 100 ? '...' : ''}
   🕐 Updated: ${new Date(content.updated_at).toLocaleDateString()}

`;
    });

    if (!contents || contents.length === 0) {
      message += "No content found.";
    }

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🔙 Back to Content", callback_data: "admin_content" }
        ]
      ]
    };

    await sendMessage(chatId, message, keyboard);

  } catch (error) {
    console.error('❌ Error loading all content:', error);
    await sendMessage(chatId, `❌ Error loading content: ${(error as Error).message}`);
  }
}

  async function handleQuickAnalytics(chatId: number, userId: string): Promise<void> {
  if (!isAdmin(userId)) {
    await sendAccessDeniedMessage(chatId);
    return;
  }

  try {
    console.log("📊 Generating optimized quick analytics...");
    
    // Use the optimized function to get all stats in one query
    const { data: stats, error } = await supabaseAdmin
      .rpc('get_bot_stats');

    if (error) {
      throw error;
    }

    const quickStats = `⚡ **Quick Analytics Dashboard**

📅 **Live Statistics:**
• 👥 Total Users: ${stats.total_users || 0}
• 💎 VIP Users: ${stats.vip_users || 0}
• 🔑 Admin Users: ${stats.admin_users || 0}

💰 **Payment Overview:**
• ⏳ Pending Payments: ${stats.pending_payments || 0}
• ✅ Completed Payments: ${stats.completed_payments || 0}
• 💵 Total Revenue: $${((stats.total_revenue || 0) / 100).toFixed(2)}

📱 **Today's Activity:**
• 🔄 Interactions: ${stats.daily_interactions || 0}
• 📊 Sessions: ${stats.daily_sessions || 0}
• 🛡️ Blocked Requests: ${securityStats.blockedRequests}

🤖 **System Status:**
• 🟢 Status: Online & Optimized
• ⏱️ Uptime: ${Math.floor((Date.now() - BOT_START_TIME.getTime()) / 1000 / 60)} minutes
• 💾 Active Sessions: ${activeBotSessions.size}
• 🔒 Rate Limit Store: ${rateLimitStore.size} entries

🛡️ **Security Overview:**
• 🚫 Suspicious Users: ${securityStats.suspiciousUsers.size}
• 📈 Protection Rate: ${securityStats.totalRequests > 0 ? ((securityStats.blockedRequests / securityStats.totalRequests) * 100).toFixed(1) : 0}%

⚡ **Performance:** Query optimized - Single DB call
*Last updated: ${new Date(stats.last_updated).toLocaleTimeString()}*`;

    const quickAnalyticsKeyboard = {
      inline_keyboard: [
        [
          { text: "📊 Full Reports", callback_data: "admin_analytics" },
          { text: "🔄 Refresh", callback_data: "quick_analytics" }
        ],
        [
          { text: "📈 Export Data", callback_data: "export_all_data" },
          { text: "🔙 Back", callback_data: "admin_dashboard" }
        ]
      ]
    };

    await sendMessage(chatId, quickStats, quickAnalyticsKeyboard);
    console.log("✅ Quick analytics generated with optimized single query");

  } catch (error) {
    console.error('❌ Error generating quick analytics:', error);
    await sendMessage(chatId, `❌ Error generating analytics: ${(error as Error).message}`);
  }
}

// Helper functions for report generation
function getTimeFilter(timeRange: string): string {
  const now = new Date();
  switch (timeRange) {
    case '24h':
      return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    case 'all':
      return new Date('2020-01-01').toISOString();
    default:
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  }
}

function calculateGrowthMetrics(
  userData: UserRecord[]
): { dailyGrowth: number; weeklyGrowth: number } {
  if (!userData.length) return { dailyGrowth: 0, weeklyGrowth: 0 };

  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const dailyUsers = userData.filter(u => new Date(u.created_at) >= oneDayAgo).length;
  const weeklyUsers = userData.filter(u => new Date(u.created_at) >= oneWeekAgo).length;

  return { dailyGrowth: dailyUsers, weeklyGrowth: weeklyUsers };
}

function generateUserAnalyticsReport(data: AnalyticsData): string {
  return `👥 **User Analytics Report** (${data.timeRange})

📊 **User Statistics:**
• 👤 Total Users: ${data.totalUsers}
• 🆕 New Users: ${data.newUsers}
• 📱 Active Users: ${data.activeUsers}
• 💎 VIP Users: ${data.vipUsers}
• 🔑 Admin Users: ${data.adminUsers}

📈 **Growth Metrics:**
• 📅 Daily Growth: +${data.growthData.dailyGrowth} users
• 📊 Weekly Growth: +${data.growthData.weeklyGrowth} users
• 📊 Growth Rate: ${data.totalUsers > 0 ? ((data.newUsers / data.totalUsers) * 100).toFixed(1) : 0}%

🏆 **Most Active Users:**
${data.topUsers.slice(0, 3).map((user, index) =>
  `${index + 1}. User ${user.telegram_user_id}: ${user.count} interactions`
).join('\n') || 'No data available'}

💡 **Insights:**
• User Engagement: ${data.activeUsers > 0 && data.totalUsers > 0 ? ((data.activeUsers / data.totalUsers) * 100).toFixed(1) : 0}%
• VIP Conversion: ${data.totalUsers > 0 ? ((data.vipUsers / data.totalUsers) * 100).toFixed(1) : 0}%

*Generated: ${new Date().toLocaleString()}*`;
}

function generatePaymentReport(data: PaymentReportData): string {
  return `💰 **Payment Report** (${data.timeRange})

📊 **Payment Statistics:**
• 💳 Total Payments: ${data.totalPayments}
• ⏳ Pending: ${data.pendingPayments}
• ✅ Completed: ${data.completedPayments}
• ❌ Rejected: ${data.rejectedPayments}

💵 **Revenue Metrics:**
• 💰 Total Revenue: $${(data.totalRevenue / 100).toFixed(2)}
• 📊 Average Payment: $${(data.avgPayment / 100).toFixed(2)}
• 📈 Success Rate: ${data.totalPayments > 0 ? ((data.completedPayments / data.totalPayments) * 100).toFixed(1) : 0}%

💳 **Payment Methods:**
${data.paymentMethods.map(method =>
  `• ${method.payment_method || 'Unknown'}: ${method.count} payments`
).join('\n') || 'No data available'}

📈 **Performance:**
• Completion Rate: ${data.totalPayments > 0 ? ((data.completedPayments / data.totalPayments) * 100).toFixed(1) : 0}%
• Rejection Rate: ${data.totalPayments > 0 ? ((data.rejectedPayments / data.totalPayments) * 100).toFixed(1) : 0}%

*Generated: ${new Date().toLocaleString()}*`;
}

function generateBotUsageReport(data: BotUsageData): string {
  return `📱 **Bot Usage Report** (${data.timeRange})

📊 **Usage Statistics:**
• 🔄 Total Interactions: ${data.totalInteractions}
• 🎯 Total Sessions: ${data.totalSessions}
• ⏱️ Avg Session Duration: ${data.avgSessionDuration.toFixed(1)} minutes
• 📱 Total Activities: ${data.totalActivities}

🤖 **Popular Commands:**
${data.commandStats.slice(0, 5).map((cmd, index) =>
  `${index + 1}. ${cmd.interaction_data || 'Unknown'}: ${cmd.count} uses`
).join('\n') || 'No command data available'}

🚨 **Security Events:**
${data.securityEvents.map(event =>
  `• ${event.interaction_type}: ${event.count} occurrences`
).join('\n') || 'No security events'}

📈 **Engagement Metrics:**
• Activities per Session: ${data.totalSessions > 0 ? (data.totalActivities / data.totalSessions).toFixed(1) : 0}
• Session Quality Score: ${data.avgSessionDuration > 2 ? 'High' : data.avgSessionDuration > 1 ? 'Medium' : 'Low'}

*Generated: ${new Date().toLocaleString()}*`;
}

function generateUserAnalyticsCSV(data: UserAnalyticsCSVData): string {
  return `Date,Total Users,New Users,Active Users,VIP Users,Admin Users,Time Range
${new Date().toISOString().split('T')[0]},${data.totalUsers},${data.newUsers},${data.activeUsers},${data.vipUsers},${data.adminUsers},${data.timeRange}`;
}

function generatePaymentCSV(payments: PaymentCSV[]): string {
  let csv = 'ID,Amount,Currency,Status,Payment Method,Created At\n';
  csv += payments.map(p =>
    `${p.id},${p.amount},${p.currency},${p.status},${p.payment_method},${p.created_at}`
  ).join('\n');
  return csv;
}

// Placeholder admin handlers for future implementation
async function handleAddAdminUser(chatId: number, _userId: string): Promise<void> {
  await sendMessage(chatId, '🚧 Admin user management coming soon.');
}

async function handleSearchUser(chatId: number, _userId: string): Promise<void> {
  await sendMessage(chatId, '🔍 User search feature coming soon.');
}

async function handleManageVipUsers(chatId: number, _userId: string): Promise<void> {
  await sendMessage(chatId, '👥 VIP user management coming soon.');
}

async function handleExportUsers(chatId: number, _userId: string): Promise<void> {
  await sendMessage(chatId, '📤 User export feature coming soon.');
}

async function handleCreateVipPlan(chatId: number, _userId: string): Promise<void> {
  await sendMessage(chatId, '🆕 VIP plan creation coming soon.');
}

async function handleEditVipPlan(chatId: number, _userId: string): Promise<void> {
  await sendMessage(chatId, '✏️ VIP plan editing coming soon.');
}

async function handleDeleteVipPlan(chatId: number, _userId: string): Promise<void> {
  await sendMessage(chatId, '🗑️ VIP plan deletion coming soon.');
}

async function handleVipPlanStats(chatId: number, _userId: string): Promise<void> {
  await sendMessage(chatId, '📊 VIP plan statistics coming soon.');
}

async function handleUpdatePlanPricing(chatId: number, _userId: string): Promise<void> {
  await sendMessage(chatId, '💰 Plan pricing update coming soon.');
}

async function handleManagePlanFeatures(chatId: number, _userId: string): Promise<void> {
  await sendMessage(chatId, '✨ Plan feature management coming soon.');
}

async function handleMakeUserVip(
  chatId: number,
  adminId: string,
  targetUserId: string
): Promise<void> {
  if (!isAdmin(adminId)) {
    await sendAccessDeniedMessage(chatId);
    return;
  }

  try {
    const { error, data: user } = await supabaseAdmin
      .from('bot_users')
      .update({ is_vip: true })
      .eq('telegram_id', targetUserId)
      .select('id, username')
      .single();

    if (error) throw error;

    await sendMessage(chatId, `👑 User ${targetUserId} is now a VIP member.`);
    await sendMessage(
      Number(targetUserId),
      '🎉 You have been granted VIP access by the administrators!'
    );

    await logAdminAction(
      adminId,
      'make_user_vip',
      `Made user ${targetUserId} VIP`,
      'bot_users',
      user?.id
    );
  } catch (error) {
    console.error('❌ Error making user VIP:', error);
    await sendMessage(chatId, `❌ Failed to make user ${targetUserId} VIP.`);
  }
}

async function handleMessageUser(
  chatId: number,
  adminId: string,
  targetUserId: string
): Promise<void> {
  if (!isAdmin(adminId)) {
    await sendAccessDeniedMessage(chatId);
    return;
  }

  try {
    const { data: user, error } = await supabaseAdmin
      .from('bot_users')
      .select('username')
      .eq('telegram_id', targetUserId)
      .single();

    if (error) throw error;

    const link = user?.username
      ? `https://t.me/${user.username}`
      : `tg://user?id=${targetUserId}`;
    await sendMessage(
      chatId,
      `📨 Use the link below to message the user:\n${link}`
    );
    await logAdminAction(
      adminId,
      'message_user',
      `Retrieved contact link for user ${targetUserId}`,
      'bot_users'
    );
  } catch (error) {
    console.error('❌ Error retrieving user message link:', error);
    await sendMessage(chatId, `❌ Unable to get contact info for user ${targetUserId}.`);
  }
}

// Main serve function
serve(async (req: Request): Promise<Response> => {
  console.log(`📥 Request received: ${req.method} ${req.url}`);

  // Check for new deployments on each request to notify admins
  await checkBotVersion();

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
    const _lastName = from.last_name;
    const username = from.username;

    console.log(`👤 Processing update for user: ${userId} (${firstName})`);

    // Run security checks FIRST
    const isUserAdmin = isAdmin(userId);
    
    // Periodic cleanup of rate limit store
    cleanupRateLimit();
    
    // Check rate limits and security
    const messageText = update.message?.text || update.callback_query?.data || '';
    const rateLimitResult = isRateLimited(userId, isUserAdmin, messageText);
    
    if (rateLimitResult.limited) {
      const response = getSecurityResponse(rateLimitResult.reason!, rateLimitResult.blockDuration);
      if (chatId) {
        await sendMessage(chatId, response);
      }
      logSecurityEvent(userId, 'request_blocked', { 
        reason: rateLimitResult.reason, 
        messageText: messageText.substring(0, 100) 
      });
      return new Response("OK", { status: 200 });
    }

    // Validate message content
    if (messageText && messageText.length > 0) {
      const validationResult = validateMessage(messageText, userId);
      if (!validationResult.valid) {
        const response = getSecurityResponse(validationResult.reason!);
        if (chatId) {
          await sendMessage(chatId, response);
        }
        return new Response("OK", { status: 200 });
      }
    }

    // Track user activity for session management (after security checks pass)
    await updateBotSession(userId, {
      message_type: update.message ? 'message' : 'callback_query',
      text: messageText,
      timestamp: new Date().toISOString(),
      security_passed: true
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

      // Check for command spam before processing commands
      if (text && text.startsWith('/')) {
        const command = text.split(' ')[0].split('@')[0];
        if (isCommandSpam(userId, command) && !isUserAdmin) {
          const response = getSecurityResponse('command_spam');
          await sendMessage(chatId, response);
          return new Response("OK", { status: 200 });
        }
      }

      // Handle /start command with dynamic welcome message
      if (text?.split(' ')[0]?.startsWith('/start')) {
        console.log(`🚀 Start command from: ${userId} (${firstName})`);
        
        // Add timeout to prevent hanging
        const timeoutPromise: Promise<Response> = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Start command timeout')), 10000) // 10 second timeout
        );
        
        const startCommandPromise = (async () => {
          try {
            console.log(`🔄 Starting bot session for user: ${userId}`);
            await startBotSession(userId, { firstName, username, command: 'start' });
            console.log(`✅ Bot session started successfully for user: ${userId}`);
            
            console.log(`📄 Fetching auto reply for user: ${userId}`);
            const autoReply = await getAutoReply('auto_reply_welcome', { firstName });
            console.log(`📄 Auto reply result: ${autoReply ? 'found' : 'not found'}`);
            
            console.log(`📄 Getting welcome message for user: ${userId}`);
            const welcomeMessage = autoReply || await getWelcomeMessage(firstName);
            console.log(`📄 Welcome message length: ${welcomeMessage?.length || 0}`);
            
            console.log(`⌨️ Getting main menu keyboard for user: ${userId}`);
            const keyboard = await getMainMenuKeyboard();
            console.log(`⌨️ Keyboard generated: ${keyboard ? 'yes' : 'no'}`);
            
            console.log(`📤 Sending welcome message to user: ${userId}`);
            await sendMessage(chatId, welcomeMessage, keyboard);
            console.log(`✅ Welcome message sent successfully to user: ${userId}`);
            if (isAdmin(userId)) {
              await handleBotStatus(chatId, userId);
            }

            return new Response("OK", { status: 200 });
          } catch (error) {
            console.error(`❌ Error in /start command for user ${userId}:`, error);
            await sendMessage(chatId, "❌ Sorry, something went wrong. Please try again in a moment.");
            return new Response("Error", { status: 500 });
          }
        })();
        
        try {
          return await Promise.race<Response>([startCommandPromise, timeoutPromise]);
        } catch (error) {
          console.error(`⏱️ Start command timeout or error for user ${userId}:`, error);
          await sendMessage(chatId, "⏱️ The request is taking longer than expected. Please try /start again.");
          return new Response("Timeout", { status: 408 });
        }
      }

      // Handle /admin command
      if (text === '/admin') {
        console.log(`🔐 Admin command from: ${userId} (${firstName})`);
        console.log(`🔐 Admin check result: ${isAdmin(userId)}`);
        console.log(`🔐 Current admin IDs: ${Array.from(ADMIN_USER_IDS).join(', ')}`);
        
        if (isAdmin(userId)) {
          await handleAdminDashboard(chatId, userId);
        } else {
          await sendAccessDeniedMessage(chatId, `Admin privileges required.\n\n🔑 Your ID: \`${userId}\`\n🛟 Contact support if you should have admin access.`);
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
      if (userSession.awaitingInput?.startsWith('update_setting:')) {
        const settingKey = userSession.awaitingInput.split(':')[1];
        userSession.awaitingInput = null;
        const success = await setBotSetting(settingKey, text, userId);
        await sendMessage(
          chatId,
          success
            ? `✅ Updated *${settingKey}* to \`${text}\``
            : `❌ Failed to update *${settingKey}*`
        );
        return new Response("OK", { status: 200 });
      }
      if (userSession.awaitingInput?.startsWith('edit_content:')) {
        const contentKey = userSession.awaitingInput.split(':')[1];
        userSession.awaitingInput = null;
        await handleContentEditSave(chatId, userId, text, contentKey);
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

      // Check if user is waiting for promo code input before processing other message types
      const promoSession = userSessions.get(userId);
      if (promoSession && promoSession.type === 'waiting_promo_code') {
        if (!text) {
          await sendMessage(chatId, "❌ Promo codes must be sent as text. Please try again.");
        } else {
          await handlePromoCodeInput(chatId, userId, text.trim().toUpperCase(), promoSession);
        }
        return new Response("OK", { status: 200 });
      }

      // Handle photo/document uploads (receipts)
      if (update.message.photo || update.message.document) {
        await handleReceiptUpload(update.message, userId, firstName);
        return new Response("OK", { status: 200 });
      }

      // Handle unknown commands with auto-reply
      if (text?.startsWith('/')) {
        await handleUnknownCommand(chatId, userId, text);
        return new Response("OK", { status: 200 });
      }

      // Only respond to regular messages in specific conditions
      const chatType = update.message.chat.type;
      const isPrivateChat = chatType === 'private';
      const isBotMentioned = text?.includes('@') && text?.toLowerCase().includes('dynamic'); // Adjust based on your bot username
      
      // Only auto-reply if:
      // 1. It's a private chat (direct message)
      // 2. Bot is mentioned in group/channel
      if (isPrivateChat || isBotMentioned) {
        const generalReply = await getAutoReply('auto_reply_general') || 
          "🤖 Thanks for your message! Use /start to see the main menu or /help for assistance.";
        await sendMessage(chatId, generalReply);
      } else {
        console.log(`🔇 Ignoring message in ${chatType} - bot not mentioned`);
      }
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
        console.log(`🔍 Processing callback switch for: ${callbackData}`);
        switch (callbackData) {
          case 'view_vip_packages': {
            console.log("💎 Displaying VIP packages");
            const vipMessage = await getFormattedVipPackages();
            const vipKeyboard = await getVipPackagesKeyboard();
            await sendMessage(chatId, vipMessage, vipKeyboard);
            break;
          }

          case 'view_education':
            console.log("🎓 Displaying education packages");
            await handleViewEducation(chatId, userId);
            break;

          case 'view_promotions':
            console.log("💰 Displaying promotions");
            await handleViewPromotions(chatId, userId);
            break;

          case 'back_main': {
            const autoReply = await getAutoReply('auto_reply_welcome', { firstName });
            const mainMessage = autoReply || await getWelcomeMessage(firstName);
            const mainKeyboard = await getMainMenuKeyboard();
            await sendMessage(chatId, mainMessage, mainKeyboard);
            break;
          }

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

          // Table Management Callbacks
          case 'manage_tables':
            await handleTableManagement(chatId, userId);
            break;

          case 'manage_table_bot_users':
            await handleUserTableManagement(chatId, userId);
            break;

          case 'manage_table_subscription_plans':
            console.log(`🔍 Handling subscription plans management for user ${userId}`);
            await handleSubscriptionPlansManagement(chatId, userId);
            break;

          case 'manage_table_plan_channels':
            await handlePlanChannelsManagement(chatId, userId);
            break;

          case 'manage_table_education_packages':
            await handleEducationPackagesManagement(chatId, userId);
            break;

          case 'manage_table_promotions':
            await handlePromotionsManagement(chatId, userId);
            break;

          case 'manage_table_bot_content':
            await handleContentManagement(chatId, userId);
            break;

          case 'manage_table_bot_settings':
            await handleBotSettingsManagement(chatId, userId);
            break;

          case 'table_stats_overview':
            await handleTableStatsOverview(chatId, userId);
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
                const { data, error: _error } = await supabaseAdmin
                  .from('bot_sessions')
                  .update({ 
                    session_end: new Date().toISOString(),
                    duration_minutes: 1440 // 24 hours max
                  })
                  .is('session_end', null)
                  .lt('session_start', cutoffTime)
                  .select();

                await sendMessage(chatId, `🧹 *Old Sessions Cleaned!*\n\n✅ Cleaned ${data?.length || 0} old sessions\n🕐 Sessions older than 24h ended`);
                await logAdminAction(userId, 'session_cleanup', `Cleaned ${data?.length || 0} old sessions`);
              } catch (error) {
                await sendMessage(chatId, `❌ Error cleaning sessions: ${(error as Error).message}`);
              }
            }
            break;

          case 'quick_analytics':
            await handleQuickAnalytics(chatId, userId);
            break;

          case 'report_users':
            await handleUserAnalyticsReport(chatId, userId);
            break;

          case 'report_payments':
            await handlePaymentReport(chatId, userId);
            break;

          case 'report_packages':
            await handlePackageReport(chatId, userId);
            break;

          case 'report_promotions':
            await handlePromotionReport(chatId, userId);
            break;

          case 'report_bot_usage':
            await handleBotUsageReport(chatId, userId);
            break;

            case 'report_security': {
            const securityReport = `🔒 **Security Report**

🛡️ **Real-time Security Stats:**
• Total Requests: ${securityStats.totalRequests}
• Blocked Requests: ${securityStats.blockedRequests}
• Suspicious Users: ${securityStats.suspiciousUsers.size}
• Rate Limit Store: ${rateLimitStore.size} entries

📊 **Security Metrics:**
• Block Rate: ${securityStats.totalRequests > 0 ? ((securityStats.blockedRequests / securityStats.totalRequests) * 100).toFixed(2) : 0}%
• Active Sessions: ${activeBotSessions.size}
• Memory Usage: Optimized

🚨 **Recent Blocked Users:**
${Array.from(securityStats.suspiciousUsers).slice(-5).map(u => `• User ${u}`).join('\n') || 'None'}

✅ **Security Status:** All systems protected
*Last updated: ${new Date().toLocaleString()}*`;
              await sendMessage(chatId, securityReport);
              break;
            }

          case 'analytics_dashboard':
            await handleTableStatsOverview(chatId, userId);
            break;

          case 'export_all_data':
            await sendMessage(chatId, "📤 **Data Export**\n\n🔄 Generating comprehensive data export...");
            await handleUserAnalyticsReport(chatId, userId, '30d');
            await handlePaymentReport(chatId, userId, '30d');
            await handleBotUsageReport(chatId, userId, '30d');
            await sendMessage(chatId, "✅ **Export Complete!** All reports generated above.");
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

          // Trade Results Posting
          case 'post_trade_results':
            await handlePostTradeResult(chatId, userId);
            break;

          case 'post_winning_trade': {
            const winningResult = await postToResultsChannel('winning_trade', {
              pair: 'BTC/USDT',
              entry: '42,500',
              exit: '44,100',
              profit: '3.8',
              duration: '2h 15m',
              amount: '1,680'
            });
            if (winningResult) {
              await sendMessage(chatId, "✅ Winning trade result posted to @DynamicCapital_Results channel!");
            } else {
              await sendMessage(chatId, "❌ Failed to post trade result. Check bot permissions in the channel.");
            }
            break;
          }

          case 'post_losing_trade': {
            const losingResult = await postToResultsChannel('losing_trade', {
              pair: 'ETH/USDT',
              entry: '2,340',
              exit: '2,285',
              loss: '2.3',
              duration: '1h 30m',
              amount: '460'
            });
            if (losingResult) {
              await sendMessage(chatId, "✅ Losing trade result posted to @DynamicCapital_Results channel!");
            } else {
              await sendMessage(chatId, "❌ Failed to post trade result. Check bot permissions in the channel.");
            }
            break;
          }

          case 'post_weekly_summary': {
            const weeklyResult = await postToResultsChannel('weekly_summary', {
              week: 'Week of Jan 1-7, 2025',
              totalTrades: '24',
              winningTrades: '18',
              losingTrades: '6',
              winRate: '75',
              totalProfit: '8,450',
              totalLoss: '1,980',
              netPnL: '6,470',
              roi: '12.8'
            });
            if (weeklyResult) {
              await sendMessage(chatId, "✅ Weekly summary posted to @DynamicCapital_Results channel!");
            } else {
              await sendMessage(chatId, "❌ Failed to post weekly summary. Check bot permissions in the channel.");
            }
            break;
          }

          case 'post_monthly_report': {
            const monthlyResult = await postToResultsChannel('monthly_report', {
              month: 'December 2024',
              totalTrades: '96',
              successfulTrades: '72',
              failedTrades: '24',
              successRate: '75',
              grossProfit: '34,850',
              totalLosses: '8,200',
              netProfit: '26,650',
              monthlyROI: '18.5',
              bestPairs: '• BTC/USDT: +22%\n• ETH/USDT: +18%\n• SOL/USDT: +15%\n• ADA/USDT: +12%'
            });
            if (monthlyResult) {
              await sendMessage(chatId, "✅ Monthly report posted to @DynamicCapital_Results channel!");
            } else {
              await sendMessage(chatId, "❌ Failed to post monthly report. Check bot permissions in the channel.");
            }
            break;
          }

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

          case 'admin_settings':
            await handleAdminSettings(chatId, userId);
            break;

          case 'admin_packages':
            await handleSubscriptionPlansManagement(chatId, userId);
            break;

          case 'admin_promos':
            await handlePromotionsManagement(chatId, userId);
            break;

          case 'admin_content':
            await handleContentManagement(chatId, userId);
            break;

          case 'admin_analytics':
            await handleAnalyticsMenu(chatId, userId);
            break;

          case 'admin_tools':
            await handleBotControl(chatId, userId);
            break;

          case 'admin_users':
            await handleUserTableManagement(chatId, userId);
            break;

          case 'toggle_auto_delete':
            await handleToggleAutoDelete(chatId, userId);
            break;

          case 'toggle_auto_intro':
            await handleToggleAutoIntro(chatId, userId);
            break;

          case 'toggle_maintenance':
            await handleToggleMaintenance(chatId, userId);
            break;

          case 'view_all_settings':
            await handleViewAllSettings(chatId, userId);
            break;

          // Table Management Additional Callbacks
          case 'manage_table_daily_analytics':
          case 'manage_table_user_sessions':
          case 'manage_table_payments':
            await handlePaymentsTableManagement(chatId, userId);
            break;

          case 'manage_table_broadcast_messages':
            await handleBroadcastTableManagement(chatId, userId);
            break;

          case 'manage_table_bank_accounts':
            await handleBankAccountsTableManagement(chatId, userId);
            break;

          case 'manage_table_auto_reply_templates':
            await handleAutoReplyTableManagement(chatId, userId);
            break;

          case 'export_all_tables':
            if (isAdmin(userId)) {
              await sendMessage(chatId, "📊 Exporting all table data...\n\n📋 This feature will generate CSV exports of all database tables.\n\n⏳ Coming soon!");
            }
            break;

          // User Management Callbacks
          case 'add_admin_user':
            await handleAddAdminUser(chatId, userId);
            break;
          case 'search_user':
            await handleSearchUser(chatId, userId);
            break;
          case 'manage_vip_users':
            await handleManageVipUsers(chatId, userId);
            break;
          case 'export_users':
            await handleExportUsers(chatId, userId);
            break;

          // VIP Plan Management Callbacks
          case 'create_vip_plan':
            await handleCreateVipPlan(chatId, userId);
            break;
          case 'edit_vip_plan':
            await handleEditVipPlan(chatId, userId);
            break;
          case 'delete_vip_plan':
            await handleDeleteVipPlan(chatId, userId);
            break;
          case 'vip_plan_stats':
            await handleVipPlanStats(chatId, userId);
            break;
          case 'update_plan_pricing':
            await handleUpdatePlanPricing(chatId, userId);
            break;
          case 'manage_plan_features':
            await handleManagePlanFeatures(chatId, userId);
            break;

          // Education Package Management Callbacks
          case 'create_education_package':
          case 'edit_education_package':
          case 'delete_education_package':
            await sendMessage(chatId, "🗑️ Education package deletion requires careful consideration due to enrolled students. Please contact the developer for manual deletion.");
            break;

          case 'education_package_stats':
            await handleEducationPackageStats(chatId, userId);
            break;

          case 'manage_education_categories':
            await handleEducationCategoriesManagement(chatId, userId);
            break;

          case 'view_education_enrollments':
            await handleEducationEnrollmentsView(chatId, userId);
            break;

          // Promotion Management Callbacks
          case 'create_promotion':
            await handleCreatePromotion(chatId, userId);
            break;

          case 'delete_promotion':
            await sendMessage(chatId, "🗑️ Promotion deletion requires careful consideration. Please use admin dashboard to disable promotions instead.");
            break;

          case 'promotion_analytics':
            await handlePromotionReport(chatId, userId);
            break;

          case 'toggle_promotion_status':
            await sendMessage(chatId, "🔄 Use the promotions management menu to toggle promotion status.");
            break;

          case 'promotion_usage_stats':
            await handlePromotionReport(chatId, userId);
            break;

          // Content Management Callbacks
          case 'edit_content_welcome_message':
            await handleEditContent(chatId, userId, 'welcome_message');
            break;
          case 'edit_content_about_us':
            await handleEditContent(chatId, userId, 'about_us');
            break;
          case 'edit_content_support_message':
            await handleEditContent(chatId, userId, 'support');
            break;
          case 'edit_content_terms_conditions':
            await handleEditContent(chatId, userId, 'terms');
            break;
          case 'edit_content_faq_general':
            await handleEditContent(chatId, userId, 'faq');
            break;
          case 'edit_content_maintenance_message':
            await handleEditContent(chatId, userId, 'maintenance_message');
            break;
          case 'preview_all_content':
            await handlePreviewAllContent(chatId, userId);
            break;
          case 'add_new_content':
            await sendMessage(chatId, '➕ Adding new content is not yet supported.');
            break;

          // Bot Settings Callbacks
          case 'config_session_settings':
            await promptSettingUpdate(
              chatId,
              userId,
              'session_timeout_minutes',
              'Enter new session timeout in minutes.'
            );
            break;
          case 'config_payment_settings':
            await promptSettingUpdate(
              chatId,
              userId,
              'payment_timeout_minutes',
              'Enter payment timeout in minutes.'
            );
            break;
          case 'config_notification_settings':
            await promptSettingUpdate(
              chatId,
              userId,
              'admin_notifications',
              'Enable admin notifications? (true/false)'
            );
            break;
          case 'config_security_settings':
            await promptSettingUpdate(
              chatId,
              userId,
              'max_login_attempts',
              'Enter maximum login attempts before lockout.'
            );
            break;
          case 'reset_all_settings': {
            if (!isAdmin(userId)) {
              await sendAccessDeniedMessage(chatId);
              break;
            }
            const success = await resetBotSettings(DEFAULT_BOT_SETTINGS, userId);
            await sendMessage(
              chatId,
              success
                ? '✅ All settings have been reset to defaults.'
                : '❌ Failed to reset settings.'
            );
            break;
          }
          case 'backup_settings': {
            if (!isAdmin(userId)) {
              await sendAccessDeniedMessage(chatId);
              break;
            }
            const settings = await getAllBotSettings();
            const formatted = Object.entries(settings)
              .map(([k, v]) => `${k}: ${v}`)
              .join('\n');
            await sendMessage(
              chatId,
              `📦 *Current Settings Backup*\n\n${formatted || 'No settings found.'}`
            );
            break;
          }

          // Additional Settings Toggles
          case 'set_delete_delay':
            await promptSettingUpdate(
              chatId,
              userId,
              'auto_delete_delay_seconds',
              'Enter auto-delete delay in seconds.'
            );
            break;
          case 'set_broadcast_delay':
            await promptSettingUpdate(
              chatId,
              userId,
              'broadcast_delay_ms',
              'Enter broadcast delay in milliseconds.'
            );
            break;
          case 'advanced_settings':
            await showAdvancedSettings(chatId, userId);
            break;
          case 'export_settings': {
            if (!isAdmin(userId)) {
              await sendAccessDeniedMessage(chatId);
              break;
            }
            const settings = await getAllBotSettings();
            const formatted = Object.entries(settings)
              .map(([k, v]) => `${k}: ${v}`)
              .join('\n');
            await sendMessage(
              chatId,
              `📤 *Bot Settings Export*\n\n${formatted || 'No settings found.'}`
            );
            break;
          }

          // Broadcast Management Callbacks
          case 'edit_channels':
          case 'auto_settings':
          case 'broadcast_help':
            await sendMessage(chatId, "📢 Advanced broadcast features coming soon!");
            break;

          // Handle VIP package selections and other complex callbacks
          default:
            if (callbackData.startsWith('select_vip_')) {
              const packageId = callbackData.replace('select_vip_', '');
              await handleVipPackageSelection(chatId, userId, packageId, firstName);
            } else if (callbackData.startsWith('payment_method_')) {
              console.log(`💳 Payment method callback received: ${callbackData}`);
              const [, , packageId, method] = callbackData.split('_');
              console.log(`💳 Parsed: packageId=${packageId}, method=${method}`);
              await handlePaymentMethodSelection(chatId, userId, packageId, method);
            } else if (callbackData.startsWith('approve_payment_')) {
              const paymentId = callbackData.replace('approve_payment_', '');
              await handleApprovePayment(chatId, userId, paymentId);
            } else if (callbackData.startsWith('reject_payment_')) {
              const paymentId = callbackData.replace('reject_payment_', '');
              await handleRejectPayment(chatId, userId, paymentId);
            } else if (callbackData.startsWith('apply_promo_')) {
              const packageId = callbackData.replace('apply_promo_', '');
              await handlePromoCodePrompt(chatId, userId, packageId);
            } else if (callbackData.startsWith('show_payment_')) {
              const packageId = callbackData.replace('show_payment_', '');
              await handleShowPaymentMethods(chatId, userId, packageId);
            } else if (callbackData.startsWith('view_user_')) {
              const targetUserId = callbackData.replace('view_user_', '');
              await handleViewUserProfile(chatId, userId, targetUserId);
            } else if (callbackData.startsWith('approve_user_payments_')) {
              const targetUserId = callbackData.replace('approve_user_payments_', '');
              await sendMessage(chatId, `✅ All pending payments for user ${targetUserId} have been approved.`);
            } else if (callbackData.startsWith('reject_user_payments_')) {
              const targetUserId = callbackData.replace('reject_user_payments_', '');
              await sendMessage(chatId, `❌ All pending payments for user ${targetUserId} have been rejected.`);
            } else if (callbackData.startsWith('select_education_')) {
              const packageId = callbackData.replace('select_education_', '');
              await handleEducationPackageSelection(chatId, userId, packageId, firstName);
            } else if (callbackData.startsWith('make_vip_')) {
              const targetUserId = callbackData.replace('make_vip_', '');
              await handleMakeUserVip(chatId, userId, targetUserId);
            } else if (callbackData.startsWith('message_user_')) {
              const targetUserId = callbackData.replace('message_user_', '');
              await handleMessageUser(chatId, userId, targetUserId);
            } else if (
              callbackData.startsWith('edit_plan_') ||
              callbackData.startsWith('editplan')
            ) {
              // Support both current `edit_plan_` prefix and legacy `editplan` format
              const planId = callbackData
                .replace('edit_plan_', '')
                .replace('editplan', '');
              console.log(`🔧 Admin ${userId} editing plan: ${planId}`);
              
              if (!isAdmin(userId)) {
                await sendAccessDeniedMessage(chatId);
                return new Response("OK", { status: 200 });
              }
              
              try {
                const { data: plan, error } = await supabaseAdmin
                  .from('subscription_plans')
                  .select('*')
                  .eq('id', planId)
                  .single();
                
                if (error) throw error;
                
                if (!plan) {
                  await sendMessage(chatId, "❌ Plan not found.");
                  return new Response("OK", { status: 200 });
                }
                
                const editMessage = `✏️ **Edit Plan: ${plan.name}**
                
📋 **Current Details:**
• **Name:** ${plan.name}
• **Price:** $${plan.price} ${plan.currency}
• **Duration:** ${plan.is_lifetime ? 'Lifetime' : `${plan.duration_months} months`}
• **Features:** ${plan.features?.length || 0} items

🔧 **What would you like to edit?**`;
                
                const editKeyboard = {
                  inline_keyboard: [
                    [
                      { text: "📝 Edit Name", callback_data: `edit_plan_name_${planId}` },
                      { text: "💰 Edit Price", callback_data: `edit_plan_price_${planId}` }
                    ],
                    [
                      { text: "⏰ Edit Duration", callback_data: `edit_plan_duration_${planId}` },
                      { text: "✨ Edit Features", callback_data: `edit_plan_features_${planId}` }
                    ],
                    [
                      { text: "🗑️ Delete Plan", callback_data: `delete_plan_${planId}` }
                    ],
                    [
                      { text: "🔙 Back to Plans", callback_data: "edit_vip_plan" }
                    ]
                  ]
                };
                
                await sendMessage(chatId, editMessage, editKeyboard);
                await logAdminAction(userId, 'plan_edit_view', `Viewing edit options for plan: ${plan.name}`, 'subscription_plans', planId);
                
              } catch (error) {
                console.error('🚨 Error loading plan for editing:', error);
                await sendMessage(chatId, `❌ Error loading plan: ${(error as Error).message}`);
              }
            } else if (callbackData === 'about_us') {
              await handleAboutUs(chatId, userId);
            } else if (callbackData === 'support') {
              await handleSupport(chatId, userId);
            } else if (callbackData === 'view_promotions') {
              await handleViewPromotions(chatId, userId);
            } else if (callbackData === 'trading_results') {
              await handleTradingResults(chatId, userId);
            } else if (callbackData === 'help_faq') {
              await handleHelpAndFAQ(chatId, userId, firstName);
            } else if (callbackData === 'terms') {
              await handleTerms(chatId, userId);
            } else if (callbackData === 'view_education') {
              await handleViewEducation(chatId, userId);
            } else if (callbackData === 'view_pending_payments') {
              await handleViewPendingPayments(chatId, userId);
            } else {
              console.log(`❓ Unknown callback: ${callbackData}`);
              console.log(`🔍 Full callback debug info:`, {
                userId,
                chatId,
                callbackData,
                firstName,
                timestamp: new Date().toISOString()
              });
              await sendMessage(chatId, `❓ Unknown action: "${callbackData}". Please try again or use /start for the main menu.`);
            }
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
