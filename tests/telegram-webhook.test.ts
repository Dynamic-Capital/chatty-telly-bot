import { assert, assertEquals } from "https://deno.land/std@0.224.0/testing/asserts.ts";

Deno.test({
  name: "webhook handles /start with params",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  Deno.env.set("TELEGRAM_BOT_TOKEN", "testtoken");
  Deno.env.set("MINI_APP_URL", "https://example.com/app");
  Deno.env.set("TELEGRAM_WEBHOOK_SECRET", "test-secret");
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
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": "test-secret",
      },
      body: JSON.stringify({ message: { text: "/start deep", chat: { id: 1 } } }),
    });
    const res = await mod.handler(req);
    assertEquals(res.status, 200);
    const send = calls.find((c) => c.url.includes("api.telegram.org/bottesttoken/sendMessage"));
    assert(send);
    const payload = JSON.parse(send!.body);
    assertEquals(
      payload.reply_markup.inline_keyboard[0][0].web_app.url,
      "https://example.com/app/",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
