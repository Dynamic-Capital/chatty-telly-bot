import { assertEquals } from "https://deno.land/std@0.224.0/testing/asserts.ts";
import { setTestEnv, makeTelegramInitData } from "../supabase/functions/_tests/helpers.ts";
import { handler } from "../supabase/functions/verify-initdata/index.ts";

Deno.test("verify-initdata handler accepts valid payload", async () => {
  const token = "test-token";
  setTestEnv({ TELEGRAM_BOT_TOKEN: token });
  Deno.env.set("TELEGRAM_BOT_TOKEN", token);
  try {
    const initData = await makeTelegramInitData({ id: 123, username: "alice" }, token);
    const req = new Request("http://local/verify-initdata", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ initData }),
    });
    const res = await handler(req);
    assertEquals(res.status, 200);
    const json = await res.json();
    assertEquals(json, { ok: true });
  } finally {
    Deno.env.delete("TELEGRAM_BOT_TOKEN");
    delete (globalThis as any).__TEST_ENV__;
  }
});
