import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "../_shared/client.ts";
import { getEnv, optionalEnv } from "../_shared/env.ts";
import { ok } from "../_shared/http.ts";

type Body = {
  admin_telegram_id?: string;
  payment_id: string;
  decision: "approve" | "reject";
  months?: number;
  message?: string;
};

function csvToSet(s?: string | null) {
  return new Set(
    (s || "").split(",").map((x) => x.trim()).filter(Boolean),
  );
}

async function tgSend(token: string, chatId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  }).catch(() => {});
}

serve(async (req) => {
  const url = new URL(req.url);
  if (req.method === "GET" && url.pathname.endsWith("/version")) {
    return ok({ name: "admin-review-payment", ts: new Date().toISOString() });
  }
  if (req.method === "HEAD") return new Response(null, { status: 200 });
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const hdr = req.headers.get("X-Admin-Secret") || "";
  const EXPECT = getEnv("ADMIN_API_SECRET");
  if (hdr !== EXPECT) return new Response("Unauthorized", { status: 401 });

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }
  if (!body?.payment_id || !body?.decision) {
    return new Response("Missing fields", { status: 400 });
  }

  const adminId = String(body.admin_telegram_id || "");
  const admins = csvToSet(optionalEnv("TELEGRAM_ADMIN_IDS"));
  if (admins.size && (!adminId || !admins.has(adminId))) {
    return new Response("Admin not allowed", { status: 403 });
  }

  const supa = createClient();
  const botToken = getEnv("TELEGRAM_BOT_TOKEN");

  const { data: p, error: perr } = await supa
    .from("payments")
    .select("id,status,user_id,plan_id,amount,currency,created_at")
    .eq("id", body.payment_id)
    .maybeSingle();
  if (perr || !p) return new Response("Payment not found", { status: 404 });

  const { data: prof, error: uerr } = await supa
    .from("bot_users")
    .select("id,telegram_id,subscription_expires_at,is_vip")
    .eq("id", p.user_id)
    .maybeSingle();
  if (uerr || !prof) return new Response("User not found", { status: 404 });

  let newStatus = p.status;
  let expiresAt: string | null = prof.subscription_expires_at
    ? new Date(prof.subscription_expires_at).toISOString()
    : null;

  if (body.decision === "reject") {
    newStatus = "failed";
    await supa.from("payments").update({ status: newStatus }).eq("id", p.id);

    if (prof.telegram_id) {
      const msg = body.message ||
        "Your payment failed. Please contact support.";
      await tgSend(
        botToken,
        String(prof.telegram_id),
        `❌ <b>Payment Failed</b>\\n${msg}`,
      );
    }

    await supa.from("admin_logs").insert({
      admin_telegram_id: adminId || "unknown",
      action_type: "payment_failed",
      action_description: `Payment ${p.id} marked as failed`,
      affected_table: "payments",
      affected_record_id: p.id,
      new_values: { status: newStatus },
    });

    return new Response(
      JSON.stringify({ ok: true, status: newStatus }),
      { headers: { "content-type": "application/json" } },
    );
  }

  let months = Number.isFinite(body.months) ? Number(body.months) : null;
  if (!months) {
    const { data: plan } = await supa
      .from("subscription_plans")
      .select("duration_months,is_lifetime")
      .eq("id", p.plan_id)
      .maybeSingle();
    if (plan?.is_lifetime) months = 1200;
    else months = plan?.duration_months || 1;
  }

  const now = new Date();
  const base = prof.subscription_expires_at &&
      new Date(prof.subscription_expires_at) > now
    ? new Date(prof.subscription_expires_at)
    : now;
  const next = new Date(base);
  next.setMonth(next.getMonth() + (months || 1));
  expiresAt = next.toISOString();

  newStatus = "completed";
  await supa.from("payments").update({ status: newStatus }).eq("id", p.id);

  await supa.from("user_subscriptions").upsert({
    telegram_user_id: prof.telegram_id,
    plan_id: p.plan_id,
    payment_status: "completed",
    is_active: true,
    subscription_start_date: now.toISOString(),
    subscription_end_date: expiresAt,
  }, { onConflict: "telegram_user_id" });

  await supa.from("bot_users").update({
    is_vip: true,
    subscription_expires_at: expiresAt,
  }).eq("id", prof.id);

  if (prof.telegram_id) {
    const msg = body.message ||
      `✅ <b>VIP Activated</b>\nYour access is valid until <b>${
        new Date(expiresAt!).toLocaleDateString()
      }</b>.`;
    await tgSend(botToken, String(prof.telegram_id), msg);
  }

  await supa.from("admin_logs").insert({
    admin_telegram_id: adminId || "unknown",
    action_type: "payment_completed",
    action_description: `Payment ${p.id} completed; VIP until ${expiresAt}`,
    affected_table: "bot_users",
    affected_record_id: prof.id,
    new_values: { is_vip: true, subscription_expires_at: expiresAt },
  });

  return new Response(
    JSON.stringify({
      ok: true,
      status: newStatus,
      subscription_expires_at: expiresAt,
    }),
    { headers: { "content-type": "application/json" } },
  );
});
