import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "../_shared/client.ts";
import { ok, mna, oops } from "../_shared/http.ts";
import { envOrSetting } from "../_shared/config.ts";

const need = (k: string) =>
  Deno.env.get(k) || (() => {
    throw new Error(`Missing env ${k}`);
  })();

async function completePayment(
  _supa: unknown,
  paymentId: string,
  monthsOverride?: number,
) {
  // Reuse Phase 4 admin flow by calling the endpoint (keeps logic in one place)
  const admin = need("ADMIN_API_SECRET");
  const ref = new URL(need("SUPABASE_URL")).hostname.split(".")[0];
  const url = `https://${ref}.functions.supabase.co/admin-review-payment`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "X-Admin-Secret": admin },
    body: JSON.stringify({
      payment_id: paymentId,
      decision: "approve",
      months: monthsOverride,
      message: "✅ Auto-verified payment",
    }),
  });
  return { ok: r.ok, j: await r.json().catch(() => ({})) };
}

function num(x: unknown) {
  const n = Number(x);
  return isFinite(n) ? n : null;
}

serve(async (req) => {
  try {
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname.endsWith("/version")) {
      return ok({ name: "payments-auto-review", ts: new Date().toISOString() });
    }
    if (req.method !== "POST") {
      return mna();
    }

    const supa = createClient();

    // Pull tolerance & window from env or bot_settings
    const tol = num(await envOrSetting("AMOUNT_TOLERANCE")) ?? 0.05; // 5%
    const win = num(await envOrSetting("WINDOW_SECONDS")) ?? 7200;

    // Find recent pending with receipts
    const sinceIso = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { data: pendings } = await supa.from("payments")
      .select(
        "id,plan_id,amount,currency,payment_method,created_at,webhook_data, status",
      )
      .eq("status", "pending").gte("created_at", sinceIso).limit(50);

    const results: Array<Record<string, unknown>> = [];

    for (const p of pendings || []) {
      const ocr = p.webhook_data?.ocr;
      const hasReceipt = !!p.webhook_data?.storage_path;

      // If bank_transfer and has receipt but no OCR yet, trigger OCR once and skip for now
      if (p.payment_method === "bank_transfer" && hasReceipt && !ocr) {
        const ref = new URL(need("SUPABASE_URL")).hostname.split(".")[0];
        await fetch(`https://${ref}.functions.supabase.co/receipt-ocr`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ payment_id: p.id }),
        }).catch(() => {});
        results.push({ id: p.id, action: "queued_ocr" });
        continue;
      }

      // Evaluate rules
      let pass = false;
      let reason = "";

      if (p.payment_method === "bank_transfer" && ocr) {
        const amt = num(ocr.amount);
        const currency = (ocr.currency || "").toUpperCase();
        // Expected price/currency from plan
        const { data: plan } = await supa.from("subscription_plans").select(
          "price,currency",
        ).eq("id", p.plan_id).maybeSingle();
        const expAmt = num(plan?.price ?? p.amount);
        const expCur = (plan?.currency ?? p.currency ?? "").toUpperCase();
        const within = (amt != null && expAmt != null)
          ? Math.abs(amt - expAmt) <= (expAmt * tol + 0.01)
          : false;
        const curOK = currency && expCur ? (currency === expCur) : true;

        // Time window check (receipt date close to created_at)
        let timeOK = true;
        if (ocr.date) {
          const rcpt = new Date(String(ocr.date));
          const created = new Date(p.created_at);
          timeOK = Math.abs(rcpt.getTime() - created.getTime()) <= win * 1000;
        }

        pass = Boolean((ocr.confidence ?? 0) >= 0.7 && within && curOK && timeOK);
        reason = pass
          ? "rules_ok"
          : `fail(conf=${ocr.confidence},within=${within},cur=${curOK},time=${timeOK})`;
      }

      // Auto-approve crypto payments (e.g., USDT transfers)
      if (!pass && p.payment_method === "crypto") {
        pass = true;
        reason = "crypto_auto";
      }

      if (pass) {
        await supa.from("admin_logs").insert({
          admin_telegram_id: "system",
          action_type: "auto_complete",
          action_description:
            `Auto-completed payment ${p.id} via ${p.payment_method} (${reason})`,
          affected_table: "payments",
          affected_record_id: p.id,
        });
        const okr = await completePayment(supa, p.id);
        results.push({ id: p.id, action: "completed", ok: okr.ok });
      } else {
        results.push({
          id: p.id,
          action: ocr ? `held_${reason}` : "waiting_ocr",
        });
      }
    }

    return ok({ results });
  } catch (e) {
    return oops("Internal Error", String(e));
  }
});
