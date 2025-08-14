// @ts-nocheck: cross-runtime test uses dynamic imports
let registerTest, assertEquals;
if (typeof Deno !== "undefined") {
  registerTest = (name, fn) => Deno.test(name, fn);
  const asserts = await import("https://deno.land/std@0.224.0/testing/asserts.ts");
  assertEquals = asserts.assertEquals;
} else {
  const { test } = await import("node:test");
  registerTest = (name, fn) => test(name, { concurrency: false }, fn);
  const assert = (await import("node:assert")).strict;
  assertEquals = (a, b, msg) => assert.equal(a, b, msg);
}

import { setFlag, publish } from "../src/utils/config.ts";

registerTest("mini app flag blocks link", async () => {
  if (typeof Deno !== "undefined") {
    Deno.env.set("TELEGRAM_BOT_TOKEN", "tbot");
  } else {
    process.env.TELEGRAM_BOT_TOKEN = "tbot";
  }
  (globalThis as any).__TEST_ENV__ = {
    SUPABASE_URL: "x",
    SUPABASE_ANON_KEY: "x",
    SUPABASE_SERVICE_ROLE_KEY: "x",
  };
  await setFlag("mini_app_enabled", false);
  await publish();
  const { sendMiniAppLink } = await import(
    "../supabase/functions/telegram-bot/index.ts"
  );
  let called = false;
  const orig = globalThis.fetch;
  globalThis.fetch = async () => {
    called = true;
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };
  try {
    await sendMiniAppLink(123);
    assertEquals(called, false);
  } finally {
    globalThis.fetch = orig;
    delete (globalThis as any).__TEST_ENV__;
  }
  await setFlag("mini_app_enabled", true);
  await publish();
});

registerTest("vip sync flag blocks pipeline", async () => {
  if (typeof Deno !== "undefined") {
    Deno.env.set("TELEGRAM_BOT_TOKEN", "tbot");
  } else {
    process.env.TELEGRAM_BOT_TOKEN = "tbot";
  }
  (globalThis as any).__TEST_ENV__ = {
    SUPABASE_URL: "x",
    SUPABASE_ANON_KEY: "x",
    SUPABASE_SERVICE_ROLE_KEY: "x",
  };
  await setFlag("vip_sync_enabled", false);
  await publish();
  const { startReceiptPipeline } = await import(
    "../supabase/functions/telegram-bot/index.ts"
  );
  let text = "";
  const orig = globalThis.fetch;
  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(init?.body ?? "{}");
    text = body.text;
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };
  try {
    await startReceiptPipeline({ message: { chat: { id: 1 } } });
    assertEquals(text, "VIP sync is currently disabled.");
  } finally {
    globalThis.fetch = orig;
    delete (globalThis as any).__TEST_ENV__;
  }
  await setFlag("vip_sync_enabled", true);
  await publish();
});
