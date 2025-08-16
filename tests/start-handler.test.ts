import {
  assert,
  assertEquals,
  assertMatch,
} from "https://deno.land/std@0.224.0/testing/asserts.ts";

async function setConfig(key: string, val: unknown) {
  const mod = await import("../supabase/functions/_shared/config.ts");
  await mod.setConfig(key, val);
}

const supaState = { tables: {} as Record<string, any[]> };
(globalThis as any).__SUPA_MOCK__ = supaState;

function setEnv() {
  Deno.env.set("TELEGRAM_BOT_TOKEN", "testtoken");
  Deno.env.set(
    "MINI_APP_URL",
    "https://qeejuomcapbdlhnjqjcc.functions.supabase.co/miniapp/",
  );
  Deno.env.set("TELEGRAM_WEBHOOK_SECRET", "testsecret");
  Deno.env.set("SUPABASE_URL", "http://local");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "svc");
  Deno.env.set("SUPABASE_ANON_KEY", "anon");
}

function cleanup() {
  Deno.env.delete("TELEGRAM_BOT_TOKEN");
  Deno.env.delete("MINI_APP_URL");
  Deno.env.delete("TELEGRAM_WEBHOOK_SECRET");
  Deno.env.delete("SUPABASE_URL");
  Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
  Deno.env.delete("SUPABASE_ANON_KEY");
  supaState.tables = {} as Record<string, any[]>;
}

Deno.test("/start shows menu buttons for new users", async () => {
  setEnv();
  // Provide URL without trailing slash to ensure normalization
  Deno.env.set(
    "MINI_APP_URL",
    "https://qeejuomcapbdlhnjqjcc.functions.supabase.co/miniapp",
  );
  await setConfig("features:published", { ts: Date.now(), data: { mini_app_enabled: true } });
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
  console.log = (...args: unknown[]) => {
    logs.push(args.join(" "));
  };
  try {
    supaState.tables = {
      bot_users: [],
      bot_content: [
        { content_key: "welcome_message", content_value: "Welcome new user", is_active: true },
      ],
    };
    const mod = await import(`../supabase/functions/telegram-bot/index.ts?${Math.random()}`);
    const req = new Request("https://example.com", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": "testsecret",
      },
      body: JSON.stringify({ message: { text: "/start", chat: { id: 1 }, from: { id: 1 } } }),
    });
    const res = await mod.serveWebhook(req);
    assertEquals(res.status, 200);
    const first = JSON.parse(calls[0].body);
    assertEquals(first.text, "Welcome new user");
    const second = JSON.parse(calls[1].body);
    assertEquals(second.text, "Welcome! Choose an option:");
    assertEquals(second.reply_markup.inline_keyboard[0][0].text, "✅ Home");
    assert(logs.every((l) => !l.includes(" 400")), "no 400 logs");
  } finally {
    globalThis.fetch = originalFetch;
    console.log = origLog;
    cleanup();
    await setConfig("features:published", { ts: Date.now(), data: { mini_app_enabled: false } });
  }
});

Deno.test("command registry routes /help", async () => {
  setEnv();
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
    supaState.tables = {
      bot_content: [
        { content_key: "help_message", content_value: "Helpful text", is_active: true },
      ],
    };
    const mod = await import(`../supabase/functions/telegram-bot/index.ts?${Math.random()}`);
    assert(mod.commandHandlers["/help"], "registry contains /help handler");
    const req = new Request("https://example.com", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": "testsecret",
      },
      body: JSON.stringify({ message: { text: "/help", chat: { id: 1 }, from: { id: 1 } } }),
    });
    const res = await mod.serveWebhook(req);
    assertEquals(res.status, 200);
    const first = JSON.parse(calls[0].body);
    assertEquals(first.text, "Helpful text");
  } finally {
    globalThis.fetch = originalFetch;
    cleanup();
  }
});

