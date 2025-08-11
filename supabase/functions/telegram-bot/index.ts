import { optionalEnv } from "../_shared/env.ts";
import { requireEnv as requireEnvCheck } from "./helpers/require-env.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { alertAdmins } from "../_shared/alerts.ts";

interface TelegramMessage {
  chat: { id: number };
  from?: { id?: number };
  text?: string;
  photo?: { file_id: string }[];
  document?: { file_id: string; mime_type?: string };
  [key: string]: unknown;
}

interface TelegramUpdate {
  message?: TelegramMessage;
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

type SupabaseClient = any;
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

function okJSON(body: unknown = { ok: true }): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

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

async function sendMiniAppLink(chatId: number): Promise<void> {
  if (!BOT_TOKEN) return;
  const miniUrl = optionalEnv("MINI_APP_URL");
  const short = optionalEnv("MINI_APP_SHORT_NAME");
  if (!miniUrl && !short) {
    await sendMessage(
      chatId,
      "Welcome! Mini app is being configured. Please try again soon.",
    );
    return;
  }
  const openUrl = miniUrl
    ? (miniUrl.endsWith("/") ? miniUrl : miniUrl + "/")
    : `https://t.me/${botUsername}?startapp=1`;

  await sendMessage(chatId, "Open the VIP Mini App:", {
    reply_markup: {
      inline_keyboard: [[{
        text: "Open VIP Mini App",
        web_app: { url: openUrl },
      }]],
    },
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

function isStartMessage(m?: TelegramMessage): boolean {
  const t = m?.text ?? "";
  if (t.startsWith("/start")) return true;
  // Fallback to entities scanning
  const ents = (m as unknown as {
    entities?: Array<{ offset: number; length: number; type: string }>;
  })?.entities;
  return Array.isArray(ents) &&
    ents.some((e) =>
      e.type === "bot_command" &&
      t.slice(e.offset, e.length).startsWith("/start")
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
    return new Response("Too Many Requests", { status: 429 });
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
      case "/env":
        await notifyUser(
          chatId,
          JSON.stringify((await loadAdminHandlers()).handleEnvStatus()),
        );
        break;
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

async function startReceiptPipeline(update: TelegramUpdate): Promise<void> {
  try {
    const chatId = update.message!.chat.id;
    await notifyUser(chatId, "Receipt processing is temporarily disabled.");
  } catch (err) {
    console.error("startReceiptPipeline error", err);
  }
}

async function readDbWebhookSecret(): Promise<string | null> {
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const srv = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !srv) return null;
    const supa = createClient(url, srv, { auth: { persistSession: false } });
    const { data, error } = await supa
      .from("bot_settings")
      .select("setting_value")
      .eq("setting_key", "TELEGRAM_WEBHOOK_SECRET")
      .limit(1)
      .maybeSingle();
    if (error) return null;
    return (data?.setting_value as string) || null;
  } catch {
    return null;
  }
}

export async function serveWebhook(req: Request): Promise<Response> {
  // CORS preflight support for browser calls
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const { ok, missing } = requireEnvCheck(
      REQUIRED_ENV_KEYS as unknown as string[],
    );
    if (!ok) {
      console.error("Missing env vars", missing);
      return okJSON();
    }

    // --- Secret validation (ENV or DB) ---
    const h = req.headers;
    const got = h.get("X-Telegram-Bot-Api-Secret-Token") ||
      h.get("x-telegram-bot-api-secret-token") || "";
    const envSecret = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") || "";
    const dbSecret = await readDbWebhookSecret();
    const expected = envSecret || dbSecret || "";

    if (!expected) {
      console.log("telegram-bot: no secret configured (env nor db); refusing");
      return new Response("Secret missing", { status: 500 });
    }
    if (got !== expected) {
      console.log("telegram-bot: secret mismatch");
      return new Response("Unauthorized", { status: 401 });
    }
    // --- end secret validation ---

    const body = await extractTelegramUpdate(req);
    if (
      body && typeof body === "object" &&
      (body as { test?: string }).test === "ping" &&
      Object.keys(body).length === 1
    ) {
      return okJSON({ pong: true });
    }
    const update = body as TelegramUpdate | null;
    if (!update) return okJSON();

    const tgId = String(
      update?.message?.from?.id ?? update?.callback_query?.from?.id ?? "",
    );
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

    const fileId = getFileIdFromUpdate(update);
    if (fileId) startReceiptPipeline(update);

    return okJSON();
  } catch (e) {
    console.log("bot fatal:", e?.message ?? e);
    await alertAdmins(`🚨 <b>Bot error</b>\n<code>${String(e)}</code>`);
    const supa = supaSvc();
    await supa.from("admin_logs").insert({
      admin_telegram_id: "system",
      action_type: "bot_error",
      action_description: String(e),
    });
    return new Response("Internal Error", { status: 500 });
  }
}

if (import.meta.main) {
  Deno.serve(serveWebhook);
}
