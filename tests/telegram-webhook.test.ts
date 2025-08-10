import { assertEquals } from "https://deno.land/std@0.224.0/testing/asserts.ts";

Deno.test("webhook handles /start with params", async () => {
  Deno.env.set("TELEGRAM_BOT_TOKEN", "testtoken");
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
      body: JSON.stringify({ message: { text: "/start@mybot deep", chat: { id: 1 } } }),
    });
    const res = await mod.handler(req);
    assertEquals(res.status, 200);
    assertEquals(calls.length, 1);
    assertEquals(calls[0].url, "https://api.telegram.org/bottesttoken/sendMessage");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
