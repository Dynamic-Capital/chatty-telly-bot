import { optionalEnv } from "../_shared/env.ts";
import { requireEnv as requireEnvCheck } from "./helpers/require-env.ts";
import { alertAdmins } from "../_shared/alerts.ts";
import { json, mna, ok, oops } from "../_shared/http.ts";
import { validateTelegramHeader } from "../_shared/telegram_secret.ts";
import {
  getFormattedVipPackages,
  getVipPackages,
  getEducationPackages,
  getActivePromotions,
} from "./database-utils.ts";
import { createClient } from "../_shared/client.ts";
type SupabaseClient = ReturnType<typeof createClient>;
import { getFlag, envOrSetting, getContent } from "../_shared/config.ts";
import { buildMainMenu, type MenuSection } from "./menu.ts";
import { readMiniAppEnv } from "./_miniapp.ts";
import {
  buildAdminCommandHandlers,
  type CommandContext,
  type CommandHandler,
} from "./admin-command-handlers.ts";
import { setCallbackMessageId } from "./admin-handlers/common.ts";
// Type definition moved inline to avoid import issues
interface Promotion {
  code: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
}

interface TelegramMessage {
  chat: { id: number; type?: string };
  from?: { id?: number; username?: string };
  message_id?: number;
  text?: string;
  caption?: string;
  photo?: { file_id: string }[];
  document?: { file_id: string; mime_type?: string };
  reply_to_message?: TelegramMessage;
  [key: string]: unknown;
}

interface TelegramCallback {
  id: string;
  from: { id: number; username?: string };
  data?: string;
  message?: TelegramMessage;
}

interface TelegramUpdate {
  message?: TelegramMessage;
  callback_query?: TelegramCallback;
  [key: string]: unknown;
}

interface PaymentIntent {
  id: string;
  user_id: string;
  method: string;
  status: string;
  expected_amount: number;
  expected_beneficiary_account_last4?: string;
  expected_beneficiary_name?: string;
  created_at: string;
  pay_code?: string | null;
}

const REQUIRED_ENV_KEYS = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "TELEGRAM_BOT_TOKEN",
] as const;

const SUPABASE_URL = optionalEnv("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = optionalEnv("SUPABASE_SERVICE_ROLE_KEY");
const BOT_TOKEN = await envOrSetting<string>("TELEGRAM_BOT_TOKEN");
const botUsername = (await envOrSetting<string>("TELEGRAM_BOT_USERNAME")) || "";

// Optional feature flags (currently unused)
const _OPENAI_ENABLED = optionalEnv("OPENAI_ENABLED") === "true";
const _FAQ_ENABLED = optionalEnv("FAQ_ENABLED") === "true";
let supabaseAdmin: SupabaseClient | null = null;
function getSupabase(): SupabaseClient | null {
  if (supabaseAdmin) return supabaseAdmin;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  try {
    supabaseAdmin = createClient();
  } catch (_e) {
    supabaseAdmin = null;
  }
  return supabaseAdmin;
}

type AdminHandlers = typeof import("./admin-handlers/index.ts");

let adminHandlers: AdminHandlers | null = null;
async function loadAdminHandlers(): Promise<AdminHandlers> {
  if (!adminHandlers) {
    adminHandlers = await import("./admin-handlers/index.ts");
  }
  return adminHandlers;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-telegram-bot-api-secret-token",
};

async function sendMessage(
  chatId: number,
  text: string,
  extra: Record<string, unknown> = {},
): Promise<number | null> {
  if (!BOT_TOKEN) {
    console.warn(
      "TELEGRAM_BOT_TOKEN is not set; cannot send message",
    );
    return null;
  }
  try {
    const r = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          disable_web_page_preview: true,
          allow_sending_without_reply: true,
          ...extra,
        }),
      },
    );
    const outText = await r.text();
    console.log("sendMessage", r.status, outText.slice(0, 200));
    try {
      const out = JSON.parse(outText);
      const id = out?.result?.message_id;
      return typeof id === "number" ? id : null;
    } catch {
      return null;
    }
  } catch (e) {
    console.error("sendMessage error", e);
    return null;
  }
}

async function editMessage(
  chatId: number,
  messageId: number,
  text: string,
  extra: Record<string, unknown> = {},
): Promise<number | null> {
  if (!BOT_TOKEN) {
    console.warn(
      "TELEGRAM_BOT_TOKEN is not set; cannot edit message",
    );
    return null;
  }
  try {
    const r = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          text,
          ...extra,
        }),
      },
    );
    const outText = await r.text();
    console.log("editMessage", r.status, outText.slice(0, 200));
    try {
      const out = JSON.parse(outText);
      const id = out?.result?.message_id;
      return typeof id === "number" ? id : null;
    } catch {
      return null;
    }
  } catch (e) {
    console.error("editMessage error", e);
    return null;
  }
}

async function answerCallbackQuery(
  cbId: string,
  opts: Record<string, unknown> = {},
): Promise<void> {
  if (!BOT_TOKEN) {
    console.warn(
      "TELEGRAM_BOT_TOKEN is not set; cannot answer callback query",
    );
    return;
  }
  try {
    const r = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callback_query_id: cbId, ...opts }),
      },
    );
    const out = await r.text();
    console.log("answerCallbackQuery", r.status, out.slice(0, 200));
  } catch (e) {
    console.error("answerCallbackQuery error", e);
  }
}

