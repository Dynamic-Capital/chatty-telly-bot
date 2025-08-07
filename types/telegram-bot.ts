/**
 * Telegram Bot TypeScript Definitions
 *
 * Comprehensive type definitions for the Dynamic Capital VIP Bot
 * Compatible with AI code generation tools (Codex, ChatGPT, Bolt)
 *
 * @author Dynamic Capital Team
 * @version 1.0.0
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// ============================================
// Core Bot Interfaces
// ============================================

export interface BotUser {
  id: string;
  telegram_id: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  is_admin: boolean;
  is_vip: boolean;
  current_plan_id?: string;
  subscription_expires_at?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  follow_up_count?: number;
  last_follow_up?: string;
}

export interface BotSession {
  id: string;
  telegram_user_id: string;
  session_start: string;
  session_end?: string;
  session_data: Record<string, any>;
  activity_count: number;
  duration_minutes?: number;
  user_agent?: string;
  ip_address?: string;
  created_at: string;
  updated_at: string;
}

export interface BotContent {
  id: string;
  content_key: string;
  content_value: string;
  content_type: 'text' | 'html' | 'markdown';
  description?: string;
  is_active: boolean;
  created_by?: string;
  last_modified_by?: string;
  created_at: string;
  updated_at: string;
}

export interface BotSettings {
  id: string;
  setting_key: string;
  setting_value: string;
  setting_type: 'string' | 'number' | 'boolean' | 'json';
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================
// Subscription & Payment Interfaces
// ============================================

export interface PlanChannel {
  id: string;
  plan_id: string;
  channel_name: string;
  channel_type: 'channel' | 'group';
  invite_link: string;
  chat_id?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  currency: string;
  duration_months: number;
  is_lifetime: boolean;
  features: string[];
  created_at: string;
  updated_at: string;
}

export interface UserSubscription {
  id: string;
  telegram_user_id: string;
  plan_id?: string;
  is_active: boolean;
  payment_status: 'pending' | 'completed' | 'failed' | 'cancelled';
  payment_method?: string;
  subscription_start_date?: string;
  subscription_end_date?: string;
  payment_instructions?: string;
  bank_details?: string;
  receipt_file_path?: string;
  receipt_telegram_file_id?: string;
  telegram_username?: string;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  user_id: string;
  plan_id: string;
  amount: number;
  currency: string;
  payment_method: string;
  payment_provider_id?: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  webhook_data?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// ============================================
// Education & Content Interfaces
// ============================================

export interface EducationPackage {
  id: string;
  name: string;
  description?: string;
  detailed_description?: string;
  price: number;
  currency: string;
  duration_weeks: number;
  is_lifetime: boolean;
  is_active: boolean;
  is_featured: boolean;
  max_students?: number;
  current_students: number;
  category_id?: string;
  features: string[];
  requirements: string[];
  learning_outcomes: string[];
  instructor_name?: string;
  instructor_bio?: string;
  instructor_image_url?: string;
  thumbnail_url?: string;
  video_preview_url?: string;
  difficulty_level?: 'beginner' | 'intermediate' | 'advanced';
  starts_at?: string;
  enrollment_deadline?: string;
  created_at: string;
  updated_at: string;
}

export interface EducationEnrollment {
  id: string;
  package_id: string;
  student_telegram_id: string;
  student_telegram_username?: string;
  student_first_name?: string;
  student_last_name?: string;
  student_email?: string;
  student_phone?: string;
  enrollment_status: 'pending' | 'active' | 'completed' | 'cancelled';
  payment_status: 'pending' | 'completed' | 'failed';
  payment_method?: string;
  payment_amount?: number;
  payment_reference?: string;
  receipt_telegram_file_id?: string;
  receipt_file_path?: string;
  enrollment_date: string;
  start_date?: string;
  completion_date?: string;
  progress_percentage: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// ============================================
// Promotion & Analytics Interfaces
// ============================================

export interface Promotion {
  id: string;
  code: string;
  description?: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  max_uses?: number;
  current_uses: number;
  valid_from: string;
  valid_until: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PromotionUsage {
  id: string;
  promotion_id: string;
  telegram_user_id: string;
  used_at: string;
}

export interface UserInteraction {
  id: string;
  telegram_user_id: string;
  interaction_type: string;
  interaction_data?: Record<string, any>;
  session_id?: string;
  page_context?: string;
  created_at: string;
}

export interface DailyAnalytics {
  id: string;
  date: string;
  new_users: number;
  total_users: number;
  revenue: number;
  button_clicks: Record<string, number>;
  conversion_rates: Record<string, number>;
  top_promo_codes: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// ============================================
// Contact & Media Interfaces
// ============================================

export interface ContactLink {
  id: string;
  platform: string;
  url: string;
  display_name: string;
  icon_emoji?: string;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface MediaFile {
  id: string;
  filename: string;
  file_path: string;
  file_type: string;
  file_size?: number;
  telegram_file_id?: string;
  uploaded_by?: string;
  caption?: string;
  created_at: string;
  updated_at: string;
}

export interface BroadcastMessage {
  id: string;
  title: string;
  content?: string;
  media_type?: 'photo' | 'video' | 'document';
  media_url?: string;
  media_file_path?: string;
  media_file_id?: string;
  media_file_size?: number;
  media_mime_type?: string;
  target_audience: Record<string, any>;
  scheduled_at?: string;
  sent_at?: string;
  delivery_status: 'draft' | 'scheduled' | 'sending' | 'completed' | 'failed';
  total_recipients: number;
  successful_deliveries: number;
  failed_deliveries: number;
  created_at: string;
  updated_at: string;
}

// ============================================
// Admin & Security Interfaces
// ============================================

export interface AdminLog {
  id: string;
  admin_telegram_id: string;
  action_type: string;
  action_description: string;
  affected_table?: string;
  affected_record_id?: string;
  old_values?: Record<string, any>;
  new_values?: Record<string, any>;
  created_at: string;
}

export interface RateLimitEntry {
  count: number;
  lastReset: number;
  blocked?: boolean;
  blockUntil?: number;
  lastMessage?: string;
  identicalCount?: number;
}

export interface SecurityStats {
  totalRequests: number;
  blockedRequests: number;
  suspiciousUsers: Set<string>;
  lastCleanup: number;
}

// ============================================
// Telegram API Interfaces
// ============================================

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
  edited_message?: TelegramMessage;
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
  photo?: TelegramPhotoSize[];
  document?: TelegramDocument;
  entities?: TelegramMessageEntity[];
  reply_markup?: TelegramInlineKeyboardMarkup;
}

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
}

export interface TelegramChat {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
  chat_instance: string;
}

export interface TelegramInlineKeyboardMarkup {
  inline_keyboard: TelegramInlineKeyboardButton[][];
}

export interface TelegramInlineKeyboardButton {
  text: string;
  callback_data?: string;
  url?: string;
}

export interface TelegramPhotoSize {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  file_size?: number;
}

export interface TelegramDocument {
  file_id: string;
  file_unique_id: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
}

export interface TelegramMessageEntity {
  type: string;
  offset: number;
  length: number;
  url?: string;
  user?: TelegramUser;
}

// ============================================
// Function Response Interfaces
// ============================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface BotStats {
  total_users: number;
  vip_users: number;
  admin_users: number;
  pending_payments: number;
  completed_payments: number;
  total_revenue: number;
  daily_interactions: number;
  daily_sessions: number;
  last_updated: string;
}

export interface UserCompleteData {
  user_info: BotUser;
  active_subscriptions: UserSubscription[];
  recent_interactions: UserInteraction[];
  pending_payments: Payment[];
}

// ============================================
// Configuration Interfaces
// ============================================

export interface SecurityConfig {
  MAX_REQUESTS_PER_MINUTE: number;
  MAX_REQUESTS_PER_HOUR: number;
  MAX_IDENTICAL_MESSAGES: number;
  MAX_COMMANDS_PER_MINUTE: number;
  FLOOD_PROTECTION_WINDOW: number;
  SUSPICIOUS_THRESHOLD: number;
  AUTO_BLOCK_DURATION: number;
  TEMP_BLOCK_DURATION: number;
  MAX_MESSAGE_LENGTH: number;
  MIN_MESSAGE_INTERVAL: number;
  ADMIN_RATE_LIMIT_MULTIPLIER: number;
  CLEANUP_INTERVAL: number;
}

export interface BotConfig {
  BOT_TOKEN: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  OPENAI_API_KEY?: string;
  ADMIN_USER_IDS: Set<string>;
  SECURITY_CONFIG: SecurityConfig;
}

// ============================================
// Utility Types
// ============================================

export type DatabaseTable = 
  | 'bot_users'
  | 'bot_sessions'
  | 'bot_content'
  | 'bot_settings'
  | 'subscription_plans'
  | 'user_subscriptions'
  | 'payments'
  | 'education_packages'
  | 'education_enrollments'
  | 'promotions'
  | 'promotion_usage'
  | 'user_interactions'
  | 'daily_analytics'
  | 'contact_links'
  | 'media_files'
  | 'broadcast_messages'
  | 'admin_logs';

export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'cancelled';
export type SubscriptionStatus = 'pending' | 'active' | 'expired' | 'cancelled';
export type BroadcastStatus = 'draft' | 'scheduled' | 'sending' | 'completed' | 'failed';
export type UserRole = 'user' | 'vip' | 'admin';
export type ContentType = 'text' | 'html' | 'markdown';
export type SettingType = 'string' | 'number' | 'boolean' | 'json';
export type DiscountType = 'percentage' | 'fixed';
export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced';
export type ChatType = 'private' | 'group' | 'supergroup' | 'channel';
export type MediaType = 'photo' | 'video' | 'document' | 'audio';

// ============================================
// Function Parameter Types
// ============================================

export interface SendMessageParams {
  chatId: number;
  text: string;
  replyMarkup?: TelegramInlineKeyboardMarkup;
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  disableWebPagePreview?: boolean;
}

export interface EditMessageParams {
  chatId: number;
  messageId: number;
  text: string;
  replyMarkup?: TelegramInlineKeyboardMarkup;
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
}

export interface DeleteMessageParams {
  chatId: number;
  messageId: number;
}

export interface AnswerCallbackQueryParams {
  callbackQueryId: string;
  text?: string;
  showAlert?: boolean;
  url?: string;
  cacheTime?: number;
}

// ============================================
// Error Types
// ============================================

export interface BotError extends Error {
  code?: string;
  context?: Record<string, any>;
  userId?: string;
  chatId?: number;
}

export interface ValidationError extends BotError {
  field?: string;
  value?: any;
}

export interface RateLimitError extends BotError {
  remaining?: number;
  resetTime?: number;
}

// ============================================
// Handler Function Types
// ============================================

export type MessageHandler = (
  message: TelegramMessage,
  userId: string,
  chatId: number
) => Promise<void>;

export type CallbackHandler = (
  callbackQuery: TelegramCallbackQuery,
  userId: string,
  chatId: number,
  data: string
) => Promise<void>;

export type AdminHandler = (
  chatId: number,
  userId: string,
  ...args: any[]
) => Promise<void>;

// ============================================
// Database Function Types
// ============================================

export type DatabaseFunction = 
  | 'get_bot_content_batch'
  | 'get_bot_settings_batch'
  | 'get_user_complete_data'
  | 'get_dashboard_stats_fast'
  | 'is_user_admin'
  | 'batch_insert_user_interactions'
  | 'cleanup_old_media_files';

// ============================================
// Export All Types
// ============================================

export default {
  // Core interfaces
  BotUser,
  BotSession,
  BotContent,
  BotSettings,
  
  // Subscription interfaces
  SubscriptionPlan,
  UserSubscription,
  Payment,
  
  // Education interfaces
  EducationPackage,
  EducationEnrollment,
  
  // Analytics interfaces
  Promotion,
  PromotionUsage,
  UserInteraction,
  DailyAnalytics,
  
  // Media interfaces
  ContactLink,
  MediaFile,
  BroadcastMessage,
  
  // Admin interfaces
  AdminLog,
  RateLimitEntry,
  SecurityStats,
  
  // Telegram interfaces
  TelegramUpdate,
  TelegramMessage,
  TelegramUser,
  TelegramChat,
  TelegramCallbackQuery,
  
  // Response interfaces
  ApiResponse,
  BotStats,
  UserCompleteData,
  
  // Configuration
  SecurityConfig,
  BotConfig,
  
  // Function types
  MessageHandler,
  CallbackHandler,
  AdminHandler
};