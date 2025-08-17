import { assertEquals } from "https://deno.land/std@0.224.0/testing/asserts.ts";

Deno.test("envOrSetting prefers env over bot_setting", async () => {
  Deno.env.set("SUPABASE_URL", "https://example.com");
  Deno.env.set("SUPABASE_ANON_KEY", "anon");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service");
  const cfg = await import("../supabase/functions/_shared/config.ts");
  Deno.env.set("EXAMPLE_KEY", "env-value");
  const original = cfg.getSetting;
  cfg.__setGetSetting((async () => "db-value") as typeof cfg.getSetting);
  const val = await cfg.envOrSetting("EXAMPLE_KEY", "EXAMPLE_KEY");
  assertEquals(val, "env-value");
  cfg.__setGetSetting(original);
  Deno.env.delete("EXAMPLE_KEY");
});
