import { assertEquals, assert } from "https://deno.land/std@0.224.0/testing/asserts.ts";

async function setConfig(key: string, val: unknown) {
  const mod = await import("../supabase/functions/_shared/config.ts");
  await mod.setConfig(key, val);
}

Deno.test("webhook handles /start with params", async () => {
  Deno.env.set("TELEGRAM_BOT_TOKEN", "testtoken");
  Deno.env.set(
    "MINI_APP_URL",
    "https://qeejuomcapbdlhnjqjcc.functions.supabase.co/miniapp",
  );
  Deno.env.set("TELEGRAM_WEBHOOK_SECRET", "testsecret");
  Deno.env.set("SUPABASE_URL", "http://local");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "svc");
  Deno.env.set("SUPABASE_ANON_KEY", "anon");
  const calls: Array<{ url: string; body: string }> = [];
  const logs: string[] = [];
  const originalFetch = globalThis.fetch;
  const origLog = console.log;
  globalThis.fetch = async (input: Request | string | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.startsWith("https://api.telegram.org")) {
      calls.push({ url, body: init?.body ? String(init.body) : "" });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    return new Response("{}", { status: 200 });
  };
  console.log = (...args: unknown[]) => logs.push(args.join(" "));
  try {
    await setConfig("features:published", { ts: Date.now(), data: { mini_app_enabled: true } });
    const mod = await import("../supabase/functions/telegram-webhook/index.ts");
    const req = new Request("https://example.com", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": "testsecret",
      },
      body: JSON.stringify({ message: { text: "/start deep", chat: { id: 1 } } }),
    });
    const res = await mod.handler(req);
    assertEquals(res.status, 200);
    assertEquals(calls.length, 1);
    assertEquals(calls[0].url, "https://api.telegram.org/bottesttoken/sendMessage");
    const payload = JSON.parse(calls[0].body);
    assertEquals(
      payload.reply_markup.inline_keyboard[0][0].web_app.url,
      "https://qeejuomcapbdlhnjqjcc.functions.supabase.co/miniapp/",
    );
    assert(logs.every((l) => !l.includes(" 400")), "no 400 logs");
  } finally {
    globalThis.fetch = originalFetch;
    console.log = origLog;
    await setConfig("features:published", { ts: Date.now(), data: { mini_app_enabled: false } });
    Deno.env.delete("SUPABASE_URL");
    Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
    Deno.env.delete("SUPABASE_ANON_KEY");
  }
});

Deno.test("webhook warns when launch info missing", async () => {
  Deno.env.set("TELEGRAM_BOT_TOKEN", "testtoken");
  Deno.env.delete("MINI_APP_URL");
  Deno.env.delete("MINI_APP_SHORT_NAME");
  Deno.env.set("TELEGRAM_BOT_USERNAME", "mybot");
  Deno.env.set("TELEGRAM_WEBHOOK_SECRET", "testsecret");
  Deno.env.set("SUPABASE_URL", "http://local");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "svc");
  Deno.env.set("SUPABASE_ANON_KEY", "anon");
  const calls: Array<{ url: string; body: string }> = [];
  const logs: string[] = [];
  const originalFetch = globalThis.fetch;
  const origLog = console.log;
  globalThis.fetch = async (input: Request | string | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.startsWith("https://api.telegram.org")) {
      calls.push({ url, body: init?.body ? String(init.body) : "" });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    return new Response("{}", { status: 200 });
  };
  console.log = (...args: unknown[]) => logs.push(args.join(" "));
  try {
    await setConfig("features:published", { ts: Date.now(), data: { mini_app_enabled: true } });
    const mod = await import("../supabase/functions/telegram-webhook/index.ts");
    const req = new Request("https://example.com", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": "testsecret",
      },
      body: JSON.stringify({ message: { text: "/start", chat: { id: 1 } } }),
    });
    const res = await mod.handler(req);
    assertEquals(res.status, 200);
    assertEquals(calls.length, 1);
    const payload = JSON.parse(calls[0].body);
    assertEquals(
      payload.text,
      "Bot activated. Mini app is being configured. Please try again soon.",
    );
    assertEquals(payload.reply_markup, undefined);
    assert(logs.every((l) => !l.includes(" 400")), "no 400 logs");
  } finally {
    globalThis.fetch = originalFetch;
    console.log = origLog;
    await setConfig("features:published", { ts: Date.now(), data: { mini_app_enabled: false } });
    Deno.env.delete("SUPABASE_URL");
    Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
    Deno.env.delete("SUPABASE_ANON_KEY");
  }
});

