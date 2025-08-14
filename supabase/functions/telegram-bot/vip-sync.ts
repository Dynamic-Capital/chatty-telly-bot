import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { optionalEnv } from "../_shared/env.ts";
import { getFlag } from "../../../src/utils/config.ts";

const BOT_TOKEN = optionalEnv("TELEGRAM_BOT_TOKEN");

async function syncToTelegram(tgId: number): Promise<void> {
  if (!BOT_TOKEN) return;
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: tgId,
        text: "Your VIP status has been synchronized.",
      }),
    });
  } catch (e) {
    console.error("vip-sync telegram error", e);
  }
}

/**
 * Synchronize VIP users with external systems.
 * Returns true if the sync ran, false if disabled.
 */
export async function syncVipData(client: SupabaseClient): Promise<boolean> {
  if (!(await getFlag("vip_sync_enabled"))) {
    return false;
  }
  try {
    const { data, error } = await client
      .from("bot_users")
      .select("telegram_id")
      .eq("is_vip", true);
    if (error || !data) {
      console.error("vip-sync: failed to fetch VIP users", error);
      return false;
    }
    for (const row of data) {
      if (!(await getFlag("vip_sync_enabled"))) {
        console.log("vip-sync: disabled mid-operation");
        return false;
      }
      const tgId = row.telegram_id;
      if (tgId) await syncToTelegram(tgId);
    }
    return true;
  } catch (e) {
    console.error("vip-sync error", e);
    return false;
  }
}
