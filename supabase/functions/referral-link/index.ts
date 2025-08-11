// >>> DC BLOCK: referral-link-core (start)
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { requireEnv } from "../_shared/env.ts";

export function makeReferralLink(username: string, id: string | number): string {
  return `https://t.me/${username}?startapp=ref_${id}`;
}

serve(async (req) => {
  const { telegram_id } = await req.json().catch(() => ({}));
  if (!telegram_id) {
    return new Response(JSON.stringify({ ok: false, error: "bad_request" }), { status: 400 });
  }
  const { TELEGRAM_BOT_USERNAME } = requireEnv(["TELEGRAM_BOT_USERNAME"] as const);
  const link = makeReferralLink(TELEGRAM_BOT_USERNAME, telegram_id);
  return new Response(JSON.stringify({ ok: true, link }), { headers: { "content-type": "application/json" } });
});
// <<< DC BLOCK: referral-link-core (end)
