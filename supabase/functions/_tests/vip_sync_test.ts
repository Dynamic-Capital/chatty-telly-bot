import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { setTestEnv, clearTestEnv } from "./env-mock.ts";

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
          select: () => ({ eq() { return this; }, maybeSingle() { return Promise.resolve({ data: null, error: null }); } }),
        };
      }
      if (table === "bot_users") {
        return {
          select: () => ({
            order() { return this; },
            limit(lim: number) {
              return { data: Object.values(users).slice(0, lim), error: null };
            },
            range(start: number, end: number) {
              return { data: Object.values(users).slice(start, end + 1), error: null };
            },
          }),
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

Deno.test("vip-sync version", async () => {
  const { default: handler } = await import("../vip-sync/index.ts");
  const res = await handler(new Request("https://example.com/vip-sync/version"));
  assertEquals(res.status, 200);
  const json = await res.json();
  assertEquals(json.name, "vip-sync");
});

