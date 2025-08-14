import { assertEquals, assertMatch } from "https://deno.land/std@0.224.0/testing/asserts.ts";

const supaState = { tables: {} as Record<string, any[]> };
(globalThis as any).__SUPA_MOCK__ = supaState;

function setEnv() {
  Deno.env.set("TELEGRAM_BOT_TOKEN", "testtoken");
  Deno.env.set("MINI_APP_URL", "https://example.com/app");
  Deno.env.set("TELEGRAM_WEBHOOK_SECRET", "testsecret");
  Deno.env.set("SUPABASE_URL", "http://local");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "svc");
}

function cleanup() {
  Deno.env.delete("TELEGRAM_BOT_TOKEN");
  Deno.env.delete("MINI_APP_URL");
  Deno.env.delete("TELEGRAM_WEBHOOK_SECRET");
  Deno.env.delete("SUPABASE_URL");
  Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
  supaState.tables = {} as Record<string, any[]>;
}

Deno.test("/start shows menu buttons for new users", async () => {
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
    assertEquals(
      second.reply_markup.inline_keyboard[0][0].web_app.url,
      "https://example.com/app/",
    );
  } finally {
    globalThis.fetch = originalFetch;
    cleanup();
  }
});

Deno.test("/start shows packages/promos for returning users", async () => {
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
  }
});
