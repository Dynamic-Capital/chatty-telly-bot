import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getEnv } from "../_shared/env.ts";
// Supabase client (Deno ESM)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function getVipForTelegram(supa: any, tg: string): Promise<boolean | null> {
  const { data: users, error } = await supa
    .from("bot_users")
    .select("is_vip, subscription_expires_at")
    .eq("telegram_id", tg)
    .limit(1);
  if (error) {
    throw new Error(error.message);
  }
  let isVip: boolean | null = null;
  if (users && users.length > 0) {
    const u = users[0] as any;
    if (typeof u.is_vip === "boolean") isVip = u.is_vip;
    if (isVip === null && u.subscription_expires_at) {
      isVip = new Date(u.subscription_expires_at).getTime() >= Date.now();
    }
  }
  return isVip;
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  let body: { telegram_id?: string };
  try {
    body = await req.json();
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }
  const tg = String(body.telegram_id || "").trim();
  if (!tg) return new Response("Missing telegram_id", { status: 400 });

  const url = getEnv("SUPABASE_URL");
  const srv = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supa = createClient(url, srv, { auth: { persistSession: false } });

  let isVip: boolean | null = null;
  try {
    isVip = await getVipForTelegram(supa, tg);
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: (error as Error).message }), {
      status: 500,
    });
  }

  return new Response(JSON.stringify({ ok: true, vip: { is_vip: isVip } }), {
    headers: { "content-type": "application/json" },
  });
});
