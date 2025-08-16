import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { FakeSupa } from "./helpers.ts";

Deno.test("miniapp-health: null when user not found", async () => {
  Deno.env.set("SUPABASE_URL", "https://example.com");
  Deno.env.set("SUPABASE_ANON_KEY", "anon");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service");
  const { getVipForTelegram } = await import("../miniapp-health/index.ts");
  const supa = FakeSupa() as any;
  const vip = await getVipForTelegram(supa, "2255");
  assertEquals(vip, null);
});
