// >>> DC BLOCK: promo-redeem-core (start)
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { requireEnv } from "../_shared/env.ts";
import { calcFinalAmount, redeemKey } from "../_shared/promo.ts";

serve(async (req) => {
  const { code, telegram_id, plan_id, payment_id } = await req.json().catch(() => ({}));
  if (!code || !telegram_id || !plan_id || !payment_id) {
    return new Response(JSON.stringify({ ok: false, error: "bad_request" }), { status: 400 });
  }
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = requireEnv(
    ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const,
  );
  const headers = {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    "content-type": "application/json",
  };

  // Ensure promo still valid and get details
  const vr = await fetch(`${SUPABASE_URL}/rest/v1/rpc/validate_promo_code`, {
    method: "POST",
    headers,
    body: JSON.stringify({ p_code: code, p_telegram_user_id: String(telegram_id) }),
  });
  const [res] = await vr.json();
  if (!res?.valid) {
    return new Response(JSON.stringify({ ok: false, reason: res?.reason || "invalid" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }

  // check if already used
  const usage = await fetch(
    `${SUPABASE_URL}/rest/v1/promotion_usage?promotion_id=eq.${res.promotion_id}&telegram_user_id=eq.${telegram_id}&select=id`,
    { headers },
  );
  const used = await usage.json();

  if (!used?.length) {
    await fetch(`${SUPABASE_URL}/rest/v1/rpc/record_promo_usage`, {
      method: "POST",
      headers,
      body: JSON.stringify({ p_promotion_id: res.promotion_id, p_telegram_user_id: String(telegram_id) }),
    });
  }

  const pr = await fetch(
    `${SUPABASE_URL}/rest/v1/subscription_plans?id=eq.${plan_id}&select=price`,
    { headers },
  );
  const plan = await pr.json();
  const price = plan?.[0]?.price || 0;
  const final_amount = calcFinalAmount(price, res.discount_type, res.discount_value);
  const discount_amount = price - final_amount;

  const idKey = redeemKey(payment_id, code);
  await fetch(`${SUPABASE_URL}/rest/v1/promo_analytics`, {
    method: "POST",
    headers: { ...headers, Prefer: "resolution=ignore-duplicates" },
    body: JSON.stringify([{ id: idKey, promo_code: code, telegram_user_id: String(telegram_id), plan_id, event_type: "redeem", discount_amount, final_amount }]),
  });

  return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
});
// <<< DC BLOCK: promo-redeem-core (end)
