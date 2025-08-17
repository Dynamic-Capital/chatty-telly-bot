import { assertEquals, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { FakeSupa } from "./helpers.ts";
import { requireMiniAppEnv } from "../telegram-bot/helpers/require-env.ts";

Deno.test("miniapp-health: null when user not found", async () => {
  Deno.env.set("SUPABASE_URL", "https://example.com");
  Deno.env.set("SUPABASE_ANON_KEY", "anon");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service");
  const { getVipForTelegram } = await import("../miniapp-health/index.ts");
  type SupabaseLike = Parameters<typeof getVipForTelegram>[0];
  const supa = FakeSupa() as unknown as SupabaseLike;
  const vip = await getVipForTelegram(supa, "2255");
  assertEquals(vip, null);
});

Deno.test("requireMiniAppEnv: throws when both MINI_APP_URL and MINI_APP_SHORT_NAME missing", () => {
  Deno.env.delete("MINI_APP_URL");
  Deno.env.delete("MINI_APP_SHORT_NAME");
  assertThrows(() => requireMiniAppEnv());
});

Deno.test("requireMiniAppEnv: passes when MINI_APP_URL set", () => {
  Deno.env.set("MINI_APP_URL", "https://example.com/");
  Deno.env.delete("MINI_APP_SHORT_NAME");
  requireMiniAppEnv();
  Deno.env.delete("MINI_APP_URL");
});

Deno.test("requireMiniAppEnv: passes when MINI_APP_SHORT_NAME set", () => {
  Deno.env.delete("MINI_APP_URL");
  Deno.env.set("MINI_APP_SHORT_NAME", "short");
  requireMiniAppEnv();
  Deno.env.delete("MINI_APP_SHORT_NAME");
});
