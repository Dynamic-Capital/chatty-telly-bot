import { createClient } from "./client.ts";

export async function activateSubscription({ telegramId, planId, paymentId, adminTelegramId, monthsOverride }: {
  telegramId: string | number;
  planId: string;
  paymentId: string;
  adminTelegramId?: string;
  monthsOverride?: number;
}) {
  const supa = createClient();

  // Load user profile
  const { data: user, error: userErr } = await supa
    .from("bot_users")
    .select("id,subscription_expires_at")
    .eq("telegram_id", telegramId)
    .maybeSingle();
  if (userErr || !user) throw new Error("User not found");

  // Load plan to get duration
  let months = monthsOverride || null;
  if (!months) {
    const { data: plan } = await supa
      .from("subscription_plans")
      .select("duration_months,is_lifetime")
      .eq("id", planId)
      .maybeSingle();
    months = plan?.is_lifetime ? 1200 : (plan?.duration_months || 1);
  }

  const now = new Date();
  const base = user.subscription_expires_at && new Date(user.subscription_expires_at) > now
    ? new Date(user.subscription_expires_at)
    : now;
  const next = new Date(base);
  next.setMonth(next.getMonth() + months);
  const expiresAt = next.toISOString();

  await supa.from("user_subscriptions").upsert({
    telegram_user_id: telegramId,
    plan_id: planId,
    payment_status: "completed",
    is_active: true,
    subscription_start_date: now.toISOString(),
    subscription_end_date: expiresAt,
  }, { onConflict: "telegram_user_id" });

  await supa.from("bot_users").update({
    is_vip: true,
    subscription_expires_at: expiresAt,
  }).eq("id", user.id).single();

  await supa.from("admin_logs").insert({
    admin_telegram_id: adminTelegramId || "system",
    action_type: "payment_completed",
    action_description: `Payment ${paymentId} completed; VIP until ${expiresAt}`,
    affected_table: "bot_users",
    affected_record_id: user.id,
    new_values: { is_vip: true, subscription_expires_at: expiresAt },
  });

  return { expiresAt };
}
