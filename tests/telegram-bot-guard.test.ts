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

Deno.test("telegram-bot guard", async () => {
  setEnv();
  try {
    const mod = await import(`../supabase/functions/telegram-bot/index.ts?${Math.random()}`);

    const reqPost = new Request("https://example.com", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const resPost = await mod.serveWebhook(reqPost);
    assertEquals(resPost.status, 401);

    const verReq = new Request("https://example.com/version", { method: "GET" });
    const verRes = await mod.serveWebhook(verReq);
    assertEquals(verRes.status, 200);

    const getReq = new Request("https://example.com", { method: "GET" });
    const getRes = await mod.serveWebhook(getReq);
    assertEquals(getRes.status, 405);
  } finally {
    cleanup();
  }
});
