import { assertEquals } from "https://deno.land/std@0.224.0/testing/asserts.ts";

const supaState: any = { tables: {} };
(globalThis as any).__SUPA_MOCK__ = supaState;

function setEnv() {
  Deno.env.set("TELEGRAM_BOT_TOKEN", "testtoken");
  Deno.env.set("TELEGRAM_WEBHOOK_SECRET", "testsecret");
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
  supaState.tables = {};
}

Deno.test("sendMiniAppOrBotOptions uses nav:plans callback", async () => {
  setEnv();
  supaState.tables = {
    kv_config: [{ key: "features:published", value: { data: { mini_app_enabled: false } } }],
  };
  const calls: Array<{ body: string }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: Request | string | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.startsWith("https://api.telegram.org")) {
      calls.push({ body: init?.body ? String(init.body) : "" });
      return new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }), { status: 200 });
    }
    return new Response("{}", { status: 200 });
  };
  try {
    const mod = await import(`../supabase/functions/telegram-bot/index.ts?${Math.random()}`);
    await mod.sendMiniAppOrBotOptions(1);
    const payload = JSON.parse(calls[0].body);
    assertEquals(payload.reply_markup.inline_keyboard[0][0].callback_data, "nav:plans");
  } finally {
    globalThis.fetch = originalFetch;
    cleanup();
  }
});
