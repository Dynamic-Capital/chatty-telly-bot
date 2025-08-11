import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { FakeSupa } from "./helpers.ts";
import { getVipForTelegram } from "../miniapp-health/index.ts";

Deno.test("miniapp-health: null when user not found", async () => {
  const supa = FakeSupa();
  const vip = await getVipForTelegram(supa, "2255");
  assertEquals(vip, null);
});
