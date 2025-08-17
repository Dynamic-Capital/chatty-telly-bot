import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { requireEnv } from "../_shared/env.ts";
import { bad, ok, mna } from "../_shared/http.ts";
import { version } from "../_shared/version.ts";

export function makeReferralLink(username: string, id: string | number): string {
  return `https://t.me/${username}?startapp=ref_${id}`;
}

export async function handler(req: Request): Promise<Response> {
  const v = version(req, "referral-link");
  if (v) return v;
  if (req.method !== "POST") return mna();

  const { telegram_id } = await req.json().catch(() => ({}));
  if (!telegram_id) {
    return bad("bad_request");
  }
  const { TELEGRAM_BOT_USERNAME } = requireEnv([
    "TELEGRAM_BOT_USERNAME",
  ] as const);
  const link = makeReferralLink(TELEGRAM_BOT_USERNAME, telegram_id);
  return ok({ link });
}

if (import.meta.main) serve(handler);