Deno.test("webhook uses short name when URL absent", async () => {
  Deno.env.set("TELEGRAM_BOT_TOKEN", "testtoken");
  Deno.env.delete("MINI_APP_URL");
  Deno.env.set("MINI_APP_SHORT_NAME", "shorty");
  Deno.env.set("TELEGRAM_BOT_USERNAME", "mybot");
  Deno.env.set("TELEGRAM_WEBHOOK_SECRET", "testsecret");
  Deno.env.set("SUPABASE_URL", "http://local");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "svc");
  Deno.env.set("SUPABASE_ANON_KEY", "anon");
  const calls: Array<{ url: string; body: string }> = [];
  const logs: string[] = [];
  const originalFetch = globalThis.fetch;
  const origLog = console.log;
  globalThis.fetch = async (input: Request | string | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.startsWith("https://api.telegram.org")) {
      calls.push({ url, body: init?.body ? String(init.body) : "" });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    return new Response("{}", { status: 200 });
  };
  console.log = (...args: unknown[]) => logs.push(args.join(" "));
  try {
    await setConfig("features:published", { ts: Date.now(), data: { mini_app_enabled: true } });
    const mod = await import("../supabase/functions/telegram-webhook/index.ts");
    const req = new Request("https://example.com", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": "testsecret",
      },
      body: JSON.stringify({ message: { text: "/start", chat: { id: 1 } } }),
    });
    const res = await mod.handler(req);
    assertEquals(res.status, 200);
    const payload = JSON.parse(calls[0].body);
    const btn = payload.reply_markup.inline_keyboard[0][0];
    assertEquals(btn.url, "https://t.me/mybot/shorty");
    assertEquals(btn.web_app, undefined);
    assert(logs.every((l) => !l.includes(" 400")), "no 400 logs");
  } finally {
    globalThis.fetch = originalFetch;
    console.log = origLog;
    await setConfig("features:published", { ts: Date.now(), data: { mini_app_enabled: false } });
    Deno.env.delete("SUPABASE_URL");
    Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
    Deno.env.delete("SUPABASE_ANON_KEY");
    Deno.env.delete("MINI_APP_SHORT_NAME");
    Deno.env.delete("TELEGRAM_BOT_USERNAME");
  }
});

Deno.test("webhook falls back for invalid mini app url", async () => {
  Deno.env.set("TELEGRAM_BOT_TOKEN", "testtoken");
  Deno.env.set("MINI_APP_URL", "http://invalid-url");
  Deno.env.delete("MINI_APP_SHORT_NAME");
  Deno.env.delete("TELEGRAM_BOT_USERNAME");
  Deno.env.set("TELEGRAM_WEBHOOK_SECRET", "testsecret");
  Deno.env.set("SUPABASE_URL", "http://local");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "svc");
  Deno.env.set("SUPABASE_ANON_KEY", "anon");
  const calls: Array<{ url: string; body: string }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: Request | string | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.startsWith("https://api.telegram.org")) {
      calls.push({ url, body: init?.body ? String(init.body) : "" });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    return new Response("{}", { status: 200 });
  };
  try {
    await setConfig("features:published", { ts: Date.now(), data: { mini_app_enabled: true } });
    const mod = await import("../supabase/functions/telegram-webhook/index.ts");
    const req = new Request("https://example.com", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": "testsecret",
      },
      body: JSON.stringify({ message: { text: "/start", chat: { id: 1 } } }),
    });
    const res = await mod.handler(req);
    assertEquals(res.status, 200);
    assertEquals(calls.length, 1);
    const payload = JSON.parse(calls[0].body);
    assertEquals(payload.text, "Bot activated. Mini app is being configured. Please try again soon.");
    assertEquals(payload.reply_markup, undefined);
  } finally {
    globalThis.fetch = originalFetch;
    await setConfig("features:published", { ts: Date.now(), data: { mini_app_enabled: false } });
    Deno.env.delete("SUPABASE_URL");
    Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
    Deno.env.delete("SUPABASE_ANON_KEY");
  }
});
