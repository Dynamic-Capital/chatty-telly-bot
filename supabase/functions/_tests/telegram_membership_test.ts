import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isMemberLike, getChatMemberStatus } from "../_shared/telegram_membership.ts";
import { recomputeVipForUser } from "../_shared/vip_sync.ts";

Deno.test("isMemberLike works", () => {
  assert(isMemberLike("member"));
  assert(isMemberLike("administrator"));
  assert(!isMemberLike("left"));
});

Deno.test("getChatMemberStatus parses", async () => {
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ ok: true, result: { status: "left" } }));
  try {
    const status = await getChatMemberStatus("t", "-100", "1");
    assertEquals(status, "left");
  } finally {
    globalThis.fetch = oldFetch;
  }
});

function memorySupa() {
  const cm: Record<string, any> = {};
  const users: Record<string, any> = {};
  const logs: any[] = [];
  return {
    channel_memberships: cm,
    bot_users: users,
    admin_logs: logs,
    from(table: string) {
      if (table === "channel_memberships") {
        return {
          upsert: async (rows: any[]) => {
            for (const r of Array.isArray(rows) ? rows : [rows]) {
              cm[`${r.telegram_user_id}:${r.channel_id}`] = r;
            }
            return { data: null, error: null };
          },
          select: () => ({
            _filters: [] as any[],
            eq(field: string, val: any) {
              this._filters.push({ field, val });
              return this;
            },
            limit() { return this; },
            maybeSingle() {
              const found = Object.values(cm).find((r: any) =>
                this._filters.every((f: any) => r[f.field] === f.val)
              );
              return Promise.resolve({ data: found ?? null, error: null });
            },
          }),
        };
      }
      if (table === "user_subscriptions") {
        return {
          select: () => ({
            _filters: [] as any[],
            eq() { return this; },
            maybeSingle() { return Promise.resolve({ data: null, error: null }); },
          }),
        };
      }
      if (table === "bot_users") {
        return {
          update: (vals: any) => ({
            eq(field: string, val: any) {
              const u = users[val] || { telegram_id: val };
              users[val] = { ...u, ...vals };
              return { data: null, error: null };
            },
          }),
          upsert: (row: any) => { users[row.telegram_id] = row; return Promise.resolve({ data: null, error: null }); },
        };
      }
      if (table === "admin_logs") {
        return { insert: async (row: any) => { logs.push(row); return { data: row, error: null }; } };
      }
      return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) };
    },
  } as any;
}

Deno.test("recomputeVipForUser sets VIP", async () => {
  const supa = memorySupa();
  supa.bot_users["1"] = { telegram_id: "1", is_vip: false };
  Deno.env.set("TELEGRAM_BOT_TOKEN", "t");
  Deno.env.set("VIP_CHANNELS", "-1001");
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ ok: true, result: { status: "member" } }));
  try {
    const res = await recomputeVipForUser("1", supa);
    assert(res?.is_vip);
    assert(supa.channel_memberships["1:-1001"].is_active);
  } finally {
    globalThis.fetch = oldFetch;
    Deno.env.delete("TELEGRAM_BOT_TOKEN");
    Deno.env.delete("VIP_CHANNELS");
  }
});
