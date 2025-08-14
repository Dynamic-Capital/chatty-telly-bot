import { optionalEnv } from "../_shared/env.ts";
import { requireEnv as requireEnvCheck } from "./helpers/require-env.ts";
import { alertAdmins } from "../_shared/alerts.ts";
import { json, mna, ok, oops } from "../_shared/http.ts";
import { validateTelegramHeader } from "../_shared/telegram_secret.ts";
import { getBotContent, getFormattedVipPackages, insertReceiptRecord } from "./database-utils.ts";
import { createClient } from "../_shared/client.ts";
type SupabaseClient = ReturnType<typeof createClient>;
import { getFlag } from "../../../src/utils/config.ts";

interface TelegramMessage {
  chat: { id: number; type?: string };
  from?: { id?: number; username?: string };
  text?: string;
  caption?: string;
  photo?: { file_id: string }[];
  document?: { file_id: string; mime_type?: string };
  reply_to_message?: TelegramMessage;
  [key: string]: unknown;
}

interface TelegramCallback {
  id: string;
  from: { id: number };
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
const BOT_TOKEN = optionalEnv("TELEGRAM_BOT_TOKEN");
const botUsername = optionalEnv("TELEGRAM_BOT_USERNAME") || "";

// Optional feature flags (currently unused)
const _OPENAI_ENABLED = optionalEnv("OPENAI_ENABLED") === "true";
const _FAQ_ENABLED = optionalEnv("FAQ_ENABLED") === "true";
const WINDOW_SECONDS = Number(optionalEnv("WINDOW_SECONDS") ?? "180");
const AMOUNT_TOLERANCE = Number(optionalEnv("AMOUNT_TOLERANCE") ?? "0.02");
const REQUIRE_PAY_CODE = optionalEnv("REQUIRE_PAY_CODE") === "true";
let supabaseAdmin: SupabaseClient | null = null;
async function getSupabase(): Promise<SupabaseClient | null> {
  if (supabaseAdmin) return supabaseAdmin;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  try {
    supabaseAdmin = createClient();
  } catch (_e) {
    supabaseAdmin = null;
  }
  return supabaseAdmin;
}

type AdminHandlers = typeof import("./admin-handlers.ts");

let adminHandlers: AdminHandlers | null = null;
async function loadAdminHandlers(): Promise<AdminHandlers> {
  if (!adminHandlers) {
    adminHandlers = await import("./admin-handlers.ts");
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
        body: JSON.stringify({ chat_id: chatId, text, ...extra }),
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
): Promise<boolean> {
  if (!BOT_TOKEN) {
    console.warn(
      "TELEGRAM_BOT_TOKEN is not set; cannot edit message",
    );
    return false;
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
      return Boolean(out?.ok);
    } catch {
      return false;
    }
  } catch (e) {
    console.error("editMessage error", e);
    return false;
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

function hasValidMiniAppUrl(): boolean {
  const raw = optionalEnv("MINI_APP_URL") || "";
  if (!raw) return false;
  try {
    const u = new URL(raw);
    return u.protocol === "https:";
  } catch {
    return false;
  }
}

export async function sendMiniAppLink(chatId: number) {
  if (!(await getFlag("mini_app_enabled"))) return;
  if (!BOT_TOKEN) return;

  const rawUrl = optionalEnv("MINI_APP_URL") || "";
  const short = optionalEnv("MINI_APP_SHORT_NAME") || "";

  // Normalize MINI_APP_URL if present
  let miniUrl: string | null = null;
  if (rawUrl) {
    try {
      const u = new URL(rawUrl);
      if (u.protocol !== "https:") {
        throw new Error("Mini app URL must be HTTPS");
      }
      if (!u.pathname.endsWith("/")) u.pathname = u.pathname + "/";
      miniUrl = u.toString();
    } catch (e) {
      console.error("MINI_APP_URL invalid:", (e as Error).message);
      miniUrl = null;
    }
  }

  if (miniUrl) {
    await sendMessage(chatId, "Open the VIP Mini App:", {
      reply_markup: {
        inline_keyboard: [[{
          text: "Open VIP Mini App",
          web_app: { url: miniUrl },
        }]],
      },
    });
    return;
  }

  if (short && botUsername) {
    const deepLink = `https://t.me/${botUsername}/${short}`;
    await sendMessage(
      chatId,
      `Open the VIP Mini App: ${deepLink}\n\n(Setup MINI_APP_URL for the in-button WebApp experience.)`,
    );
    return;
  }

  await sendMessage(
    chatId,
    "Welcome! Mini app is being configured. Please try again soon.",
  );
}

async function menuView(
  section: "home" | "plans" | "status" | "support",
  chatId?: number,
): Promise<{ text: string; extra: Record<string, unknown> }>
{
  const base = {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Home", callback_data: "menu:home" }],
        [{ text: "Packages", callback_data: "menu:plans" }],
        [{ text: "Status", callback_data: "menu:status" }],
        [{ text: "Support", callback_data: "menu:support" }],
      ],
    },
  };

  switch (section) {
    case "plans": {
      const msg = await getFormattedVipPackages();
      return { text: msg, extra: { ...base, parse_mode: "Markdown" } };
    }
    case "status": {
      if (chatId) {
        const supa = await getSupabase();
        if (supa) {
          const { data } = await supa
            .from("bot_users")
            .select("is_vip,subscription_expires_at")
            .eq("telegram_id", chatId)
            .maybeSingle();
          const vip = data?.is_vip ? "VIP: active" : "VIP: inactive";
          const expiry = data?.subscription_expires_at
            ? `Expiry: ${
              new Date(data.subscription_expires_at).toLocaleDateString()
            }`
            : "Expiry: none";
          return { text: `${vip}\n${expiry}`, extra: base };
        }
      }
      return { text: "Status information is unavailable.", extra: base };
    }
    case "support": {
      const msg = await getBotContent("support_message");
      return { text: msg ?? "Support information is unavailable.", extra: base };
    }
    case "home":
    default:
      return { text: "Welcome! Choose an option:", extra: base };
  }
}

async function getMenuMessageId(chatId: number): Promise<number | null> {
  const supa = await getSupabase();
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
  const supa = await getSupabase();
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
  section: "home" | "plans" | "status" | "support" = "home",
): Promise<number | null> {
  const view = await menuView(section, chatId);
  const msgId = await sendMessage(chatId, view.text, view.extra);
  if (msgId !== null) {
    await setMenuMessageId(chatId, msgId);
  }
  return msgId;
}

async function showMainMenu(
  chatId: number,
  section: "home" | "plans" | "status" | "support" = "home",
): Promise<void> {
  const existing = await getMenuMessageId(chatId);
  const view = await menuView(section, chatId);
  if (existing) {
    const ok = await editMessage(chatId, existing, view.text, view.extra);
    if (!ok) {
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

function logEvent(event: string, data: Record<string, unknown>): void {
  const sb_request_id = optionalEnv("SB_REQUEST_ID");
  console.log(JSON.stringify({ event, sb_request_id, ...data }));
}

async function supaSvc() {
  const client = await getSupabase();
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
    const supa = await supaSvc();
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

async function handleStartPayload(msg: TelegramMessage): Promise<void> {
  const t = msg.text?.split(/\s+/)[1];
  if (!t) return;
  const supa = await supaSvc().catch(() => null);
  if (!supa) return;
  const telegramId = String(msg.from?.id || msg.chat.id);
  const now = new Date().toISOString();
  let promo_data: Record<string, unknown> | null = null;
  const row: Record<string, unknown> = {
    telegram_user_id: telegramId,
    funnel_step: 1,
    conversion_type: "start",
  };
  if (t.startsWith("ref_")) {
    const ref = t.slice(4);
    row.conversion_type = "referral";
    row.conversion_data = { ref };
    promo_data = { ref };
  } else if (t.startsWith("promo_")) {
    const code = t.slice(6);
    row.conversion_type = "promo";
    row.promo_code = code;
    promo_data = { code };
  } else return;
  try {
    await supa.from("conversion_tracking").insert(row);
    const { data: us } = await supa
      .from("user_sessions")
      .select("id")
      .eq("telegram_user_id", telegramId)
      .limit(1)
      .maybeSingle();
    if (us?.id) {
      await supa.from("user_sessions").update({ promo_data }).eq("id", us.id);
    } else {await supa.from("user_sessions").insert({
        telegram_user_id: telegramId,
        promo_data,
        last_activity: now,
        is_active: true,
      });}
  } catch {
    /* swallow */
  }
}

/** Simple per-user RPM limit using user_sessions (resets every minute). */
async function enforceRateLimit(
  telegramUserId: string,
): Promise<null | Response> {
  try {
    const supa = await supaSvc();
    const LIMIT = Number(Deno.env.get("RATE_LIMIT_PER_MINUTE") ?? "20");

    const now = new Date();
    const { data: row } = await supa
      .from("user_sessions")
      .select("id,follow_up_count,last_activity")
      .eq("telegram_user_id", telegramUserId)
      .limit(1)
      .maybeSingle();

    let count = 1;
    if (
      row?.last_activity &&
      (now.getTime() - new Date(row.last_activity).getTime()) < 60_000
    ) {
      count = (row.follow_up_count ?? 0) + 1;
    }

    const up = {
      telegram_user_id: telegramUserId,
      last_activity: now.toISOString(),
      follow_up_count: count,
      is_active: true,
    };

    if (row?.id) await supa.from("user_sessions").update(up).eq("id", row.id);
    else await supa.from("user_sessions").insert(up);

    if (count > LIMIT) {
      await logInteraction("rate_limited", telegramUserId, {
        count,
        limit: LIMIT,
      });
      return json({ ok: false, error: "Too Many Requests" }, 429);
    }
  } catch {
    // Ignore rate limit failures when Supabase is unavailable
    return null;
  }
  return null;
}

async function downloadTelegramFile(
  fileId: string,
): Promise<{ blob: Blob; filePath: string } | null> {
  const infoRes = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`,
  );
  const info = await infoRes.json();
  const filePath = info.result?.file_path;
  if (!filePath) return null;
  const fileRes = await fetch(
    `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`,
  );
  const blob = await fileRes.blob();
  return { blob, filePath };
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
  const supabase = await getSupabase();
  await supabase?.storage.from("receipts").upload(storagePath, blob, {
    contentType: blob.type || undefined,
  });
  return storagePath;
}

async function handleCommand(update: TelegramUpdate): Promise<void> {
  const msg = update.message;
  if (!msg) return;
  const text = msg.text?.trim();
  if (!text) return;
  const chatId = msg.chat.id;
  const miniAppValid = hasValidMiniAppUrl();

  // Early match for /start variants like "/start", "/start@Bot", or "/start foo"
  if (isStartMessage(msg)) {
    const supa = await getSupabase();
    let contentKey = "welcome_message";
    let isNewUser = true;
    if (supa) {
      const { data } = await supa
        .from("bot_users")
        .select("id")
        .eq("telegram_id", msg.from?.id ?? chatId)
        .maybeSingle();
      if (data) {
        contentKey = "welcome_back_message";
        isNewUser = false;
      }
    }
    const welcome = await getBotContent(contentKey);
    if (welcome) {
      if (isNewUser) {
        await notifyUser(chatId, welcome, {
          reply_markup: {
            keyboard: [
              [{ text: "/packages" }, { text: "/vip" }],
              [{ text: "/help" }, { text: "/support" }],
            ],
            resize_keyboard: true,
          },
        });
      } else {
        await notifyUser(chatId, welcome);
      }
    }
    await handleStartPayload(msg);
    if (miniAppValid) {
      await showMainMenu(chatId);
    } else {
      await sendMiniAppLink(chatId);
    }
    return;
  }

  // Handle pending admin plan edits before command parsing
  const userId = String(msg.from?.id ?? chatId);
  const handlers = await loadAdminHandlers();
  if (await handlers.handlePlanEditInput(chatId, userId, text)) return;

  // Extract the command without bot mentions and gather arguments
  const [firstToken, ...args] = text.split(/\s+/);
  const command = firstToken.split("@")[0];

  try {
    switch (command) {
      case "/start":
      case "/app":
        if (miniAppValid) {
          await showMainMenu(chatId);
        } else {
          await sendMiniAppLink(chatId);
        }
        break;
      case "/menu":
        await showMainMenu(chatId);
        break;
      case "/help": {
        const msg = await getBotContent("help_message");
        await notifyUser(chatId, msg ?? "Help is coming soon.");
        break;
      }
      case "/support": {
        const msg = await getBotContent("support_message");
        await notifyUser(chatId, msg ?? "Support information is unavailable.");
        break;
      }
      case "/about": {
        const msg = await getBotContent("about_us");
        await notifyUser(chatId, msg ?? "About information is unavailable.");
        break;
      }
      case "/vip": {
        const msg = await getBotContent("vip_benefits");
        await notifyUser(chatId, msg ?? "VIP information is unavailable.");
        break;
      }
      case "/packages": {
        const msg = await getFormattedVipPackages();
        await notifyUser(chatId, msg, { parse_mode: "Markdown" });
        break;
      }
      case "/promo": {
        const parts = (msg.text || "").split(/\s+/);
        const code = parts[1];
        const supa = await getSupabase();
        if (!supa) {
          await notifyUser(chatId, "Promotions are currently unavailable.");
          break;
        }
        if (!code) {
          const { data: promos } = await supa
            .from("promotions")
            .select("code,discount_type,discount_value")
            .eq("is_active", true)
            .or(`valid_until.is.null,valid_until.gt.${new Date().toISOString()}`)
            .limit(5);
          const lines = promos?.length
            ? promos.map((p: any, i: number) => {
                const discount = p.discount_type === "percentage"
                  ? `${p.discount_value}%`
                  : `$${p.discount_value}`;
                return `${i + 1}. ${p.code} - ${discount}`;
              }).join("\n")
            : "No active promotions.";
          await notifyUser(
            chatId,
            `🎁 *Active Promotions:*\n${lines}\n\nUse /promo CODE to apply.`,
            { parse_mode: "Markdown" },
          );
        } else {
          try {
            const { data } = await supa.rpc("validate_promo_code", {
              p_code: code,
              p_telegram_user_id: String(chatId),
            });
            const res = Array.isArray(data) ? data[0] : data;
            if (res?.valid) {
              const promo_data = { code } as Record<string, unknown>;
              const { data: us } = await supa
                .from("user_sessions")
                .select("id")
                .eq("telegram_user_id", String(chatId))
                .limit(1)
                .maybeSingle();
              if (us?.id) {
                await supa
                  .from("user_sessions")
                  .update({ promo_data })
                  .eq("id", us.id);
              } else {
                await supa.from("user_sessions").insert({
                  telegram_user_id: String(chatId),
                  promo_data,
                  last_activity: new Date().toISOString(),
                  is_active: true,
                });
              }
              await notifyUser(
                chatId,
                "✅ Promo code applied! It will be used at checkout.",
              );
            } else {
              await notifyUser(chatId, "❌ Invalid or expired promo code.");
            }
          } catch {
            await notifyUser(chatId, "❌ Error validating promo code.");
          }
        }
        break;
      }
      case "/dashboard": {
        const supa = await getSupabase();
        if (supa) {
          const { data: user } = await supa
            .from("bot_users")
            .select("is_vip,subscription_expires_at")
            .eq("telegram_id", chatId)
            .maybeSingle();

          const vipStatus = user?.is_vip ? "✅ Active" : "❌ Inactive";
          const expiry = user?.subscription_expires_at
            ? new Date(user.subscription_expires_at).toLocaleDateString()
            : "N/A";

          const { data: promos } = await supa
            .from("promotions")
            .select("code,discount_type,discount_value")
            .eq("is_active", true)
            .or(
              `valid_until.is.null,valid_until.gt.${new Date().toISOString()}`,
            )
            .limit(3);

          const promoLines = promos?.length
            ? promos
              .map((p: any, i: number) => {
                const discount = p.discount_type === "percentage"
                  ? `${p.discount_value}%`
                  : `$${p.discount_value}`;
                return `${i + 1}. ${p.code} - ${discount}`;
              })
              .join("\n")
            : "No active promotions.";

          const { data: interactions } = await supa
            .from("user_interactions")
            .select("interaction_data")
            .eq("interaction_type", "command")
            .limit(1000);

          const counts = new Map<string, number>();
          for (const row of interactions ?? []) {
            const cmd = (row.interaction_data as string || "").split(" ")[0];
            if (!cmd) continue;
            counts.set(cmd, (counts.get(cmd) ?? 0) + 1);
          }
          const topCmds = [...counts.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3);
          const cmdLines = topCmds.length
            ? topCmds
              .map(([c, n], i) => `${i + 1}. ${c} (${n})`)
              .join("\n")
            : "No commands yet.";

          const message =
            `📊 *Dashboard*\n\n👤 *Subscription:* ${vipStatus}\n` +
            `📅 *Expires:* ${expiry}\n\n` +
            `🎁 *Active Promotions:*\n${promoLines}\n\n` +
            `🔥 *Top Commands:*\n${cmdLines}`;

          await notifyUser(chatId, message, {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [{
                  text: "View Packages",
                  callback_data: "dashboard_packages",
                }],
                [{ text: "Redeem Promo", callback_data: "dashboard_redeem" }],
                [{ text: "Help", callback_data: "dashboard_help" }],
              ],
            },
          });
        }
        break;
      }
      case "/faq": {
        const msg = await getBotContent("faq_general");
        await notifyUser(chatId, msg ?? "FAQ is unavailable.");
        break;
      }
      case "/ping":
        await notifyUser(
          chatId,
          JSON.stringify((await loadAdminHandlers()).handlePing()),
        );
        break;
      case "/version":
        await notifyUser(
          chatId,
          JSON.stringify((await loadAdminHandlers()).handleVersion()),
        );
        break;
      case "/env": {
        const envStatus = await (await loadAdminHandlers()).handleEnvStatus();
        await notifyUser(chatId, JSON.stringify(envStatus));
        break;
      }
      case "/reviewlist": {
        const { handleReviewList } = await loadAdminHandlers();
        const list = await handleReviewList();
        await notifyUser(chatId, JSON.stringify(list));
        break;
      }
      case "/replay": {
        const id = args[0];
        if (id) {
          const { handleReplay } = await loadAdminHandlers();
          await notifyUser(chatId, JSON.stringify(handleReplay(id)));
        }
        break;
      }
      case "/webhookinfo": {
        const { handleWebhookInfo } = await loadAdminHandlers();
        const info = await handleWebhookInfo();
        await notifyUser(chatId, JSON.stringify(info));
        break;
      }
      case "/admin": {
        const userId = String(msg.from?.id ?? chatId);
        const { handleAdminDashboard } = await loadAdminHandlers();
        await handleAdminDashboard(chatId, userId);
        break;
      }
      case "/status": {
        const supa = await getSupabase();
        if (supa) {
          const { data } = await supa
            .from("bot_users")
            .select("is_vip,subscription_expires_at")
            .eq("telegram_id", chatId)
            .maybeSingle();
          const vip = data?.is_vip ? "VIP: active" : "VIP: inactive";
          const expiry = data?.subscription_expires_at
            ? `Expiry: ${
              new Date(data.subscription_expires_at).toLocaleDateString()
            }`
            : "Expiry: none";
          await notifyUser(chatId, `${vip}\n${expiry}`);
        }
        break;
      }
      default:
        // Unsupported command; ignore silently
        break;
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
  try {
    // Always acknowledge the callback to avoid client retries
    await answerCallbackQuery(cb.id);
    if (data.startsWith("menu:")) {
      const section = data.slice("menu:".length) as
        | "home"
        | "plans"
        | "status"
        | "support";
      await showMainMenu(chatId, section);
      return;
    }

    const handlers = await loadAdminHandlers();
    if (data.startsWith("toggle_flag_")) {
      const flag = data.replace("toggle_flag_", "");
      await handlers.handleToggleFeatureFlag(chatId, userId, flag);
    } else {
      switch (data) {
        case "dashboard_packages": {
          const msg = await getFormattedVipPackages();
          await notifyUser(chatId, msg, { parse_mode: "Markdown" });
          break;
        }
        case "dashboard_redeem":
          await sendMiniAppLink(chatId);
          break;
        case "dashboard_help": {
          const msg = await getBotContent("help_message");
          await notifyUser(chatId, msg ?? "Help is coming soon.");
          break;
        }
        case "admin_dashboard":
          await handlers.handleAdminDashboard(chatId, userId);
          break;
        case "table_management":
          await handlers.handleTableManagement(chatId, userId);
          break;
        case "feature_flags":
          await handlers.handleFeatureFlags(chatId, userId);
          break;
        case "publish_flags":
          await handlers.handlePublishFlagsRequest(chatId);
          break;
        case "publish_flags_confirm":
          await handlers.handlePublishFlagsConfirm(chatId, userId);
          break;
        case "rollback_flags":
          await handlers.handleRollbackFlagsRequest(chatId);
          break;
        case "rollback_flags_confirm":
          await handlers.handleRollbackFlagsConfirm(chatId, userId);
          break;
        case "env_status": {
          const envStatus = await handlers.handleEnvStatus();
          await notifyUser(chatId, JSON.stringify(envStatus));
          break;
        }
        case "manage_table_bot_users":
          await handlers.handleUserTableManagement(chatId, userId);
          break;
        case "manage_table_subscription_plans":
          await handlers.handleSubscriptionPlansManagement(chatId, userId);
          break;
        case "table_stats_overview":
          await handlers.handleTableStatsOverview(chatId, userId);
          break;
        default:
          // Other callbacks can be added here
          break;
      }
    }
  } catch (err) {
    console.error("handleCallback error", err);
  }
}

export async function startReceiptPipeline(update: TelegramUpdate): Promise<void> {
  try {
    const chatId = update.message!.chat.id;
    if (!(await getFlag("vip_sync_enabled"))) {
      await notifyUser(chatId, "VIP sync is currently disabled.");
      return;
    }
    const fileId = getFileIdFromUpdate(update);
    if (!fileId) {
      await notifyUser(chatId, "No receipt image found.");
      return;
    }
    if (!BOT_TOKEN) {
      await notifyUser(chatId, "Receipt processing unavailable.");
      return;
    }
    const fileInfo = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`,
    ).then((r) => r.json()).catch(() => null);
    const path = fileInfo?.result?.file_path;
    if (!path) {
      await notifyUser(chatId, "Cannot fetch receipt.");
      return;
    }
    const blob = await fetch(
      `https://api.telegram.org/file/bot${BOT_TOKEN}/${path}`,
    ).then((r) => r.blob());
    const hash = await hashBytesToSha256(blob);
    const storagePath = `receipts/${chatId}/${hash}`;
    await storeReceiptImage(blob, storagePath);
    const supa = await getSupabase();
    const { data: user } = await supa?.from("bot_users")
      .select("id")
      .eq("telegram_id", chatId)
      .maybeSingle() ?? { data: null };
    if (!user?.id) {
      await notifyUser(chatId, "Please use /start before sending receipts.");
      return;
    }
    await insertReceiptRecord({
      user_id: user.id,
      file_url: storagePath,
      image_sha256: hash,
    });
    await notifyUser(chatId, "✅ Receipt received. We'll review it shortly.");
  } catch (err) {
    console.error("startReceiptPipeline error", err);
  }
}

export async function serveWebhook(req: Request): Promise<Response> {
  // CORS preflight support for browser calls
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
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
    const supa = await supaSvc();
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
      const supa = await supaSvc();
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

if (import.meta.main) {
  Deno.serve(serveWebhook);
}
