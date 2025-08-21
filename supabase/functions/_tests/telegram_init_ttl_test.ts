import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.env.set("MINI_APP_URL", "https://example.com");
const { clampTtl, MAX_TTL } = await import("../auth/telegram-init/index.ts");

Deno.test("clampTtl limits ttl", () => {
  assertEquals(clampTtl(30), 30);
  assertEquals(clampTtl(MAX_TTL * 10), MAX_TTL);
});
