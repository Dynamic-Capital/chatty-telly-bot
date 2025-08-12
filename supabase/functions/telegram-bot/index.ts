import { optionalEnv } from "../_shared/env.ts";
import { requireEnv as requireEnvCheck } from "./helpers/require-env.ts";
import { alertAdmins } from "../_shared/alerts.ts";
import { json, mna, ok, oops } from "../_shared/http.ts";
import { validateTelegramHeader } from "../_shared/telegram_secret.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

interface TelegramMessage {
  chat: { id: number };
  from?: { id?: number };
  text?: string;
  photo?: { file_id: string }[];
  document?: { file_id: string; mime_type?: string };
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
    const { createClient } = await import(
      "https://esm.sh/@supabase/supabase-js@2"
    );
    supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
  } catch (_e) {
    supabaseAdmin = null;
  }
  return supabaseAdmin;
}

type AdminHandlers = {
  handleEnvStatus: typeof import("./admin-handlers.ts").handleEnvStatus;
  handlePing: typeof import("./admin-handlers.ts").handlePing;
  handleReplay: typeof import("./admin-handlers.ts").handleReplay;
  handleReviewList: typeof import("./admin-handlers.ts").handleReviewList;
  handleVersion: typeof import("./admin-handlers.ts").handleVersion;
  handleWebhookInfo: typeof import("./admin-handlers.ts").handleWebhookInfo;
  handleAdminDashboard: typeof import("./admin-handlers.ts").handleAdminDashboard;
  handleTableManagement: typeof import("./admin-handlers.ts").handleTableManagement;
  handleFeatureFlags: typeof import("./admin-handlers.ts").handleFeatureFlags;
};

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
): Promise<void> {
  if (!BOT_TOKEN) return;
  try {
    const r = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, ...extra }),
      },
    );
    const out = await r.text();
    console.log("sendMessage", r.status, out.slice(0, 200));
  } catch (e) {
    console.error("sendMessage error", e);
  }
}

async function notifyUser(chatId: number, text: string): Promise<void> {
  await sendMessage(chatId, text);
}

async function sendMiniAppLink(chatId: number) {
  if (!BOT_TOKEN) return;
  const raw = (optionalEnv("MINI_APP_URL") || "").trim();
  let openUrl: string | null = null;
  if (raw) {
    try {
      const u = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
      if (u.protocol === "https:") {
        if (!u.pathname.endsWith("/")) u.pathname += "/";
        openUrl = u.toString();
      }
    } catch { /* ignore invalid */ }
  }
  if (!openUrl) {
    await sendMessage(chatId, "Welcome! Mini app is being configured. Please try again soon.");
    return;
  }
  await sendMessage(chatId, "Open the VIP Mini App:", {
    reply_markup: { inline_keyboard: [[{ text: "Open VIP Mini App", web_app: { url: openUrl } }]] }
  });
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
  const ents = m?.entities as { offset: number; length: number; type: string }[] | undefined;
  return Array.isArray(ents) && ents.some((e) =>
    e.type === "bot_command" &&
    t.slice(e.offset, e.offset + e.length).startsWith("/start")
  );
}

function logEvent(event: string, data: Record<string, unknown>): void {
  const sb_request_id = optionalEnv("SB_REQUEST_ID");
  console.log(JSON.stringify({ event, sb_request_id, ...data }));
}

function supaSvc() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key, { auth: { persistSession: false } });
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

async function handleStartPayload(msg: TelegramMessage): Promise<void> {
  const t = msg.text?.split(/\s+/)[1];
  if (!t) return;
  const supa = supaSvc();
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
  const supa = supaSvc();
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

  // Early match for /start variants like "/start", "/start@Bot", or "/start foo"
  if (isStartMessage(msg)) {
    await handleStartPayload(msg);
    await sendMiniAppLink(chatId);
    return;
  }

  // Extract the command without bot mentions and gather arguments
  const [firstToken, ...args] = text.split(/\s+/);
  const command = firstToken.split("@")[0];

  try {
    switch (command) {
      case "/start":
      case "/app":
        await sendMiniAppLink(chatId);
        break;
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
    const handlers = await loadAdminHandlers();
    switch (data) {
      case "admin_dashboard":
        await handlers.handleAdminDashboard(chatId, userId);
        break;
      case "table_management":
        await handlers.handleTableManagement(chatId, userId);
        break;
      case "feature_flags":
        await handlers.handleFeatureFlags(chatId, userId);
        break;
      case "env_status": {
        const envStatus = await handlers.handleEnvStatus();
        await notifyUser(chatId, JSON.stringify(envStatus));
        break;
      }
      default:
        // Other callbacks can be added here
        break;
    }
  } catch (err) {
    console.error("handleCallback error", err);
  }
}

async function startReceiptPipeline(update: TelegramUpdate): Promise<void> {
  try {
    const chatId = update.message!.chat.id;
    await notifyUser(chatId, "Receipt processing is temporarily disabled.");
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

  const authResp = await validateTelegramHeader(req);
  if (authResp) return authResp;

  try {
    const { ok: envOk, missing } = requireEnvCheck(
      REQUIRED_ENV_KEYS as unknown as string[],
    );
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

    // ---- BAN CHECK (short-circuit early) ----
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
    const fromId = String(
      update?.message?.from?.id ?? update?.callback_query?.from?.id ?? "",
    );
    if (fromId) {
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
    }

    const tgId = fromId;
    if (tgId) {
      const rl = await enforceRateLimit(tgId);
      if (rl) return rl; // 429
      const isCmd = !!update?.message?.text?.startsWith("/");
      await logInteraction(
        isCmd ? "command" : (update?.callback_query ? "callback" : "message"),
        tgId,
        update?.message?.text ?? update?.callback_query?.data ?? null,
      );
    }

    await handleCommand(update);
    await handleCallback(update);

    const fileId = getFileIdFromUpdate(update);
    if (fileId) startReceiptPipeline(update);

    return ok({ handled: true });
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    console.log("telegram-bot fatal:", errMsg);
    await alertAdmins(`🚨 <b>Bot error</b>\n<code>${String(e)}</code>`);
    const supa = supaSvc();
    await supa.from("admin_logs").insert({
      admin_telegram_id: "system",
      action_type: "bot_error",
      action_description: String(e),
    });
    return oops("Internal Error");
  }
}

if (import.meta.main) {
  Deno.serve(serveWebhook);
}
