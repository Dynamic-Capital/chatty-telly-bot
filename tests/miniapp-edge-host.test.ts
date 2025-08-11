import { assert } from "https://deno.land/std@0.224.0/testing/asserts.ts";

Deno.test("useTelegram hook uses shared functionUrl helper", async () => {
  const text = await Deno.readTextFile("apps/mini/src/hooks/useTelegram.ts");
  assert(!text.includes("functions.supabase.co"), "hard-coded host found");
  assert(text.includes("functionUrl("), "functionUrl helper missing");
});