async function notifyUser(
  chatId: number,
  text: string,
  extra: Record<string, unknown> = {},
): Promise<void> {
  await sendMessage(chatId, text, extra);
}

async function hasMiniApp(): Promise<boolean> {
  const { url, short } = await readMiniAppEnv();
  if (url) return true;
  const bot = await envOrSetting("TELEGRAM_BOT_USERNAME");
  return Boolean(short && bot);
}

export async function sendMiniAppLink(
  chatId: number,
  opts: { silent?: boolean } = {},
): Promise<string | null> {
  const { silent } = opts;
  if (!BOT_TOKEN) return null;
  if (!(await getFlag("mini_app_enabled", true))) {
    if (!silent) {
      const msg = await getContent("checkout_unavailable") ??
        "Checkout is currently unavailable. Please try again later.";
      await sendMessage(chatId, msg);
    }
    return null;
  }

  const { url, short } = await readMiniAppEnv();
  const botUser = (await envOrSetting("TELEGRAM_BOT_USERNAME")) || "";
  const btnText = await getContent("miniapp_button_text") ?? "Open VIP Mini App";
  const prompt = await getContent("miniapp_open_prompt") ?? "Open the VIP Mini App:";

  if (url) {
    if (!silent) {
      await sendMessage(chatId, prompt, {
        reply_markup: {
          inline_keyboard: [[{ text: btnText, web_app: { url } }]],
        },
      });
    }
    return url;
  }

  if (short && botUser) {
    const deepLink = `https://t.me/${botUser}/${short}`;
    if (!silent) {
      await sendMessage(chatId, prompt, {
        reply_markup: {
          inline_keyboard: [[{ text: btnText, url: deepLink }]],
        },
      });
    }
    return deepLink;
  }

  if (!silent) {
    const msg = await getContent("miniapp_configuring") ??
      "Mini app is being configured. Please try again soon.";
    await sendMessage(chatId, msg);
  }
  return null;
}

export async function sendMiniAppOrBotOptions(chatId: number): Promise<void> {
  const enabled = await getFlag("mini_app_enabled", true);
  const url = enabled ? await sendMiniAppLink(chatId, { silent: true }) : null;
  const continueText = await getContent("continue_in_bot_button") ?? "Continue in Bot";
  const miniText = await getContent("miniapp_button_text") ?? "Open VIP Mini App";
  const inline_keyboard: {
    text: string;
    callback_data?: string;
    web_app?: { url: string };
  }[][] = [
    [{ text: continueText, callback_data: "menu:plans" }],
  ];
  let text: string;
  if (url) {
    inline_keyboard[0].push({ text: miniText, web_app: { url } });
    text = await getContent("choose_continue_prompt") ?? "Choose how to continue:";
  } else {
    const key = enabled
      ? "miniapp_configure_continue"
      : "checkout_unavailable_continue";
    text = await getContent(key) ??
      (enabled
        ? "Mini app is being configured. Continue in bot:"
        : "Checkout is currently unavailable. Continue in bot:");
  }
  await notifyUser(chatId, text, {
    reply_markup: { inline_keyboard },
  });
}

export async function handleDashboardPackages(
  chatId: number,
  _userId: string,
): Promise<void> {
  const msg = await getFormattedVipPackages();
  await notifyUser(chatId, msg, { parse_mode: "Markdown" });
}

export async function handleDashboardRedeem(
  chatId: number,
  _userId: string,
): Promise<void> {
  await sendMiniAppOrBotOptions(chatId);
}

export async function handleDashboardHelp(
  chatId: number,
  _userId: string,
): Promise<void> {
  const msg = await getContent("help_message");
  await notifyUser(chatId, msg ?? "Help is coming soon.");
}

async function handleFaqCommand(chatId: number): Promise<void> {
  const msg = await getContent("faq_general");
  await notifyUser(chatId, msg ?? "FAQ is coming soon.", { parse_mode: "Markdown" });
}

async function handleEducationCommand(chatId: number): Promise<void> {
  const pkgs = await getEducationPackages();
  if (pkgs.length === 0) {
    const msg = await getContent("no_education_packages") ??
      "No education packages available.";
    await notifyUser(chatId, msg);
    return;
  }
  let text = "🎓 *Education Packages*\n\n";
  pkgs.forEach((pkg: Record<string, unknown>, idx: number) => {
    const name = (pkg.name as string) ?? `Package ${idx + 1}`;
    const price = pkg.price as number | undefined;
    const currency = (pkg.currency as string) ?? "USD";
    text += `${idx + 1}. ${name} - ${currency} ${price}\n`;
  });
  await notifyUser(chatId, text, { parse_mode: "Markdown" });
}

