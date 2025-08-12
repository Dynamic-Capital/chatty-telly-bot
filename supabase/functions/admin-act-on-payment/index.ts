import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyInitDataAndGetUser, isAdmin } from "../_shared/telegram.ts";
import { ok, bad, nf, mna, unauth, oops } from "../_shared/http.ts";
import { requireEnv } from "../_shared/env.ts";

type Body = { initData: string; payment_id: string; decision: "approve"|"reject"; months?: number; message?: string };

async function tgSend(token: string, chatId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST", headers: { "content-type":"application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" })
  }).catch(()=>{});
}

serve(async (req) => {
  const url = new URL(req.url);
  if (req.method === "GET" && url.pathname.endsWith("/version")) {
    return ok({ name: "admin-act-on-payment", ts: new Date().toISOString() });
  }
  if (req.method === "HEAD") return new Response(null, { status: 200 });
  if (req.method !== "POST") return mna();
  let body: Body; try { body = await req.json(); } catch { return bad("Bad JSON"); }

  const u = await verifyInitDataAndGetUser(body.initData || "");
  if (!u || !isAdmin(u.id)) return unauth();

  let env;
  try {
    env = requireEnv(
      [
        "SUPABASE_URL",
        "SUPABASE_SERVICE_ROLE_KEY",
        "TELEGRAM_BOT_TOKEN",
      ] as const,
    );
  } catch (e) {
    return oops("Missing env vars", String(e));
  }
  const supa = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const bot = env.TELEGRAM_BOT_TOKEN;

  // Load payment + user + plan
  const { data: p } = await supa.from("payments").select("id,status,user_id,plan_id,amount,currency,created_at").eq("id", body.payment_id).maybeSingle();
  if (!p) return nf("Payment not found");
  const { data: user } = await supa.from("bot_users").select("id,telegram_id,subscription_expires_at,is_vip").eq("id", p.user_id).maybeSingle();
  if (!user) return nf("User not found");

  if (body.decision === "reject") {
    await supa.from("payments").update({ status: "rejected" }).eq("id", p.id);
    if (user.telegram_id) await tgSend(bot, String(user.telegram_id), `❌ <b>Payment Rejected</b>\n${body.message || "Please contact support."}`);
    await supa.from("admin_logs").insert({
      admin_telegram_id: String(u.id),
      action_type: "payment_rejected",
      action_description: `Payment ${p.id} rejected`,
      affected_table: "payments",
      affected_record_id: p.id,
      new_values: { status: "rejected" }
    });
    return ok({ status: "rejected" });
  }

  // approve
  let months = Number.isFinite(body.months) ? Number(body.months) : null;
  if (!months) {
    const { data: plan } = await supa.from("subscription_plans").select("duration_months,is_lifetime").eq("id", p.plan_id).maybeSingle();
    months = plan?.is_lifetime ? 1200 : (plan?.duration_months || 1);
  }

  const now = new Date();
  const base = user.subscription_expires_at && new Date(user.subscription_expires_at) > now ? new Date(user.subscription_expires_at) : now;
  const next = new Date(base); next.setMonth(next.getMonth() + (months || 1));
  const expiresAt = next.toISOString();

  await supa.from("payments").update({ status: "completed" }).eq("id", p.id);
  await supa.from("user_subscriptions").upsert({
    telegram_user_id: user.telegram_id, plan_id: p.plan_id, payment_status: "completed",
    is_active: true, subscription_start_date: now.toISOString(), subscription_end_date: expiresAt
  }, { onConflict: "telegram_user_id" });
  await supa.from("bot_users").update({ is_vip: true, subscription_expires_at: expiresAt }).eq("id", user.id);

  if (user.telegram_id) await tgSend(bot, String(user.telegram_id), `✅ <b>VIP Activated</b>\nValid until <b>${new Date(expiresAt).toLocaleDateString()}</b>.`);
  await supa.from("admin_logs").insert({
    admin_telegram_id: String(u.id),
    action_type: "payment_approved",
    action_description: `Payment ${p.id} approved; VIP until ${expiresAt}`,
    affected_table: "bot_users", affected_record_id: user.id,
    new_values: { is_vip: true, subscription_expires_at: expiresAt }
  });

  return ok({ status: "completed", subscription_expires_at: expiresAt });
});
