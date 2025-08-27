import { optionalEnv } from "./env.ts";
import type { SupabaseClient } from "./client.ts";

export async function getVipChannels(supa: SupabaseClient | null): Promise<string[]> {
  const envVal = optionalEnv("VIP_CHANNELS");
  if (envVal) {
    return envVal.split(",").map((s) => s.trim()).filter(Boolean);
  }
  if (!supa) return [];
  try {
    const { data, error } = await supa.from("bot_settings").select("setting_value").eq(
      "setting_key",
      "vip_channels",
    ).eq("is_active", true).maybeSingle();
    if (!error && data && data.setting_value) {
      const val = data.setting_value as unknown;
      if (Array.isArray(val)) return val.map((v) => String(v));
      if (typeof val === "string") {
        try {
          const arr = JSON.parse(val);
          if (Array.isArray(arr)) return arr.map((v) => String(v));
        } catch { /* ignore */ }
      }
    }
  } catch {
    /* ignore */
  }
  return [];
}

export async function getChatMemberStatus(
  botToken: string,
  chatId: string,
  userId: string,
): Promise<string | null> {
  try {
    const resp = await fetch(
      `https://api.telegram.org/bot${botToken}/getChatMember`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, user_id: userId }),
      },
    );
    const text = await resp.text();
    const json = JSON.parse(text);
    return json?.result?.status ?? null;
  } catch {
    return null;
  }
}

export function isMemberLike(status: string | null): boolean {
  return status === "member" || status === "administrator" || status === "creator";
}

export async function checkUserAcrossChannels(
  botToken: string,
  channels: string[],
  userId: string,
): Promise<Array<{ channel: string; status: string | null; active: boolean }>> {
  const out: Array<{ channel: string; status: string | null; active: boolean }> = [];
  for (const ch of channels) {
    const status = await getChatMemberStatus(botToken, ch, userId);
    out.push({ channel: ch, status, active: isMemberLike(status) });
  }
  return out;
}

export async function upsertMemberships(
  supa: SupabaseClient,
  userId: string,
  results: Array<{ channel: string; active: boolean }>,
): Promise<void> {
  const rows = results.map((r) => ({
    telegram_user_id: userId,
    channel_id: String(r.channel),
    is_active: r.active,
    updated_at: new Date().toISOString(),
  }));
  if (rows.length === 0) return;
  await supa.from("channel_memberships").upsert(rows, {
    onConflict: "telegram_user_id,channel_id",
  });
}

export async function recomputeVipFlag(
  supa: SupabaseClient,
  userId: string,
  graceDays = 0,
): Promise<{ is_vip: boolean; by: string } | null> {
  try {
    const { data: chan } = await supa.from("channel_memberships").select("id").eq(
      "telegram_user_id",
      userId,
    ).eq("is_active", true).limit(1).maybeSingle();
    const vipByChannel = !!chan;

    const { data: sub } = await supa.from("user_subscriptions").select(
      "is_active, subscription_end_date",
    ).eq("telegram_user_id", userId).maybeSingle();
    let vipBySub = false;
    let subExp: string | null = null;
    if (sub) {
      if (sub.is_active) vipBySub = true;
      else if (sub.subscription_end_date) {
        const end = new Date(sub.subscription_end_date);
        const graceMs = graceDays * 86400000;
        if (end.getTime() > Date.now() - graceMs) vipBySub = true;
        subExp = sub.subscription_end_date;
      }
    }
    const isVip = vipByChannel || vipBySub;
    let by = "none";
    if (vipByChannel && vipBySub) by = "both";
    else if (vipByChannel) by = "channel";
    else if (vipBySub) by = "subscription";
    await supa.from("bot_users").update({
      is_vip: isVip,
      subscription_expires_at: subExp,
    }).eq("telegram_id", userId);
    return { is_vip: isVip, by };
  } catch {
    return null;
  }
}

