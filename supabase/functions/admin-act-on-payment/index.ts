import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "../_shared/client.ts";
import { verifyInitDataAndGetUser, isAdmin } from "../_shared/telegram.ts";
import { ok, bad, nf, mna, unauth } from "../_shared/http.ts";
import { activateSubscription } from "../_shared/subscriptions.ts";
import { requireEnv } from "../_shared/env.ts";

type Body = { initData: string; payment_id: string; decision: "approve"|"reject"; months?: number; message?: string };

async function tgSend(token: string, chatId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST", headers: { "content-type":"application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" })
  }).catch(()=>{});
}

export async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  if (req.method === "GET" && url.pathname.endsWith("/version")) {
    return ok({ name: "admin-act-on-payment", ts: new Date().toISOString() });
  }
  if (req.method === "HEAD") return new Response(null, { status: 200 });
  if (req.method !== "POST") return mna();
  let body: Body; try { body = await req.json(); } catch { return bad("Bad JSON"); }

  const u = await verifyInitDataAndGetUser(body.initData || "");
  if (!u || !isAdmin(u.id)) return unauth();

  const { TELEGRAM_BOT_TOKEN: bot } =
    requireEnv(["TELEGRAM_BOT_TOKEN"] as const);
  const supa = createClient();

  // Load payment + user + plan
  const { data: p } = await supa.from("payments").select("id,status,user_id,plan_id,amount,currency,created_at").eq("id", body.payment_id).maybeSingle();
  if (!p) return nf("Payment not found");
  const { data: user } = await supa.from("bot_users").select("id,telegram_id,subscription_expires_at,is_vip").eq("id", p.user_id).maybeSingle();
  if (!user) return nf("User not found");

  if (body.decision === "reject") {
    await supa.from("payments").update({ status: "failed" }).eq("id", p.id).single();
    if (user.telegram_id) await tgSend(bot, String(user.telegram_id), `❌ <b>Payment Failed</b>\\n${body.message || "Please contact support."}`);
    await supa.from("admin_logs").insert({
      admin_telegram_id: String(u.id),
      action_type: "payment_failed",
      action_description: `Payment ${p.id} marked as failed`,
      affected_table: "payments",
      affected_record_id: p.id,
      new_values: { status: "failed" }
    });
    return ok({ status: "failed" });
  }

  // approve
  const months = Number.isFinite(body.months) ? Number(body.months) : undefined;
  await supa.from("payments").update({ status: "completed" }).eq("id", p.id).single();
  const { expiresAt } = await activateSubscription({
    telegramId: user.telegram_id,
    planId: p.plan_id,
    paymentId: p.id,
    adminTelegramId: String(u.id),
    monthsOverride: months,
  });

  if (user.telegram_id) await tgSend(bot, String(user.telegram_id), `✅ <b>VIP Activated</b>\nValid until <b>${new Date(expiresAt).toLocaleDateString()}</b>.`);

  return ok({ status: "completed", subscription_expires_at: expiresAt });
}

if (import.meta.main) serve(handler);
