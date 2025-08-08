import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";
import { ocrTextFromBlob } from "./ocr.ts";
import { parseBankSlip } from "./bank-parsers.ts";
import {
  getApprovedBeneficiaryByAccountNumber,
  normalizeAccount,
} from "./helpers/beneficiary.ts";
import { requireEnv } from "./helpers/require-env.ts";
import {
  insertReceiptRecord,
  markIntentApproved,
  markIntentManualReview,
} from "./database-utils.ts";
import {
  handleEnvStatus,
  handlePing,
  handleReviewList,
  handleReplay,
  handleVersion,
  handleWebhookInfo,
} from "./admin-handlers.ts";

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
  try {
    if (text === "/ping") {
      await notifyUser(chatId, JSON.stringify(handlePing()));
    } else if (text === "/version") {
      await notifyUser(chatId, JSON.stringify(handleVersion()));
    } else if (text === "/env") {
      await notifyUser(chatId, JSON.stringify(handleEnvStatus()));
    } else if (text === "/reviewlist") {
      const list = await handleReviewList();
      await notifyUser(chatId, JSON.stringify(list));
    } else if (text.startsWith("/replay")) {
      const id = text.split(/\s+/)[1];
      if (id) {
        await notifyUser(chatId, JSON.stringify(handleReplay(id)));
      }
    } else if (text === "/webhookinfo") {
      const info = await handleWebhookInfo();
      await notifyUser(chatId, JSON.stringify(info));
    }
  } catch (err) {
    console.error("handleCommand error", err);
  }
}

async function startReceiptPipeline(update: TelegramUpdate): Promise<void> {
  try {
    const message = update.message!;
    const chatId = message.chat.id;
    const userId = String(message.from?.id ?? "");
    if (!rateLimitGuard(chatId)) return;

    const fileId = getFileIdFromUpdate(update);
    if (!fileId) return;

    const fileData = await downloadTelegramFile(fileId);
    if (!fileData) return;
    const { blob, filePath } = fileData;

    const hashHex = await hashBytesToSha256(blob);
    const supabase = getSupabase();
    const { data: dup } = await supabase
      .from("receipts")
      .select("id")
      .eq("image_sha256", hashHex)
      .maybeSingle();
    if (dup) {
      await notifyUser(chatId, "This receipt was already used");
      logEvent("receipt_processed", {
        chatId,
        verdict: "duplicate",
        reason: "duplicate_image",
      });
      return;
    }

    const ext = filePath.split(".").pop() || "jpg";
    const storagePath = `${userId}/${hashHex}.${ext}`;
    const fileUrl = await storeReceiptImage(blob, storagePath);

    const ocrStart = performance.now();
    const text = await ocrTextFromBlob(blob);
    const ocrMs = Math.round(performance.now() - ocrStart);

    const parsed = parseBankSlip(text);
    const supa = getSupabase();

    let intent: PaymentIntent | null = null;
    if (parsed.payCode) {
      const { data } = await supa
        .from("payment_intents")
        .select("*")
        .eq("pay_code", parsed.payCode)
        .maybeSingle();
      intent = data as PaymentIntent | null;
    }
    if (!intent) {
      const { data } = await supa
        .from("payment_intents")
        .select("*")
        .eq("user_id", userId)
        .eq("method", "bank")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      intent = data as PaymentIntent | null;
    }

    let verdict = "manual_review";
    let reason: string | null = "no_intent_found";

    if (intent) {
      const toAccount = parsed.toAccount
        ? normalizeAccount(parsed.toAccount)
        : null;
      const toName = parsed.toName?.toLowerCase() ?? null;
      let beneficiaryOK = false;
      if (intent.expected_beneficiary_account_last4 && toAccount) {
        beneficiaryOK = toAccount.endsWith(
          intent.expected_beneficiary_account_last4,
        );
      }
      if (!beneficiaryOK && intent.expected_beneficiary_name && toName) {
        beneficiaryOK =
          intent.expected_beneficiary_name.toLowerCase() === toName;
      }
      if (!beneficiaryOK && toAccount) {
        const ben = await getApprovedBeneficiaryByAccountNumber(
          supa,
          toAccount,
        );
        if (ben && ben.account_name && toName) {
          beneficiaryOK = ben.account_name.toLowerCase() === toName;
        }
      }

      const amountOK = parsed.amount != null &&
        Math.abs(parsed.amount - intent.expected_amount) /
              intent.expected_amount <= AMOUNT_TOLERANCE;
      const slipTimeStr = parsed.ocrTxnDateIso ?? parsed.ocrValueDateIso;
      const timeOK = slipTimeStr
        ? Math.abs(
              new Date(slipTimeStr).getTime() -
                new Date(intent.created_at).getTime(),
            ) / 1000 <=
          WINDOW_SECONDS
        : false;
      const statusOK = parsed.successWord || parsed.status === "SUCCESS";
      const payCodeOK = !REQUIRE_PAY_CODE || !intent.pay_code ||
        parsed.payCode === intent.pay_code;

      const approved = amountOK && timeOK && statusOK && beneficiaryOK &&
        payCodeOK;
      verdict = approved ? "approved" : "manual_review";
      reason = approved ? null : "auto_rules_failed";

      if (approved) {
        await markIntentApproved(intent.id);
      } else {
        await markIntentManualReview(intent.id, reason!);
      }
    }

    await insertReceiptRecord({
      payment_id: intent?.id ?? null,
      user_id: userId,
      file_url: fileUrl,
      image_sha256: hashHex,
      bank: parsed.bank,
      ocr_text: parsed.rawText,
      ocr_amount: parsed.amount,
      ocr_currency: parsed.currency,
      ocr_status: parsed.status,
      ocr_success_word: parsed.successWord,
      ocr_reference: parsed.reference,
      ocr_from_name: parsed.fromName,
      ocr_to_name: parsed.toName,
      ocr_to_account: parsed.toAccount,
      ocr_pay_code: parsed.payCode,
      ocr_txn_date: parsed.ocrTxnDateIso,
      ocr_value_date: parsed.ocrValueDateIso,
      verdict,
      reason,
    });

    if (verdict === "approved") {
      await notifyUser(chatId, "✅ Verified…");
    } else if (verdict === "manual_review") {
      await notifyUser(chatId, "🔎 Sent to review…");
    }

    logEvent("receipt_processed", {
      chatId,
      ocrMs,
      parserConfidence: 1,
      verdict,
      reason,
    });
  } catch (err) {
    console.error("startReceiptPipeline error", err);
  }
}

export async function serveWebhook(req: Request): Promise<Response> {
  const { ok, missing } = requireEnv(REQUIRED_ENV_KEYS);
  if (!ok) {
    console.error("Missing env vars", missing);
    return okJSON();
  }

  const url = new URL(req.url);
  if (url.searchParams.get("secret") !== WEBHOOK_SECRET) {
    return okJSON();
  }

  const update = await extractTelegramUpdate(req);
  if (!update) return okJSON();

  handleCommand(update);

  const fileId = getFileIdFromUpdate(update);
  if (fileId) startReceiptPipeline(update);

  return okJSON();
}

Deno.serve(serveWebhook);