Deno.test("/start shows packages/promos for returning users", async () => {
  setEnv();
  await setConfig("features:published", { ts: Date.now(), data: { mini_app_enabled: true } });
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
    supaState.tables = {
      bot_users: [{ id: "u1", telegram_id: 1 }],
      bot_content: [
        { content_key: "welcome_back_message", content_value: "VIP Packages and promo info", is_active: true },
      ],
    };
    const mod = await import(`../supabase/functions/telegram-bot/index.ts?${Math.random()}`);
    const req = new Request("https://example.com", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": "testsecret",
      },
      body: JSON.stringify({ message: { text: "/start", chat: { id: 1 }, from: { id: 1 } } }),
    });
    const res = await mod.serveWebhook(req);
    assertEquals(res.status, 200);
    const first = JSON.parse(calls[0].body);
    assertMatch(first.text, /VIP Packages/);
    assertMatch(first.text, /promo/);
  } finally {
    globalThis.fetch = originalFetch;
    cleanup();
    await setConfig("features:published", { ts: Date.now(), data: { mini_app_enabled: false } });
  }
});

Deno.test("/start uses short name link when configured", async () => {
  setEnv();
  Deno.env.delete("MINI_APP_URL");
  Deno.env.set("MINI_APP_SHORT_NAME", "shorty");
  Deno.env.set("TELEGRAM_BOT_USERNAME", "mybot");
  await setConfig("features:published", { ts: Date.now(), data: { mini_app_enabled: true } });
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
    supaState.tables = {
      bot_users: [],
      bot_content: [
        { content_key: "welcome_message", content_value: "Welcome new user", is_active: true },
      ],
    };
    const mod = await import(`../supabase/functions/telegram-bot/index.ts?${Math.random()}`);
    const req = new Request("https://example.com", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": "testsecret",
      },
      body: JSON.stringify({ message: { text: "/start", chat: { id: 1 }, from: { id: 1 } } }),
    });
    const res = await mod.serveWebhook(req);
    assertEquals(res.status, 200);
    const second = JSON.parse(calls[1].body);
    const btn = second.reply_markup.inline_keyboard[0][0];
    assertEquals(btn.url, "https://t.me/mybot/shorty");
    assertEquals(btn.web_app, undefined);
    assert(logs.every((l) => !l.includes(" 400")), "no 400 logs");
  } finally {
    globalThis.fetch = originalFetch;
    console.log = origLog;
    cleanup();
    await setConfig("features:published", { ts: Date.now(), data: { mini_app_enabled: false } });
  }
});

Deno.test("/start warns when launch info missing", async () => {
  Deno.env.set("TELEGRAM_BOT_TOKEN", "testtoken");
  Deno.env.delete("MINI_APP_URL");
  Deno.env.delete("MINI_APP_SHORT_NAME");
  Deno.env.set("TELEGRAM_BOT_USERNAME", "mybot");
  Deno.env.set("TELEGRAM_WEBHOOK_SECRET", "testsecret");
  Deno.env.set("SUPABASE_URL", "http://local");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "svc");
  Deno.env.set("SUPABASE_ANON_KEY", "anon");
  await setConfig("features:published", { ts: Date.now(), data: { mini_app_enabled: true } });
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
    supaState.tables = {
      bot_users: [],
      bot_content: [
        { content_key: "welcome_message", content_value: "Welcome new user", is_active: true },
      ],
    };
    const mod = await import(`../supabase/functions/telegram-bot/index.ts?${Math.random()}`);
    const req = new Request("https://example.com", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": "testsecret",
      },
      body: JSON.stringify({ message: { text: "/start", chat: { id: 1 }, from: { id: 1 } } }),
    });
    const res = await mod.serveWebhook(req);
    assertEquals(res.status, 200);
    const first = JSON.parse(calls[0].body);
    assertEquals(first.text, "Welcome new user");
    const second = JSON.parse(calls[1].body);
    assertEquals(second.text, "Mini app is being configured. Please try again soon.");
    assertEquals(second.reply_markup, undefined);
    assert(logs.every((l) => !l.includes(" 400")), "no 400 logs");
  } finally {
    globalThis.fetch = originalFetch;
    console.log = origLog;
    cleanup();
    await setConfig("features:published", { ts: Date.now(), data: { mini_app_enabled: false } });
  }
});
