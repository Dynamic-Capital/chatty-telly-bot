// @ts-nocheck: cross-runtime test uses dynamic imports
let registerTest;
let assertEquals;
if (typeof Deno !== "undefined") {
  registerTest = Deno.test;
  ({ assertEquals } = await import("https://deno.land/std@0.224.0/testing/asserts.ts"));
} else {
  const { test } = await import("node:test");
  registerTest = test;
  const assert = (await import("node:assert")).strict;
  assertEquals = (a, b, msg) => assert.equal(a, b, msg);
}

import { setTestEnv, clearTestEnv } from "../supabase/functions/_tests/env-mock.ts";
import { requireEnv } from "../supabase/functions/telegram-bot/helpers/require-env.ts";

registerTest("requireEnv reports missing keys", () => {
  setTestEnv({ TELEGRAM_BOT_TOKEN: "token" });
  const result = requireEnv(["TELEGRAM_BOT_TOKEN", "OPENAI_API_KEY"]);
  assertEquals(result.ok, false);
  assertEquals(result.missing, ["OPENAI_API_KEY"]);
  clearTestEnv();
});

registerTest("requireEnv confirms all keys present", () => {
  setTestEnv({ TELEGRAM_BOT_TOKEN: "token", OPENAI_API_KEY: "openai" });
  const result = requireEnv(["TELEGRAM_BOT_TOKEN", "OPENAI_API_KEY"]);
  assertEquals(result.ok, true);
  assertEquals(result.missing.length, 0);
  clearTestEnv();
});

