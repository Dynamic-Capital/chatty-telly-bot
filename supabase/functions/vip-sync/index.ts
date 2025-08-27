import { ok, mna, unauth, bad } from "../_shared/http.ts";
import { recomputeVipForUser } from "../_shared/vip_sync.ts";
import { createClient } from "../_shared/client.ts";
import { optionalEnv } from "../_shared/env.ts";

const ADMIN_SECRET = optionalEnv("ADMIN_API_SECRET");

async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  if (url.pathname.endsWith("/version") && req.method === "GET") {
    return ok({ name: "vip-sync", ts: Date.now() });
  }
  if (req.method !== "POST") return mna();
  if (req.headers.get("X-Admin-Secret") !== ADMIN_SECRET) return unauth();

  const supa = createClient();
  const path = url.pathname.split("/").pop();
  if (path === "one") {
    const { telegram_user_id } = await req.json().catch(() => ({}));
    if (!telegram_user_id) return bad("telegram_user_id required");
    const res = await recomputeVipForUser(String(telegram_user_id), supa);
    await supa.from("admin_logs").insert({
      action_type: "vip_sync_one",
      action_description: String(telegram_user_id),
    });
    return ok({ result: res });
  }
  if (path === "batch") {
    const { limit } = await req.json().catch(() => ({}));
    const lim = Number(limit ?? optionalEnv("SYNC_BATCH_SIZE") ?? "200");
    const { data: users } = await supa.from("bot_users").select("telegram_id").order(
      "updated_at",
      { ascending: true },
    ).limit(lim);
    for (const u of users ?? []) {
      await recomputeVipForUser(u.telegram_id, supa);
    }
    await supa.from("admin_logs").insert({
      action_type: "vip_sync_batch",
      action_description: String(users?.length ?? 0),
    });
    return ok({ count: users?.length ?? 0 });
  }
  if (path === "all") {
    const { chunkSize, maxUsers } = await req.json().catch(() => ({}));
    const chunk = Number(chunkSize ?? 200);
    const max = Number(maxUsers ?? 10000);
    let processed = 0;
    let offset = 0;
    while (processed < max) {
      const { data: users } = await supa.from("bot_users").select("telegram_id").order(
        "updated_at",
        { ascending: true },
      ).range(offset, offset + chunk - 1);
      const arr = users ?? [];
      if (arr.length === 0) break;
      for (const u of arr) {
        await recomputeVipForUser(u.telegram_id, supa);
      }
      processed += arr.length;
      offset += arr.length;
      if (arr.length < chunk) break;
    }
    await supa.from("admin_logs").insert({
      action_type: "vip_sync_all",
      action_description: String(processed),
    });
    return ok({ processed });
  }
  return mna();
}

export default handler;
if (import.meta.main) {
  Deno.serve(handler);
}
