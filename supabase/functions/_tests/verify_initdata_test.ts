import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { setTestEnv, makeTelegramInitData } from "./helpers.ts";
import { verifyFromRaw } from "../verify-initdata/index.ts";

  Deno.test("verify-initdata: accepts valid signature", async () => {
    setTestEnv({ TELEGRAM_BOT_TOKEN: "test-token" });
    const initData = await makeTelegramInitData({ id: 123, username: "alice" }, "test-token");
    const ok = await verifyFromRaw(initData, "test-token", 900);
    assert(ok);
  });

  Deno.test("verify-initdata: rejects bad signature", async () => {
    setTestEnv({ TELEGRAM_BOT_TOKEN: "test-token" });
    const initData = await makeTelegramInitData({ id: 123 }, "other-token");
    const ok = await verifyFromRaw(initData, "test-token", 900);
    assertEquals(ok, false);
  });
