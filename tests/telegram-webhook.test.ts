import { assertEquals } from "https://deno.land/std@0.224.0/testing/asserts.ts";

Deno.test("webhook handles /start with params", async () => {
  Deno.env.set("TELEGRAM_BOT_TOKEN", "testtoken");
  Deno.env.set("MINI_APP_URL", "https://example.com/app");
  const calls: Array<{ url: string; body: string }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: Request | string | URL, init?: RequestInit) => {
    calls.push({ url: String(input), body: init?.body ? String(init.body) : "" });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };
  try {
    const mod = await import("../supabase/functions/telegram-webhook/index.ts");
    const req = new Request("https://example.com", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: { text: "/start deep", chat: { id: 1 } } }),
    });
    const res = await mod.handler(req);
    assertEquals(res.status, 200);
    assertEquals(calls.length, 1);
    assertEquals(calls[0].url, "https://api.telegram.org/bottesttoken/sendMessage");
    const payload = JSON.parse(calls[0].body);
    assertEquals(
      payload.reply_markup.inline_keyboard[0][0].web_app.url,
      "https://example.com/app/",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("webhook uses short name when URL absent", async () => {
  Deno.env.set("TELEGRAM_BOT_TOKEN", "testtoken");
  Deno.env.delete("MINI_APP_URL");
  Deno.env.set("MINI_APP_SHORT_NAME", "shorty");
  Deno.env.set("TELEGRAM_BOT_USERNAME", "mybot");
  const calls: Array<{ url: string; body: string }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: Request | string | URL, init?: RequestInit) => {
    calls.push({ url: String(input), body: init?.body ? String(init.body) : "" });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };
  try {
    const mod = await import("../supabase/functions/telegram-webhook/index.ts");
    const req = new Request("https://example.com", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: { text: "/start", chat: { id: 1 } } }),
    });
    const res = await mod.handler(req);
    assertEquals(res.status, 200);
    assertEquals(calls.length, 1);
    const payload = JSON.parse(calls[0].body);
    assertEquals(
      payload.reply_markup.inline_keyboard[0][0].web_app.url,
      "https://t.me/mybot/shorty",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("webhook falls back for invalid mini app url", async () => {
  Deno.env.set("TELEGRAM_BOT_TOKEN", "testtoken");
  Deno.env.set("MINI_APP_URL", "http://invalid-url");
  const calls: Array<{ url: string; body: string }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: Request | string | URL, init?: RequestInit) => {
    calls.push({ url: String(input), body: init?.body ? String(init.body) : "" });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };
  try {
    const mod = await import("../supabase/functions/telegram-webhook/index.ts");
    const req = new Request("https://example.com", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: { text: "/start", chat: { id: 1 } } }),
    });
    const res = await mod.handler(req);
    assertEquals(res.status, 200);
    assertEquals(calls.length, 1);
    const payload = JSON.parse(calls[0].body);
    assertEquals(payload.text, "Bot activated. Mini app is being configured. Please try again soon.");
    assertEquals(payload.chat_id, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