async function handlePromoCommand(chatId: number): Promise<void> {
  const promos = await getActivePromotions();
  if (promos.length === 0) {
    const msg = await getContent("no_active_promotions") ??
      "No active promotions at the moment.";
    await notifyUser(chatId, msg);
    return;
  }
  let text = "🎁 *Active Promotions*\n\n";
  promos.forEach((p: Record<string, unknown>, idx: number) => {
    const value =
      p.discount_type === "percentage"
        ? `${p.discount_value}%`
        : `$${p.discount_value}`;
    text += `${idx + 1}. ${p.code} - ${value}\n`;
  });
  text += "\nUse /promo CODE PLAN_ID to apply a code.";
  await notifyUser(chatId, text, { parse_mode: "Markdown" });
}

async function handleAskCommand(ctx: CommandContext): Promise<void> {
  const question = ctx.args.join(" ");
  if (!question) {
    const usage = await getContent("ask_usage") ??
      "Please provide a question. Example: /ask What is trading?";
    await notifyUser(ctx.chatId, usage);
    return;
  }
  if (!SUPABASE_URL) {
    const msg = await getContent("service_unavailable") ??
      "Service unavailable.";
    await notifyUser(ctx.chatId, msg);
    return;
  }
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-faq-assistant`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });
    const data = await res.json().catch(() => ({}));
    const answer =
      data.answer ?? (await getContent("ask_no_answer")) ??
        "Unable to get answer.";
    await notifyUser(ctx.chatId, answer);
  } catch {
    const msg = await getContent("ask_failed") ?? "Failed to get answer.";
    await notifyUser(ctx.chatId, msg);
  }
}

async function handleShouldIBuyCommand(ctx: CommandContext): Promise<void> {
  const instrument = ctx.args[0];
  if (!instrument) {
    const usage = await getContent("shouldibuy_usage") ??
      "Please provide an instrument. Example: /shouldibuy XAUUSD";
    await notifyUser(ctx.chatId, usage);
    return;
  }
  if (!SUPABASE_URL) {
    const msg = await getContent("service_unavailable") ??
      "Service unavailable.";
    await notifyUser(ctx.chatId, msg);
    return;
  }
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/trade-helper`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instrument, command: "shouldibuy" }),
    });
    const data = await res.json().catch(() => ({}));
    const analysis =
      data.analysis ?? (await getContent("shouldibuy_no_analysis")) ??
        "Unable to get analysis.";
    await notifyUser(ctx.chatId, analysis, { parse_mode: "Markdown" });
  } catch {
    const msg = await getContent("shouldibuy_failed") ??
      "Failed to get analysis.";
    await notifyUser(ctx.chatId, msg);
  }
}

export async function defaultCallbackHandler(
  chatId: number,
  _userId: string,
): Promise<void> {
  const unknown = await getContent("unknown_action") ??
    "Unknown action. Please choose a valid option.";
  await notifyUser(chatId, unknown);
}

export type CallbackHandler = (
  chatId: number,
  userId: string,
) => Promise<void>;

