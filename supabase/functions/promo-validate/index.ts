import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { requireEnv } from "../_shared/env.ts";
import { calcFinalAmount } from "../_shared/promo.ts";
import { bad, json, mna, ok } from "../_shared/http.ts";
import { version } from "../_shared/version.ts";

export async function handler(req: Request): Promise<Response> {
  const v = version(req, "promo-validate");
  if (v) return v;
  if (req.method !== "POST") return mna();

  const { code, telegram_id, plan_id } = await req.json().catch(() => ({}));
  if (!code || !telegram_id || !plan_id) {
    return bad("bad_request");
  }

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = requireEnv(
    ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const,
  );
  const headers = {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    "content-type": "application/json",
  };

  const vr = await fetch(`${SUPABASE_URL}/rest/v1/rpc/validate_promo_code`, {
    method: "POST",
    headers,
    body: JSON.stringify({ p_code: code, p_telegram_user_id: String(telegram_id) }),
  });
  const [res] = await vr.json();
  if (!res?.valid) {
    return json({ ok: false, reason: res?.reason || "invalid" }, 200);
  }

  const pr = await fetch(
    `${SUPABASE_URL}/rest/v1/subscription_plans?id=eq.${plan_id}&select=price`,
    { headers },
  );
  const plan = await pr.json();
  const price = plan?.[0]?.price || 0;
  const final_amount = calcFinalAmount(price, res.discount_type, res.discount_value);

  return ok({
    type: res.discount_type,
    value: res.discount_value,
    final_amount,
  });
}

if (import.meta.main) serve(handler);
