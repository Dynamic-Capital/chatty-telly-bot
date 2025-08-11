import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getEnv } from "../_shared/env.ts";

function need(k: string) {
  return getEnv(k as any);
}

async function tgSend(token: string, chatId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  }).catch(() => {});
}

serve(async (_req) => {
  const url = need("SUPABASE_URL");
  const svc = need("SUPABASE_SERVICE_ROLE_KEY");
  const bot = need("TELEGRAM_BOT_TOKEN");
  const supa = createClient(url, svc, { auth: { persistSession: false } });

  const now = new Date();
  const d7 = new Date(now);
  d7.setDate(now.getDate() + 7);
  const d1 = new Date(now);
  d1.setDate(now.getDate() + 1);

  let { data: soon7 } = await supa.rpc("get_users_expiring_between", {
    start_ts: new Date(d7.setHours(0, 0, 0, 0)).toISOString(),
    end_ts: new Date(d7.setHours(23, 59, 59, 999)).toISOString(),
  }).catch(() => ({ data: [] as any[] }));
  for (const u of soon7 || []) {
    if (u.telegram_id) {
      await tgSend(
        bot,
        String(u.telegram_id),
        "⏰ <b>Reminder:</b> Your VIP expires in 7 days. Renew in the Mini App.",
      );
    }
  }

  let { data: soon1 } = await supa.rpc("get_users_expiring_between", {
    start_ts: new Date(d1.setHours(0, 0, 0, 0)).toISOString(),
    end_ts: new Date(d1.setHours(23, 59, 59, 999)).toISOString(),
  }).catch(() => ({ data: [] as any[] }));
  for (const u of soon1 || []) {
    if (u.telegram_id) {
      await tgSend(
        bot,
        String(u.telegram_id),
        "⏰ <b>Final reminder:</b> Your VIP expires tomorrow. Renew to keep access.",
      );
    }
  }

  const { data: expired } = await supa.from("bot_users")
    .select("id,telegram_id,subscription_expires_at")
    .not("subscription_expires_at", "is", null)
    .lte("subscription_expires_at", now.toISOString());
  for (const u of expired || []) {
    await supa.from("bot_users").update({ is_vip: false }).eq("id", u.id);
    await supa.from("admin_logs").insert({
      admin_telegram_id: "system",
      action_type: "vip_expired",
      action_description: `Auto-expire user ${u.id}`,
      affected_table: "bot_users",
      affected_record_id: u.id,
      old_values: { subscription_expires_at: u.subscription_expires_at },
      new_values: { is_vip: false },
    });
    if (u.telegram_id) {
      await tgSend(
        bot,
        String(u.telegram_id),
        "⚠️ <b>VIP expired.</b> Renew anytime from the Mini App.",
      );
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      counts: {
        reminded7: soon7?.length || 0,
        reminded1: soon1?.length || 0,
        expired: expired?.length || 0,
      },
    }),
    { headers: { "content-type": "application/json" } },
  );
});
