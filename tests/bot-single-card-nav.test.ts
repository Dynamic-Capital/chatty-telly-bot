import { assertEquals } from "https://deno.land/std@0.224.0/testing/asserts.ts";

const supaState: any = { tables: { } };
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

Deno.test("callback edits message instead of sending new one", async () => {
  setEnv();
  supaState.tables = {
    bot_users: [{ id: "u1", telegram_id: 1, menu_message_id: null }],
    subscription_plans: [{
      id: "p1",
      name: "Test Plan",
      price: 10,
      currency: "USD",
      duration_months: 1,
      is_lifetime: false,
      features: [],
    }],
  };
  const calls: Array<{ url: string; body: string }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: Request | string | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.startsWith("https://api.telegram.org")) {
      calls.push({ url, body: init?.body ? String(init.body) : "" });
      return new Response(JSON.stringify({ ok: true, result: { message_id: 42 } }), { status: 200 });
    }
    return new Response("{}", { status: 200 });
  };
  try {
    const mod = await import(`../supabase/functions/telegram-bot/index.ts?${Math.random()}`);
    const reqStart = new Request("https://example.com", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": "testsecret",
      },
      body: JSON.stringify({ message: { text: "/start", chat: { id: 1 }, from: { id: 1 } } }),
    });
    const resStart = await mod.serveWebhook(reqStart);
    assertEquals(resStart.status, 200);
    const first = JSON.parse(calls[0].body);
    assertEquals(first.chat_id, 1);
    assertEquals(first.reply_markup.inline_keyboard[0][0].callback_data, "nav:dashboard");

    const reqPlans = new Request("https://example.com", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": "testsecret",
      },
      body: JSON.stringify({ callback_query: { id: "cb1", from: { id: 1 }, data: "nav:plans", message: { chat: { id: 1 }, message_id: 42 } } }),
    });
    const resPlans = await mod.serveWebhook(reqPlans);
    assertEquals(resPlans.status, 200);
    assertEquals(calls[1].url.includes("answerCallbackQuery"), true);
    assertEquals(calls[2].body.includes('"message_id":42'), true);

    const reqDash = new Request("https://example.com", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": "testsecret",
      },
      body: JSON.stringify({ callback_query: { id: "cb2", from: { id: 1 }, data: "nav:dashboard", message: { chat: { id: 1 }, message_id: 42 } } }),
    });
    const resDash = await mod.serveWebhook(reqDash);
    assertEquals(resDash.status, 200);
    assertEquals(calls[3].url.includes("answerCallbackQuery"), true);
    assertEquals(calls[4].body.includes('"message_id":42'), true);

    assertEquals(calls.length, 5);
    assertEquals(calls[2].url.includes("editMessageText"), true);
    assertEquals(calls[4].url.includes("editMessageText"), true);
  } finally {
    globalThis.fetch = originalFetch;
    cleanup();
  }
});
