import { createClient, type SupabaseClient } from "./client.ts";
import { optionalEnv } from "./env.ts";
import {
  getVipChannels,
  checkUserAcrossChannels,
  upsertMemberships,
  recomputeVipFlag,
} from "./telegram_membership.ts";

export async function recomputeVipForUser(
  telegramUserId: string,
  supa?: SupabaseClient,
): Promise<{ is_vip: boolean; by: string; channels: Array<{ channel: string; status: string | null; active: boolean }> } | null> {
  const client = supa ?? createClient();
  const botToken = optionalEnv("TELEGRAM_BOT_TOKEN");
  if (!botToken) return null;
  const channels = await getVipChannels(client);
  const results = await checkUserAcrossChannels(botToken, channels, telegramUserId);
  await upsertMemberships(client, telegramUserId, results);
  const graceDays = Number(optionalEnv("VIP_EXPIRY_GRACE_DAYS") || "0");
  const vip = await recomputeVipFlag(client, telegramUserId, graceDays);
  try {
    await client.from("admin_logs").insert({
      action_type: "vip_recompute",
      telegram_user_id: telegramUserId,
      action_description: JSON.stringify({ results, vip }),
    });
  } catch {
    /* ignore */
  }
  if (!vip) return null;
  return { ...vip, channels: results };
}

