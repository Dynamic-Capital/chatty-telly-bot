import { createClient } from "npm:@supabase/supabase-js@2";
import { ocrTextFromBlob } from "../../telegram-bot/ocr.ts";
import { parseBankSlip } from "../../telegram-bot/bank-parsers.ts";
import { getApprovedBeneficiaryByAccountNumber, normalizeAccount } from "../../telegram-bot/helpers/beneficiary.ts";
import { resizeUrl } from "../images/resize-url.ts";
import { log } from "../logging.ts";
import { safeSend } from "../security/safe-send.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface JobPayload {
  user_id: string;
  payment_id?: string | null;
  storage_path: string;
  sha256: string;
  attempts?: number;
}

interface QueueJob {
  payload: JobPayload;
  attempts: number;
  ack: () => Promise<void>;
  retry: (attempts: number) => Promise<void>;
}

interface PaymentIntent {
  id: string;
  expected_amount: number;
  expected_beneficiary_account_last4?: string | null;
  expected_beneficiary_name?: string | null;
  pay_code?: string | null;
  created_at: string;
}

async function process(payload: JobPayload) {
  const start = Date.now();
  const url = resizeUrl(payload.storage_path);
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
  });
  const blob = await res.blob();
  const text = await ocrTextFromBlob(blob);
  const parsed = parseBankSlip(text);
  const userId = payload.user_id;

  // Find intent
  let intent: PaymentIntent | null = null;
  if (parsed.payCode) {
    const { data } = await client.from("payment_intents").select("*").eq("pay_code", parsed.payCode).maybeSingle();
    intent = data;
  }
  if (!intent) {
    const { data } = await client.from("payment_intents").select("*")
      .eq("user_id", userId)
      .eq("method", "bank")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    intent = data;
  }
  if (!intent) {
    await client.from("receipts").insert({
      user_id: userId,
      file_url: payload.storage_path,
      image_sha256: payload.sha256,
      bank: parsed.bank,
      ocr_text: parsed.rawText,
      verdict: "manual_review",
      reason: "no_intent_found",
    });
    await safeSend(BOT_TOKEN, userId, "🔎 Receipt queued for manual review");
    log("processed", { sha: payload.sha256, verdict: "manual_review", ms: Date.now() - start });
    return;
  }

  // Beneficiary check
  let beneficiaryOK = false;
  const toAccount = parsed.toAccount ? normalizeAccount(parsed.toAccount) : null;
  const toName = parsed.toName?.toLowerCase() || null;
  if (intent.expected_beneficiary_account_last4 && toAccount) {
    beneficiaryOK = toAccount.endsWith(intent.expected_beneficiary_account_last4);
  }
  if (!beneficiaryOK && intent.expected_beneficiary_name && toName) {
    beneficiaryOK = intent.expected_beneficiary_name.toLowerCase() === toName;
  }
  if (!beneficiaryOK && toAccount) {
    const ben = await getApprovedBeneficiaryByAccountNumber(client, toAccount);
    if (ben && ben.account_name && toName) {
      beneficiaryOK = ben.account_name.toLowerCase() === toName;
    }
  }

  const amountOK = parsed.amount != null && Math.abs(parsed.amount - intent.expected_amount) / intent.expected_amount <= 0.02;
  const slipTimeStr = parsed.ocrTxnDateIso ?? parsed.ocrValueDateIso;
  const timeOK = slipTimeStr
    ? Math.abs(new Date(slipTimeStr).getTime() - new Date(intent.created_at).getTime()) / 1000 <= 3600
    : false;
  const statusOK = parsed.successWord || parsed.status === "SUCCESS";
  const payCodeOK = !intent.pay_code || parsed.payCode === intent.pay_code;
  const approved = amountOK && timeOK && statusOK && beneficiaryOK && payCodeOK;

  await client.from("receipts").insert({
    payment_id: intent.id,
    user_id: userId,
    file_url: payload.storage_path,
    image_sha256: payload.sha256,
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
    verdict: approved ? "approved" : "manual_review",
    reason: approved ? null : "auto_rules_failed",
  });

  if (approved) {
    await client.from("payment_intents").update({ status: "approved", approved_at: new Date().toISOString() }).eq("id", intent.id);
    await safeSend(BOT_TOKEN, userId, "✅ Receipt verified. Access granted.");
  } else {
    await client.from("payment_intents").update({ status: "manual_review" }).eq("id", intent.id);
    await safeSend(BOT_TOKEN, userId, "🔎 Receipt queued for manual review");
  }

  log("processed", { sha: payload.sha256, verdict: approved ? "approved" : "manual_review", ms: Date.now() - start });
}

async function popJob(): Promise<QueueJob | null> {
  try {
    const { data } = await client.rpc("pgmq_read", { queue_name: "ocr", vt: 60, qty: 1 });
    if (data && data.length) {
      const job = data[0];
      const payload = job.msg as JobPayload;
      const attempts = payload.attempts ?? 0;
      return {
        payload,
        attempts,
        ack: async () => {
          await client.rpc("pgmq_delete", { queue_name: "ocr", msg_id: job.msg_id });
        },
        retry: async (nextAttempts: number) => {
          if (nextAttempts >= 5) {
            await client.rpc("pgmq_send", { queue_name: "ocr_dead", message: { ...payload, attempts: nextAttempts } });
          } else {
            await client.rpc("pgmq_send", { queue_name: "ocr", message: { ...payload, attempts: nextAttempts } });
          }
          await client.rpc("pgmq_delete", { queue_name: "ocr", msg_id: job.msg_id });
        },
      };
    }
  } catch (_) {
    const { data } = await client.from("ocr_jobs").select("*")
      .eq("status", "pending")
      .lte("next_run_at", new Date().toISOString())
      .order("next_run_at")
      .limit(1)
      .maybeSingle();
    if (data) {
      await client.from("ocr_jobs").update({ status: "processing" }).eq("id", data.id);
      const attempts = data.attempts ?? 0;
      return {
        payload: data.payload as JobPayload,
        attempts,
        ack: async () => {
          await client.from("ocr_jobs").update({ status: "done" }).eq("id", data.id);
        },
        retry: async (nextAttempts: number) => {
          const next = new Date(Date.now() + Math.pow(2, nextAttempts) * 1000);
          if (nextAttempts >= 5) {
            try {
              await client.from("ocr_jobs_dead").insert({ ...data, attempts: nextAttempts });
            } catch (_) {
              // ignore if dead-letter table missing
            }
            await client.from("ocr_jobs").delete().eq("id", data.id);
          } else {
            await client.from("ocr_jobs").update({ attempts: nextAttempts, next_run_at: next.toISOString(), status: "pending" }).eq("id", data.id);
          }
        },
      };
    }
  }
  return null;
}

export async function pullAndProcess(count = 10) {
  for (let i = 0; i < count; i++) {
    const job = await popJob();
    if (!job) break;
    try {
      await process(job.payload);
      await job.ack();
    } catch (err) {
      const nextAttempts = job.attempts + 1;
      await job.retry(nextAttempts);
      log("job_error", { sha: job.payload.sha256, error: (err as Error).message, attempts: nextAttempts });
    }
  }
}
