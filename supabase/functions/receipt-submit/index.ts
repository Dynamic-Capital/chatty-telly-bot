import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "../_shared/client.ts";

const AMOUNT_TOLERANCE = Number(Deno.env.get("AMOUNT_TOLERANCE") ?? "0.02");

async function activateSubscription(
  supa: ReturnType<typeof createClient>,
  paymentId: string,
) {
  await supa.rpc("finalize_completed_payment", {
    p_payment_id: paymentId,
  }).catch(() => null);
}

type Body = {
  telegram_id: string;
  payment_id: string;
  storage_path: string;
  storage_bucket?: string;
};

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  const supa = createClient();

  const { error } = await supa
    .from("payments")
    .update({
      status: "pending",
      webhook_data: {
        storage_bucket: body.storage_bucket || "receipts",
        storage_path: body.storage_path,
      },
    })
    .eq("id", body.payment_id);
  if (error) {
    return new Response(
      JSON.stringify({ ok: false, error: error.message }),
      { status: 500 },
    );
  }

  // Trigger OCR of the uploaded receipt
  const ref = (Deno.env.get("SUPABASE_URL") || "");
  let ocr: Record<string, unknown> | null = null;
  try {
    const host = new URL(ref).hostname.split(".")[0];
    const r = await fetch(`https://${host}.functions.supabase.co/receipt-ocr`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ payment_id: body.payment_id }),
    });
    const j = await r.json().catch(() => ({}));
    ocr = j.ocr || null;
  } catch {
    ocr = null;
  }

  // Load payment and plan for comparison
  const { data: pay } = await supa.from("payments")
    .select("id, plan_id, amount, currency, webhook_data")
    .eq("id", body.payment_id)
    .maybeSingle();
  if (!pay) {
    return new Response(
      JSON.stringify({ ok: false, error: "Payment not found" }),
      { status: 404 },
    );
  }

  const { data: plan } = await supa.from("subscription_plans")
    .select("price,currency")
    .eq("id", pay.plan_id)
    .maybeSingle();

  const amt = Number(ocr?.amount);
  const expAmt = Number(plan?.price ?? pay.amount);
  const within = isFinite(amt) && isFinite(expAmt)
    ? Math.abs(amt - expAmt) <= (expAmt * AMOUNT_TOLERANCE + 0.01)
    : false;
  const curOK = (ocr?.currency || "").toUpperCase() ===
    (plan?.currency ?? pay.currency ?? "").toUpperCase();
  const merged = {
    ...(pay.webhook_data || {}),
    ocr,
    ocr_at: new Date().toISOString(),
  };

  if (ocr && within && curOK) {
    await supa.from("payments").update({
      status: "completed",
      webhook_data: merged,
    }).eq("id", pay.id);
    await activateSubscription(supa, pay.id);
    return new Response(
      JSON.stringify({ ok: true, status: "completed" }),
      { headers: { "content-type": "application/json" } },
    );
  }

  await supa.from("payments").update({ webhook_data: merged }).eq(
    "id",
    pay.id,
  );
  await supa.from("admin_logs").insert({
    admin_telegram_id: "system",
    action_type: "ocr_mismatch",
    action_description: `OCR mismatch for payment ${pay.id}`,
    affected_table: "payments",
    affected_record_id: pay.id,
    new_values: { ocr },
  });

  return new Response(
    JSON.stringify({ ok: true, status: "pending" }),
    { headers: { "content-type": "application/json" } },
  );
});