export function buildCallbackHandlers(
  handlers: AdminHandlers,
): Record<string, CallbackHandler> {
  return {
    dashboard_packages: handleDashboardPackages,
    dashboard_redeem: handleDashboardRedeem,
    dashboard_help: handleDashboardHelp,
    admin_dashboard: (chatId, userId) =>
      handlers.handleAdminDashboard(chatId, userId),
    table_management: (chatId, userId) =>
      handlers.handleTableManagement(chatId, userId),
    feature_flags: (chatId, userId) =>
      handlers.handleFeatureFlags(chatId, userId),
    publish_flags: (chatId) => handlers.handlePublishFlagsRequest(chatId),
    publish_flags_confirm: (chatId, userId) =>
      handlers.handlePublishFlagsConfirm(chatId, userId),
    rollback_flags: (chatId) => handlers.handleRollbackFlagsRequest(chatId),
    rollback_flags_confirm: (chatId, userId) =>
      handlers.handleRollbackFlagsConfirm(chatId, userId),
    env_status: async (chatId) => {
      const envStatus = await handlers.handleEnvStatus();
      await notifyUser(chatId, JSON.stringify(envStatus));
    },
    manage_table_bot_users: (chatId, userId) =>
      handlers.handleUserTableManagement(chatId, userId),
    manage_table_subscription_plans: (chatId, userId) =>
      handlers.handleSubscriptionPlansManagement(chatId, userId),
    manage_table_plan_channels: (chatId, userId) =>
      handlers.handlePlanChannelsManagement(chatId, userId),
    manage_table_education_packages: (chatId, userId) =>
      handlers.handleEducationPackagesManagement(chatId, userId),
    manage_table_promotions: (chatId, userId) =>
      handlers.handlePromotionsManagement(chatId, userId),
    manage_table_bot_content: (chatId, userId) =>
      handlers.handleContentManagement(chatId, userId),
    manage_table_bot_settings: (chatId, userId) =>
      handlers.handleBotSettingsManagement(chatId, userId),
    config_session_settings: (chatId, userId) =>
      handlers.handleConfigSessionSettings(chatId, userId),
    config_followup_settings: (chatId, userId) =>
      handlers.handleConfigFollowupSettings(chatId, userId),
    toggle_maintenance_mode: (chatId, userId) =>
      handlers.handleToggleMaintenanceMode(chatId, userId),
    config_auto_features: (chatId, userId) =>
      handlers.handleConfigAutoFeatures(chatId, userId),
    config_notifications: (chatId, userId) =>
      handlers.handleConfigNotifications(chatId, userId),
    config_performance: (chatId, userId) =>
      handlers.handleConfigPerformance(chatId, userId),
    add_new_setting: (chatId, userId) =>
      handlers.handleAddNewSetting(chatId, userId),
    backup_bot_settings: (chatId, userId) =>
      handlers.handleBackupBotSettings(chatId, userId),
    manage_table_daily_analytics: (chatId, userId) =>
      handlers.handleDailyAnalyticsManagement(chatId, userId),
    manage_table_user_sessions: (chatId, userId) =>
      handlers.handleUserSessionsManagement(chatId, userId),
    manage_table_payments: (chatId, userId) =>
      handlers.handlePaymentsManagement(chatId, userId),
    manage_table_broadcast_messages: (chatId, userId) =>
      handlers.handleBroadcastMessagesManagement(chatId, userId),
    manage_table_bank_accounts: (chatId, userId) =>
      handlers.handleBankAccountsManagement(chatId, userId),
    manage_table_auto_reply_templates: (chatId, userId) =>
      handlers.handleAutoReplyTemplatesManagement(chatId, userId),
    edit_content_welcome_message: (chatId, userId) =>
      handlers.handleEditContent(chatId, userId, "welcome_message"),
    edit_content_about_us: (chatId, userId) =>
      handlers.handleEditContent(chatId, userId, "about_us"),
    edit_content_support_message: (chatId, userId) =>
      handlers.handleEditContent(chatId, userId, "support_message"),
    edit_content_terms_conditions: (chatId, userId) =>
      handlers.handleEditContent(chatId, userId, "terms_conditions"),
    edit_content_faq_general: (chatId, userId) =>
      handlers.handleEditContent(chatId, userId, "faq_general"),
    edit_content_maintenance_message: (chatId, userId) =>
      handlers.handleEditContent(chatId, userId, "maintenance_message"),
    edit_content_vip_benefits: (chatId, userId) =>
      handlers.handleEditContent(chatId, userId, "vip_benefits"),
    edit_content_payment_instructions: (chatId, userId) =>
      handlers.handleEditContent(chatId, userId, "payment_instructions"),
    add_new_content: (chatId, userId) =>
      handlers.handleAddNewContent(chatId, userId),
    preview_all_content: (chatId, userId) =>
      handlers.handlePreviewAllContent(chatId, userId),
    export_all_tables: (chatId, userId) =>
      handlers.handleExportAllTables(chatId, userId),
    table_stats_overview: (chatId, userId) =>
      handlers.handleTableStatsOverview(chatId, userId),
  };
}

async function menuView(
  section: MenuSection,
): Promise<{ text: string; extra: Record<string, unknown> }> {
  if (section === "plans") {
    const [msg, pkgs] = await Promise.all([
      getFormattedVipPackages(),
      getVipPackages(),
    ]);
    const inline_keyboard = pkgs.map((pkg) => [{
      text: pkg.name,
      callback_data: "buy:" + pkg.id,
    }]);
    inline_keyboard.push([{ text: "Back", callback_data: "nav:dashboard" }]);
    return {
      text: msg,
      extra: { reply_markup: { inline_keyboard }, parse_mode: "Markdown" },
    };
  }
  if (section === "support") {
    const msg = await getContent("support_message");
    return {
      text: msg ?? "Support information is unavailable.",
      extra: { reply_markup: buildMainMenu(section) },
    };
  }
  const markup = buildMainMenu(section) as {
    inline_keyboard: {
      text: string;
      callback_data?: string;
      web_app?: { url: string };
    }[][];
  };
  const { url } = await readMiniAppEnv();
  const miniText = await getContent("miniapp_button_text") ?? "Open VIP Mini App";
  if (url) {
    markup.inline_keyboard.push([{ text: miniText, web_app: { url } }]);
  }
  const msg = await getContent("welcome_message");
  return {
    text: msg ?? "Welcome! Choose an option:",
    extra: { reply_markup: markup, parse_mode: "Markdown" },
  };
}

async function getMenuMessageId(chatId: number): Promise<number | null> {
  const supa = getSupabase();
  if (!supa) return null;
  const { data } = await supa
    .from("bot_users")
    .select("menu_message_id")
    .eq("telegram_id", chatId)
    .maybeSingle();
  return data?.menu_message_id ?? null;
}

async function setMenuMessageId(
  chatId: number,
  messageId: number | null,
): Promise<void> {
  const supa = getSupabase();
  if (!supa) return;
  try {
    await supa
      .from("bot_users")
      .update({ menu_message_id: messageId })
      .eq("telegram_id", chatId);
  } catch {
    /* ignore */
  }
}

async function sendMainMenu(
  chatId: number,
  section: MenuSection = "dashboard",
): Promise<number | null> {
  const view = await menuView(section);
  const msgId = await sendMessage(chatId, view.text, view.extra);
  if (msgId !== null) {
    await setMenuMessageId(chatId, msgId);
  }
  return msgId;
}

