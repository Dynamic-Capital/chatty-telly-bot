import { assertEquals } from "https://deno.land/std@0.224.0/testing/asserts.ts";

const supaState = { tables: {} as Record<string, any[]> };
(globalThis as any).__SUPA_MOCK__ = supaState;

function setEnv() {
  Deno.env.set("TELEGRAM_BOT_TOKEN", "testtoken");
  Deno.env.set("TELEGRAM_WEBHOOK_SECRET", "testsecret");
  Deno.env.set("SUPABASE_URL", "http://local");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "svc");
  Deno.env.set("TELEGRAM_BOT_USERNAME", "mybot");
}

function cleanup() {
  Deno.env.delete("TELEGRAM_BOT_TOKEN");
  Deno.env.delete("TELEGRAM_WEBHOOK_SECRET");
  Deno.env.delete("SUPABASE_URL");
  Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
  Deno.env.delete("TELEGRAM_BOT_USERNAME");
  supaState.tables = {} as Record<string, any[]>;
}

Deno.test("group photo ignored when bot not mentioned", async () => {
  setEnv();
  const calls: Array<{ url: string; body: string }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (
    input: Request | string | URL,
    init?: RequestInit,
  ) => {
    const url = String(input);
    if (url.startsWith("https://api.telegram.org")) {
      calls.push({ url, body: init?.body ? String(init.body) : "" });
    }
    return new Response("{}", { status: 200 });
  };
  try {
    supaState.tables = {
      abuse_bans: [],
      user_sessions: [],
      user_interactions: [],
    };
    const mod = await import(
      `../supabase/functions/telegram-bot/index.ts?${Math.random()}`
    );
    const req = new Request("https://example.com", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": "testsecret",
      },
      body: JSON.stringify({
        message: {
          chat: { id: 1, type: "group" },
          photo: [{ file_id: "file_1" }],
        },
      }),
    });
    const res = await mod.serveWebhook(req);
    assertEquals(res.status, 200);
    await new Promise((r) => setTimeout(r, 0));
    assertEquals(calls.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
    cleanup();
  }
});

Deno.test("group photo processed when bot mentioned", async () => {
  setEnv();
  const calls: Array<{ url: string; body: string }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (
    input: Request | string | URL,
    init?: RequestInit,
  ) => {
    const url = String(input);
    if (url.startsWith("https://api.telegram.org")) {
      calls.push({ url, body: init?.body ? String(init.body) : "" });
    }
    return new Response("{}", { status: 200 });
  };
  try {
    supaState.tables = {
      abuse_bans: [],
      user_sessions: [],
      user_interactions: [],
    };
    const mod = await import(
      `../supabase/functions/telegram-bot/index.ts?${Math.random()}`
    );
    const req = new Request("https://example.com", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": "testsecret",
      },
      body: JSON.stringify({
        message: {
          chat: { id: 1, type: "group" },
          photo: [{ file_id: "file_1" }],
          caption: "hello @mybot",
        },
      }),
    });
    const res = await mod.serveWebhook(req);
    assertEquals(res.status, 200);
    await new Promise((r) => setTimeout(r, 0));
    assertEquals(calls.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
    cleanup();
  }
});

Deno.test("group photo processed when replying to bot", async () => {
  setEnv();
  const calls: Array<{ url: string; body: string }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (
    input: Request | string | URL,
    init?: RequestInit,
  ) => {
    const url = String(input);
    if (url.startsWith("https://api.telegram.org")) {
      calls.push({ url, body: init?.body ? String(init.body) : "" });
    }
    return new Response("{}", { status: 200 });
  };
  try {
    supaState.tables = {
      abuse_bans: [],
      user_sessions: [],
      user_interactions: [],
    };
    const mod = await import(
      `../supabase/functions/telegram-bot/index.ts?${Math.random()}`
    );
    const req = new Request("https://example.com", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": "testsecret",
      },
      body: JSON.stringify({
        message: {
          chat: { id: 1, type: "group" },
          photo: [{ file_id: "file_1" }],
          reply_to_message: { from: { username: "mybot" } },
        },
      }),
    });
    const res = await mod.serveWebhook(req);
    assertEquals(res.status, 200);
    await new Promise((r) => setTimeout(r, 0));
    assertEquals(calls.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
    cleanup();
  }
});
