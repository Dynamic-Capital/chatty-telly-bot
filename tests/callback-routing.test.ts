import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("callback handlers route to correct functions", async () => {
  Deno.env.set("SUPABASE_URL", "https://example.supabase.co");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "servicekey");
  Deno.env.set("SUPABASE_ANON_KEY", "anonkey");
  Deno.env.set("TELEGRAM_BOT_TOKEN", "testtoken");

  const bot = await import("../supabase/functions/telegram-bot/index.ts");
  const calls: string[] = [];
  const stubHandlers = {
    handleFeatureFlags: async () => {
      calls.push("feature_flags");
    },
    handleAdminDashboard: async () => {
      calls.push("admin_dashboard");
    },
  } as any;

  const map = bot.buildCallbackHandlers(stubHandlers);
  await map.feature_flags(1, "u");
  assert(map.dashboard_packages === bot.handleDashboardPackages);
  assert(calls.includes("feature_flags"));

  const before = calls.length;
  const handler = map["unknown"] ?? bot.defaultCallbackHandler;
  await handler(1, "u");
  assertEquals(calls.length, before);
});