async function showMainMenu(
  chatId: number,
  section: MenuSection = "dashboard",
): Promise<void> {
  const existing = await getMenuMessageId(chatId);
  const view = await menuView(section);
  if (existing) {
    const newId = await editMessage(chatId, existing, view.text, view.extra);
    if (newId !== null) {
      await setMenuMessageId(chatId, newId);
    } else {
      await setMenuMessageId(chatId, null);
      await sendMainMenu(chatId, section);
    }
  } else {
    await sendMainMenu(chatId, section);
  }
}

async function extractTelegramUpdate(
  req: Request,
): Promise<TelegramUpdate | null> {
  try {
    return await req.json() as TelegramUpdate;
  } catch {
    return null;
  }
}

function isDirectMessage(msg: TelegramMessage | undefined): boolean {
  if (!msg) return false;
  const chatType = msg.chat.type;
  if (chatType === "private") return true;
  const bot = botUsername.toLowerCase();
  if (bot) {
    const text = `${msg.text ?? ""} ${msg.caption ?? ""}`.toLowerCase();
    if (text.includes(`@${bot}`)) return true;
    const replyUser = msg.reply_to_message?.from?.username?.toLowerCase();
    if (replyUser === bot) return true;
  }
  return false;
}

function getFileIdFromUpdate(update: TelegramUpdate | null): string | null {
  const msg = update?.message;
  if (!msg) return null;
  if (Array.isArray(msg.photo) && msg.photo.length > 0) {
    return msg.photo[msg.photo.length - 1].file_id;
  }
  const doc = msg.document;
  if (
    doc &&
    (!doc.mime_type || doc.mime_type.startsWith("image/"))
  ) {
    return doc.file_id;
  }
  return null;
}

function isStartMessage(m: TelegramMessage | undefined) {
  const t = m?.text ?? "";
  if (t.startsWith("/start")) return true;
  const ents = m?.entities as
    | { offset: number; length: number; type: string }[]
    | undefined;
  return Array.isArray(ents) && ents.some((e) =>
    e.type === "bot_command" &&
    t.slice(e.offset, e.offset + e.length).startsWith("/start")
  );
}

function supaSvc() {
  const client = getSupabase();
  if (!client) {
    throw new Error("Supabase client unavailable");
  }
  return client;
}

/** Persist one interaction for analytics. */
async function logInteraction(
  kind: string,
  telegramUserId: string,
  extra: unknown = null,
): Promise<void> {
  try {
    const supa = supaSvc();
    await supa.from("user_interactions").insert({
      telegram_user_id: telegramUserId,
      interaction_type: kind,
      interaction_data: extra,
      page_context: "telegram-bot",
    });
  } catch {
    /* swallow */
  }
}

/** Simple per-user RPM limit using Supabase RPC (resets every minute). */
async function enforceRateLimit(tgId: string): Promise<null | Response> {
  try {
    const limit = Number((await envOrSetting("RATE_LIMIT_PER_MINUTE")) ?? "20");
    const { error } = await supaSvc().rpc("rl_touch", {
      _tg: tgId,
      _limit: limit,
    });
    if (
      error &&
      (error.message === "rate_limited" ||
        (error as { details?: string }).details === "rate_limited")
    ) {
      const msg = await getContent("rate_limit_exceeded") ?? "Too Many Requests";
      return json({ ok: false, error: msg }, 429);
    }
  } catch {
    // Ignore rate limit failures when Supabase is unavailable
    return null;
  }
  return null;
}

async function hashBytesToSha256(blob: Blob): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
  return Array.from(new Uint8Array(hashBuffer)).map((b) =>
    b.toString(16).padStart(2, "0")
  ).join("");
}

async function storeReceiptImage(
  blob: Blob,
  storagePath: string,
): Promise<string> {
  const supabase = getSupabase();
  await supabase?.storage.from("receipts").upload(storagePath, blob, {
    contentType: blob.type || undefined,
  });
  return storagePath;
}

export const commandHandlers: Record<string, CommandHandler> = {
  "/start": async ({ chatId }) => {
    await showMainMenu(chatId, "dashboard");
  },
  "/app": async ({ chatId }) => {
    await showMainMenu(chatId, "dashboard");
  },
  "/plans": async ({ chatId }) => {
    await showMainMenu(chatId, "plans");
  },
  "/packages": async ({ chatId }) => {
    await showMainMenu(chatId, "plans");
  },
  "/account": async ({ chatId }) => {
    await showMainMenu(chatId, "dashboard");
  },
  "/support": async ({ chatId }) => {
    await showMainMenu(chatId, "support");
  },
  "/help": async ({ chatId }) => {
    await handleDashboardHelp(chatId, String(chatId));
  },
  "/faq": async ({ chatId }) => {
    await handleFaqCommand(chatId);
  },
  "/education": async ({ chatId }) => {
    await handleEducationCommand(chatId);
  },
  "/promo": async ({ chatId }) => {
    await handlePromoCommand(chatId);
  },
  "/ask": async (ctx) => {
    await handleAskCommand(ctx);
  },
  "/shouldibuy": async (ctx) => {
    await handleShouldIBuyCommand(ctx);
  },
};

