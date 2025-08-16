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
  const { setConfig } = await import(
    "../supabase/functions/_shared/config.ts"
  );
  await setConfig("features:published", {
    ts: Date.now(),
    data: { mini_app_enabled: false },
  });
  const { sendMiniAppLink } = await import(
    "../supabase/functions/telegram-bot/index.ts"
  );
  let text = "";
  const orig = globalThis.fetch;
  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(init?.body ?? "{}");
    text = body.text;
    return new Response(
      JSON.stringify({ ok: true, result: { message_id: 1 } }),
      { status: 200 },
    );
  };
  try {
    await sendMiniAppLink(123);
    assertEquals(
      text,
      "Checkout is currently unavailable. Please try again later.",
    );
  } finally {
    globalThis.fetch = orig;
    delete (globalThis as any).__TEST_ENV__;
  }
});

registerTest("mini app link available by default", async () => {
  if (typeof Deno !== "undefined") {
    Deno.env.set("TELEGRAM_BOT_TOKEN", "tbot");
    Deno.env.set("MINI_APP_URL", "https://example.com/app/");
  } else {
    process.env.TELEGRAM_BOT_TOKEN = "tbot";
    process.env.MINI_APP_URL = "https://example.com/app/";
  }
  (globalThis as any).__TEST_ENV__ = {
    SUPABASE_URL: "x",
    SUPABASE_ANON_KEY: "x",
    SUPABASE_SERVICE_ROLE_KEY: "x",
    MINI_APP_URL: "https://example.com/app/",
  };
  const { setConfig } = await import(
    "../supabase/functions/_shared/config.ts"
  );
  await setConfig("features:published", { ts: Date.now(), data: {} });
  const { sendMiniAppLink } = await import(
    "../supabase/functions/telegram-bot/index.ts"
  );
  let text = "";
  const orig = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.includes("sendMessage")) {
      const body = JSON.parse(init?.body ?? "{}");
      text = body.text;
      return new Response(
        JSON.stringify({ ok: true, result: { message_id: 1 } }),
        { status: 200 },
      );
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };
  try {
    await sendMiniAppLink(123);
    assertEquals(
      text.startsWith("Join the VIP Mini App"),
      true,
    );
  } finally {
    globalThis.fetch = orig;
    delete (globalThis as any).__TEST_ENV__;
    if (typeof Deno !== "undefined") {
      Deno.env.delete("MINI_APP_URL");
    } else {
      delete process.env.MINI_APP_URL;
    }
    await setConfig("features:published", {
      ts: Date.now(),
      data: { mini_app_enabled: false },
    });
  }
});

registerTest("mini app link warns when URL missing", async () => {
  if (typeof Deno !== "undefined") {
    Deno.env.set("TELEGRAM_BOT_TOKEN", "tbot");
    Deno.env.delete("MINI_APP_URL");
  } else {
    process.env.TELEGRAM_BOT_TOKEN = "tbot";
    delete process.env.MINI_APP_URL;
  }
  (globalThis as any).__TEST_ENV__ = {
    SUPABASE_URL: "x",
    SUPABASE_ANON_KEY: "x",
    SUPABASE_SERVICE_ROLE_KEY: "x",
  };
  const { setConfig } = await import(
    "../supabase/functions/_shared/config.ts"
  );
  await setConfig("features:published", { ts: Date.now(), data: {} });
  const { sendMiniAppLink } = await import(
    "../supabase/functions/telegram-bot/index.ts"
  );
  let text = "";
  const orig = globalThis.fetch;
  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(init?.body ?? "{}");
    text = body.text;
    return new Response(
      JSON.stringify({ ok: true, result: { message_id: 1 } }),
      { status: 200 },
    );
  };
  try {
    const url = await sendMiniAppLink(123);
    assertEquals(url, null);
    assertEquals(text.includes("MINI_APP_URL"), true);
  } finally {
    globalThis.fetch = orig;
    delete (globalThis as any).__TEST_ENV__;
    await setConfig("features:published", {
      ts: Date.now(),
      data: { mini_app_enabled: false },
    });
  }
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
  const { setConfig } = await import(
    "../supabase/functions/_shared/config.ts"
  );
  await setConfig("features:published", {
    ts: Date.now(),
    data: { vip_sync_enabled: false },
  });
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
  await setConfig("features:published", {
    ts: Date.now(),
    data: { vip_sync_enabled: true },
  });
});
