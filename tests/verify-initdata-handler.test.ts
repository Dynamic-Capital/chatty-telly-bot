import { assertEquals } from "https://deno.land/std@0.224.0/testing/asserts.ts";
import { setTestEnv, makeTelegramInitData } from "../supabase/functions/_tests/helpers.ts";
import { handler } from "../supabase/functions/verify-initdata/index.ts";

Deno.test("verify-initdata handler accepts valid payload", async () => {
  setTestEnv({ TELEGRAM_BOT_TOKEN: "test-token" });
  const initData = await makeTelegramInitData({ id: 123, username: "alice" }, "test-token");
  const req = new Request("http://local/verify-initdata", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ initData }),
  });
  const res = await handler(req);
  assertEquals(res.status, 200);
  const json = await res.json();
  assertEquals(json, { ok: true });
});