// Admin command handlers are built separately to keep user logic light
const adminCommandHandlers = buildAdminCommandHandlers(
  loadAdminHandlers,
  (chatId, text) => notifyUser(chatId, text),
);

async function handleCommand(update: TelegramUpdate): Promise<void> {
  const msg = update.message;
  if (!msg) return;
  const text = msg.text?.trim();
  if (!text) return;
  const chatId = msg.chat.id;
  const miniAppValid = await hasMiniApp();

  // Handle pending admin plan edits before command parsing
  const userId = String(msg.from?.id ?? chatId);
  const handlers = await loadAdminHandlers();
  if (await handlers.handlePlanEditInput(chatId, userId, text)) return;

  // Extract the command without bot mentions and gather arguments
  const [firstToken, ...args] = text.split(/\s+/);
  let command = firstToken.split("@")[0];
  if (isStartMessage(msg)) command = "/start";

  try {
    const ctx: CommandContext = { msg, chatId, args, miniAppValid };
    const handler = commandHandlers[command] ?? adminCommandHandlers[command];
    if (handler) {
      await handler(ctx);
    }
  } catch (err) {
    console.error("handleCommand error", err);
  }
}

async function handleCallback(update: TelegramUpdate): Promise<void> {
  const cb = update.callback_query;
  if (!cb) return;
  const chatId = cb.message?.chat.id ?? cb.from.id;
  const data = cb.data || "";
  const userId = String(cb.from.id);
  setCallbackMessageId(cb.message?.message_id ?? null);
  try {
    if (data.startsWith("pay:")) {
      await answerCallbackQuery(cb.id);
      await sendMiniAppOrBotOptions(chatId);
      return;
    }
    // Acknowledge other callbacks promptly to avoid client retries
    await answerCallbackQuery(cb.id);
    if (data.startsWith("nav:") && cb.message) {
      const section = data.slice("nav:".length) as MenuSection;
      const view = await menuView(section);
      await editMessage(chatId, cb.message!.message_id!, view.text, view.extra);
      return;
    }
    if (data.startsWith("buy:")) {
      const planId = data.slice("buy:".length);
      const pkgs = await getVipPackages();
      const plan = pkgs.find((p) => p.id === planId);
      if (plan && cb.message) {
        const inline_keyboard = [
          [{
            text: "Pay by Bank Transfer (Upload Receipt)",
            callback_data: `method:bank:${plan.id}`,
          }],
          [{ text: "Pay with Crypto", callback_data: `method:crypto:${plan.id}` }],
          [{ text: "Back", callback_data: "nav:plans" }],
        ];
        await editMessage(
          chatId,
          cb.message!.message_id!,
          `Choose payment method for ${plan.name}:`,
          { reply_markup: { inline_keyboard } },
        );
      } else if (cb.message) {
        await editMessage(chatId, cb.message!.message_id!, "Plan not found.");
      }
      return;
    }
    if (data.startsWith("method:bank:")) {
      const planId = data.split(":")[2];
      const supa = getSupabase();
      if (!supa) {
        const msg = await getContent("bank_transfer_unavailable") ??
          "Bank transfer unavailable.";
        await notifyUser(chatId, msg);
        return;
      }

      // ensure bot user exists
      const { data: user } = await supa
        .from("bot_users")
        .select("id")
        .eq("telegram_id", chatId)
        .maybeSingle();
      let userId = user?.id as string | undefined;
      if (!userId) {
        const { data: ins } = await supa
          .from("bot_users")
          .insert({ telegram_id: String(chatId) })
          .select("id")
          .single();
        userId = ins?.id as string | undefined;
      }
      if (!userId) {
        const msg = await getContent("bank_transfer_unable") ??
          "Unable to start bank transfer.";
        await notifyUser(chatId, msg);
        return;
      }

      await supa
        .from("payments")
        .insert({
          user_id: userId,
          plan_id: planId,
          amount: null,
          currency: "USD",
          payment_method: "bank_transfer",
          status: "pending",
        });

      const payCode = `DC-${crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()}`;
      await supa.from("payment_intents").insert({
        user_id: userId,
        method: "bank",
        expected_amount: 0,
        currency: "USD",
        pay_code: payCode,
        status: "pending",
        notes: planId,
      }).catch(() => null);

      const { data: banks } = await supa
        .from("bank_accounts")
        .select(
          "bank_name,account_name,account_number,currency",
        )
        .eq("is_active", true)
        .order("display_order");

      const list = (banks as {
        bank_name: string;
        account_name: string;
        account_number: string;
        currency: string;
      }[] || [])
        .map((b) =>
          `${b.bank_name}\nAccount Name: ${b.account_name}\nAccount Number: ${b.account_number}\nCurrency: ${b.currency}`
        )
        .join("\n\n");

      const instructions = await getContent("payment_instructions");
      const message =
        `${instructions ? `${instructions}\n\n` : ""}${list}\n\nPay Code: ${payCode}\nAdd this in transfer remarks.\nPlease send a photo of your bank transfer receipt.`;

      const { data: us } = await supa
        .from("user_sessions")
        .select("id")
        .eq("telegram_user_id", String(chatId))
        .limit(1)
        .maybeSingle();
      if (us?.id) {
        await supa
          .from("user_sessions")
          .update({
            awaiting_input: `receipt:${planId}`,
            last_activity: new Date().toISOString(),
            is_active: true,
          })
          .eq("id", us.id);
      } else {
        await supa.from("user_sessions").insert({
          telegram_user_id: String(chatId),
          awaiting_input: `receipt:${planId}`,
          last_activity: new Date().toISOString(),
          is_active: true,
        });
      }

      if (cb.message) {
        await editMessage(chatId, cb.message!.message_id!, message, {
          reply_markup: { inline_keyboard: [[{ text: "Back", callback_data: "nav:plans" }]] },
        });
      }
      return;
    }
    if (data.startsWith("method:crypto:")) {
      const planId = data.split(":")[2];
      const supa = getSupabase();
      if (!supa) {
        const msg = await getContent("crypto_payments_unavailable") ??
          "Crypto payments unavailable.";
        await notifyUser(chatId, msg);
        return;
      }
      const { data: user } = await supa
        .from("bot_users")
        .select("id")
        .eq("telegram_id", chatId)
        .maybeSingle();
      let userId = user?.id as string | undefined;
      if (!userId) {
        const { data: ins } = await supa
          .from("bot_users")
          .insert({ telegram_id: String(chatId) })
          .select("id")
          .single();
        userId = ins?.id as string | undefined;
      }
      if (!userId) {
        const msg = await getContent("crypto_start_failed") ??
          "Unable to start crypto payment.";
        await notifyUser(chatId, msg);
        return;
      }
      const { error: perr } = await supa
        .from("payments")
        .insert({
          user_id: userId,
          plan_id: planId,
          amount: null,
          currency: "USD",
          payment_method: "crypto",
          status: "pending",
        });
      const address = await getContent("crypto_usdt_trc20") ||
        optionalEnv("CRYPTO_DEPOSIT_ADDRESS") ||
        "Please contact support for the crypto address.";
      if (perr) {
        console.error("create crypto payment error", perr);
        const msg = await getContent("payment_create_failed") ??
          "Unable to create payment. Please try again later.";
        await notifyUser(chatId, msg);
      } else {
        if (cb.message) {
          const instructions = await getContent("payment_instructions");
          const msg = instructions
            ? `${instructions}\n\nSend the payment to ${address} and reply with the transaction details for manual approval.`
            : `Send the payment to ${address} and reply with the transaction details for manual approval.`;
          await editMessage(
            chatId,
            cb.message!.message_id!,
            msg,
            { reply_markup: { inline_keyboard: [[{ text: "Back", callback_data: "nav:plans" }]] } },
          );
        }
      }
      return;
    }
    const handlers = await loadAdminHandlers();
    if (data.startsWith("toggle_flag_")) {
      const flag = data.replace("toggle_flag_", "");
      await handlers.handleToggleFeatureFlag(chatId, userId, flag);
    } else {
      const callbackHandlers = buildCallbackHandlers(handlers);
      const handler = callbackHandlers[data] ?? defaultCallbackHandler;
      await handler(chatId, userId);
    }
  } catch (err) {
    console.error("handleCallback error", err);
  } finally {
    setCallbackMessageId(null);
  }
}

