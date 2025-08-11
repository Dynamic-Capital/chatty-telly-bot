// >>> DC BLOCK: promo-validate-core (start)
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { requireEnv } from "../_shared/env.ts";
import { calcFinalAmount } from "../_shared/promo.ts";

serve(async (req) => {
  const { code, telegram_id, plan_id } = await req.json().catch(() => ({}));
  if (!code || !telegram_id || !plan_id) {
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

  // validate via RPC
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

  // fetch plan price
  const pr = await fetch(
    `${SUPABASE_URL}/rest/v1/subscription_plans?id=eq.${plan_id}&select=price`,
    { headers },
  );
  const plan = await pr.json();
  const price = plan?.[0]?.price || 0;
  const final_amount = calcFinalAmount(price, res.discount_type, res.discount_value);

  return new Response(
    JSON.stringify({
      ok: true,
      type: res.discount_type,
      value: res.discount_value,
      final_amount,
    }),
    { headers: { "content-type": "application/json" } },
  );
});
// <<< DC BLOCK: promo-validate-core (end)
