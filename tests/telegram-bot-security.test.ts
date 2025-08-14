import { assertEquals } from "https://deno.land/std@0.224.0/testing/asserts.ts";

const supaState = { tables: {} as Record<string, any[]> };
(globalThis as any).__SUPA_MOCK__ = supaState;

function setEnv() {
  Deno.env.set("TELEGRAM_BOT_TOKEN", "testtoken");
  Deno.env.set("TELEGRAM_WEBHOOK_SECRET", "topsecret");
  Deno.env.set("SUPABASE_URL", "http://local");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "svc");
  Deno.env.set("SUPABASE_ANON_KEY", "anon");
}

function cleanup() {
  Deno.env.delete("TELEGRAM_BOT_TOKEN");
  Deno.env.delete("TELEGRAM_WEBHOOK_SECRET");
  Deno.env.delete("SUPABASE_URL");
  Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
  Deno.env.delete("SUPABASE_ANON_KEY");
  supaState.tables = {} as Record<string, any[]>;
}

Deno.test("telegram-bot rejects missing secret", async () => {
  setEnv();
  const calls: Array<{ url: string; body: string }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: Request | string | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.startsWith("https://api.telegram.org")) {
      calls.push({ url, body: init?.body ? String(init.body) : "" });
    }
    return new Response("{}", { status: 200 });
  };
  try {
    supaState.tables = { abuse_bans: [], user_sessions: [], user_interactions: [] };
    const mod = await import(`../supabase/functions/telegram-bot/index.ts?${Math.random()}`);
    const req = new Request("https://example.com", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: { text: "/start", chat: { id: 1 } } }),
    });
    const res = await mod.serveWebhook(req);
    assertEquals(res.status, 401);
    assertEquals(calls.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
    cleanup();
  }
});

Deno.test("telegram-bot returns 405 for non-POST", async () => {
  setEnv();
  try {
    const mod = await import(`../supabase/functions/telegram-bot/index.ts?${Math.random()}`);
    const req = new Request("https://example.com", { method: "GET" });
    const res = await mod.serveWebhook(req);
    assertEquals(res.status, 405);
    const verReq = new Request("https://example.com/version", { method: "GET" });
    const verRes = await mod.serveWebhook(verReq);
    assertEquals(verRes.status, 200);
  } finally {
    cleanup();
  }
});