export async function startReceiptPipeline(
  update: TelegramUpdate,
): Promise<void> {
  try {
    const chatId = update.message!.chat.id;
    if (!(await getFlag("vip_sync_enabled", true))) {
      const msg = await getContent("vip_sync_disabled") ??
        "VIP sync is currently disabled.";
      await notifyUser(chatId, msg);
      return;
    }
    const fileId = getFileIdFromUpdate(update);
    if (!fileId) {
      const msg = await getContent("no_receipt_image") ??
        "No receipt image found.";
      await notifyUser(chatId, msg);
      return;
    }
    const supa = getSupabase();
    if (!supa) {
      const msg = await getContent("receipt_processing_unavailable") ??
        "Receipt processing unavailable.";
      await notifyUser(chatId, msg);
      return;
    }
    const { data: session } = await supa
      .from("user_sessions")
      .select("id,awaiting_input")
      .eq("telegram_user_id", String(chatId))
      .maybeSingle();
    const awaiting = session?.awaiting_input || "";
    if (!awaiting.startsWith("receipt:")) {
      const msg = await getContent("no_pending_purchase") ??
        "No pending purchase. Use /buy to select a plan.";
      await notifyUser(chatId, msg);
      return;
    }
    const planId = awaiting.split(":")[1];
    const { data: user } = await supa
      .from("bot_users")
      .select("id")
      .eq("telegram_id", chatId)
      .maybeSingle();
    if (!user?.id) {
      const msg = await getContent("start_before_receipts") ??
        "Please use /start before sending receipts.";
      await notifyUser(chatId, msg);
      return;
    }
    if (!BOT_TOKEN) {
      const msg = await getContent("receipt_processing_unavailable") ??
        "Receipt processing unavailable.";
      await notifyUser(chatId, msg);
      return;
    }
    const fileInfo = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`,
    ).then((r) => r.json()).catch(() => null);
    const path = fileInfo?.result?.file_path;
    if (!path) {
      const msg = await getContent("cannot_fetch_receipt") ??
        "Cannot fetch receipt.";
      await notifyUser(chatId, msg);
      return;
    }
    const blob = await fetch(
      `https://api.telegram.org/file/bot${BOT_TOKEN}/${path}`,
    ).then((r) => r.blob());
    const hash = await hashBytesToSha256(blob);
    const storagePath = `receipts/${chatId}/${hash}`;
    await storeReceiptImage(blob, storagePath);
    const { data: pay } = await supa.from("payments")
      .insert({
        user_id: user.id,
        plan_id: planId,
        amount: null,
        currency: "USD",
        payment_method: "bank_transfer",
        status: "pending",
      })
      .select("id")
      .single();
    if (!pay?.id || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      const msg = await getContent("receipt_submit_failed") ??
        "Failed to submit receipt. Please try again later.";
      await notifyUser(chatId, msg);
      return;
    }
    const rs = await fetch(`${SUPABASE_URL}/functions/v1/receipt-submit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        telegram_id: String(chatId),
        payment_id: pay.id,
        storage_path: storagePath,
      }),
    }).then((r) => r.json()).catch(() => null);
    if (!rs?.ok) {
      const msg = await getContent("receipt_submit_failed") ??
        "Failed to submit receipt. Please try again later.";
      await notifyUser(chatId, msg);
      return;
    }
    await supa.from("user_sessions").update({ awaiting_input: null }).eq(
      "id",
      session?.id,
    );
    const msg = await getContent("receipt_received") ??
      "✅ Receipt received. We'll review it shortly.";
    await notifyUser(chatId, msg);
  } catch (err) {
    console.error("startReceiptPipeline error", err);
  }
}

export async function serveWebhook(req: Request): Promise<Response> {
  // CORS preflight support for browser calls
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method === "HEAD") {
    const url = new URL(req.url);
    if (url.pathname.endsWith("/version")) {
      return new Response(null, { status: 200 });
    }
    return mna();
  }
  if (req.method === "GET") {
    const url = new URL(req.url);
    if (url.pathname.endsWith("/version")) {
      return ok({ name: "telegram-bot", ts: new Date().toISOString() });
    }
    if (url.pathname.endsWith("/echo")) {
      return ok({ echo: true, ua: req.headers.get("user-agent") || "" });
    }
    return mna();
  }
  if (req.method !== "POST") return mna();

  // Only validate webhook secret for POST requests
  const authResp = await validateTelegramHeader(req);
  if (authResp) {
    console.log(
      "Telegram webhook auth failed - expected secret not found or mismatch",
    );
    console.log(
      "Make sure TELEGRAM_WEBHOOK_SECRET is set correctly in Supabase secrets",
    );
    return authResp;
  }

  try {
    const { ok: envOk, missing } = requireEnvCheck(REQUIRED_ENV_KEYS);
    if (!envOk) {
      console.error("Missing env vars", missing);
      return oops("Missing env vars", missing);
    }

    const body = await extractTelegramUpdate(req);
    if (
      body && typeof body === "object" &&
      (body as { test?: string }).test === "ping" &&
      Object.keys(body).length === 1
    ) {
      return ok({ pong: true });
    }
    if (!body) {
      console.log("telegram-bot: empty/invalid JSON");
      return json({ ok: false, error: "Invalid JSON" }, 400);
    }
    const update = body as TelegramUpdate;

    if (update.callback_query) {
      await handleCallback(update);
      return ok({ handled: true, kind: "callback_query" });
    }

    // ---- BAN CHECK (short-circuit early) ----
    const supa = supaSvc();
    const fromId = String(update?.message?.from?.id ?? "");
    if (fromId) {
      try {
        const { data: ban } = await supa.from("abuse_bans")
          .select("expires_at")
          .eq("telegram_id", fromId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (ban && (!ban.expires_at || new Date(ban.expires_at) > new Date())) {
          // optional: send a one-time notice
          return json({ ok: false, error: "Forbidden" }, 403);
        }
      } catch {
        /* swallow */
      }
    }

    const tgId = fromId;
    if (tgId) {
      const rl = await enforceRateLimit(tgId);
      if (rl) return rl; // 429
      const isCmd = !!update?.message?.text?.startsWith("/");
      await logInteraction(
        isCmd ? "command" : "message",
        tgId,
        update?.message?.text ?? null,
      );
    }

    if (!update.callback_query) {
      await handleCommand(update);
    }

    const fileId = isDirectMessage(update.message)
      ? getFileIdFromUpdate(update)
      : null;
    if (fileId) {
      await startReceiptPipeline(update);
    }

    return ok({ handled: true });
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    console.log("telegram-bot fatal:", errMsg);
    await alertAdmins(`🚨 <b>Bot error</b>\n<code>${String(e)}</code>`);
    try {
      const supa = supaSvc();
      await supa.from("admin_logs").insert({
        admin_telegram_id: "system",
        action_type: "bot_error",
        action_description: String(e),
      });
    } catch {
      /* swallow */
    }
    return oops("Internal Error");
  }
}

export default serveWebhook;
if (import.meta.main) {
  Deno.serve(serveWebhook);
}
