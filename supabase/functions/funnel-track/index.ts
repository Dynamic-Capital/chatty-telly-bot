// >>> DC BLOCK: funnel-track-core (start)
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { requireEnv } from "../_shared/env.ts";

serve(async (req) => {
  const { telegram_id, step, data } = await req.json().catch(() => ({}));
  if (!telegram_id || typeof step !== "number") {
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
  await fetch(`${SUPABASE_URL}/rest/v1/conversion_tracking`, {
    method: "POST",
    headers,
    body: JSON.stringify([
      {
        telegram_user_id: String(telegram_id),
        funnel_step: step,
        conversion_type: "funnel",
        conversion_data: data || null,
      },
    ]),
  });
  return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
});
// <<< DC BLOCK: funnel-track-core (end)
