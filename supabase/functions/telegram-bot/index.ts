import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";
import { requireEnv } from "./helpers/require-env.ts";
import {
  handleEnvStatus,
  handlePing,
  handleReviewList,
  handleReplay,
  handleVersion,
  handleWebhookInfo,
} from "./admin-handlers.ts";
import {
  wrapHandler,
} from "../../../src/telemetry/events.ts";
import { getStats } from "../../../src/telemetry/alerts.ts";

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
  "TELEGRAM_WEBHOOK_SECRET",
];

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
  "";
const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
const WEBHOOK_SECRET = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") || "";
// Ensure MINI_APP_URL always includes a trailing slash to avoid redirects
const MINI_APP_URL = (() => {
  const url = Deno.env.get("MINI_APP_URL");
  if (!url) return null;
  return url.endsWith("/") ? url : `${url}/`;
})();
const MINI_APP_SHORT_NAME = Deno.env.get("MINI_APP_SHORT_NAME") || null;

// Optional feature flags (currently unused)
const _OPENAI_ENABLED = Deno.env.get("OPENAI_ENABLED") === "true";
const _FAQ_ENABLED = Deno.env.get("FAQ_ENABLED") === "true";
const WINDOW_SECONDS = Number(Deno.env.get("WINDOW_SECONDS") || "180");
const AMOUNT_TOLERANCE = Number(Deno.env.get("AMOUNT_TOLERANCE") || "0.02");
const REQUIRE_PAY_CODE = Deno.env.get("REQUIRE_PAY_CODE") === "true";

let supabaseAdmin: SupabaseClient | null = null;
function getSupabase(): SupabaseClient {
  if (!supabaseAdmin) {
    supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
  }
  return supabaseAdmin;
}

function okJSON(body: unknown = { ok: true }): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

async function notifyUser(chatId: number, text: string): Promise<void> {
  if (!BOT_TOKEN) return;
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

function buildWebAppButton(label = "Open Mini App") {
  if (MINI_APP_SHORT_NAME) {
    return { text: label, web_app: { short_name: MINI_APP_SHORT_NAME } };
  }
  if (MINI_APP_URL) {
    return { text: label, web_app: { url: MINI_APP_URL } };
  }
  return null;
}

async function sendMiniAppLink(chatId: number): Promise<void> {
  if (!BOT_TOKEN) return;
  const button = buildWebAppButton("Open Mini App");
  const reply_markup = button ? { inline_keyboard: [[button]] } : undefined;

  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: button
        ? "Open the Dynamic Capital mini app"
        : "Mini app not configured yet.",
      reply_markup,
    }),
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

const rateLimitMap = new Map<number, number>();
function rateLimitGuard(chatId: number): boolean {
  const now = Date.now();
  const last = rateLimitMap.get(chatId) || 0;
  if (now - last < 5000) return false;
  rateLimitMap.set(chatId, now);
  return true;
}

function logEvent(event: string, data: Record<string, unknown>): void {
  const sb_request_id = Deno.env.get("SB_REQUEST_ID");
  console.log(JSON.stringify({ event, sb_request_id, ...data }));
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
  const supabase = getSupabase();
  await supabase.storage.from("receipts").upload(storagePath, blob, {
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
        await notifyUser(chatId, JSON.stringify(handlePing()));
        break;
      case "/version":
        await notifyUser(chatId, JSON.stringify(handleVersion()));
        break;
      case "/env":
        await notifyUser(chatId, JSON.stringify(handleEnvStatus()));
        break;
      case "/reviewlist": {
        const list = await handleReviewList();
        await notifyUser(chatId, JSON.stringify(list));
        break;
      }
      case "/replay": {
        const id = args[0];
        if (id) {
          await notifyUser(chatId, JSON.stringify(handleReplay(id)));
        }
        break;
      }
      case "/webhookinfo": {
        const info = await handleWebhookInfo();
        await notifyUser(chatId, JSON.stringify(info));
        break;
      }
      case "/admin": {
        const stats = getStats();
        const lines = [
          "\uD83E\uDDEA Health & Alerts",
          `Errors last 5m: ${stats.errors5m}`,
          `Errors last 1h: ${stats.errors1h}`,
          `Last webhook error: ${stats.lastWebhookError ? new Date(stats.lastWebhookError).toISOString() : "none"}`,
          `Avg latency (5m): ${stats.avgLatency5m.toFixed(1)}ms`,
        ];
        await notifyUser(chatId, lines.join("\n"));
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

const trackedHandleCommand = wrapHandler(
  "command",
  handleCommand,
  (u: TelegramUpdate) => u.message?.from?.id,
);

async function startReceiptPipeline(update: TelegramUpdate): Promise<void> {
  try {
    const chatId = update.message!.chat.id;
    await notifyUser(chatId, "Receipt processing is temporarily disabled.");
  } catch (err) {
    console.error("startReceiptPipeline error", err);
  }
}

export async function serveWebhook(req: Request): Promise<Response> {
  try {
    const { ok, missing } = requireEnv(REQUIRED_ENV_KEYS);
    if (!ok) {
      console.error("Missing env vars", missing);
      return okJSON();
    }

    const url = new URL(req.url);
    if (url.searchParams.get("secret") !== WEBHOOK_SECRET) {
      return okJSON();
    }

    const body = await extractTelegramUpdate(req);
    if (body && typeof body === "object" &&
      (body as { test?: string }).test === "ping" &&
      Object.keys(body).length === 1) {
      return okJSON({ pong: true });
    }
    const update = body as TelegramUpdate | null;
    if (!update) return okJSON();

    await trackedHandleCommand(update);

    const fileId = getFileIdFromUpdate(update);
    if (fileId) startReceiptPipeline(update);

    return okJSON();
  } catch (err) {
    console.error("serveWebhook error", err);
    return okJSON();
  }
}

Deno.serve(serveWebhook);
