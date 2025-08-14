import { assertEquals } from "https://deno.land/std@0.224.0/testing/asserts.ts";

function mockTelegram() {
  const calls: Array<{ url: string; body: string }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: Request | string | URL, init?: RequestInit) => {
    calls.push({ url: String(input), body: init?.body ? String(init.body) : "" });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };
  return { calls, restore: () => (globalThis.fetch = originalFetch) };
}

denoEnvCleanup();

denoTest("telegram webhook responds to /start", async () => {
  Deno.env.set("TELEGRAM_BOT_TOKEN", "testtoken");
  Deno.env.set(
    "MINI_APP_URL",
    "https://qeejuomcapbdlhnjqjcc.functions.supabase.co/miniapp",
  );
  Deno.env.set("TELEGRAM_WEBHOOK_SECRET", "testsecret");
  const { calls, restore } = mockTelegram();
  try {
    const mod = await import("../supabase/functions/telegram-webhook/index.ts");
    const body = await Deno.readTextFile(new URL("./fixtures/telegram-start.json", import.meta.url));
    const req = new Request("https://example.com", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": "testsecret",
      },
      body,
    });
    const res = await mod.handler(req);
    assertEquals(res.status, 200);
    assertEquals(calls.length, 1);
    const payload = JSON.parse(calls[0].body);
    assertEquals(payload.chat_id, 1);
  } finally {
    restore();
    cleanup();
  }
});

denoTest("telegram webhook rejects bad secret", async () => {
  Deno.env.set("TELEGRAM_WEBHOOK_SECRET", "correct");
  const { calls, restore } = mockTelegram();
  try {
    const mod = await import("../supabase/functions/telegram-webhook/index.ts");
    const body = await Deno.readTextFile(new URL("./fixtures/telegram-start.json", import.meta.url));
    const req = new Request("https://example.com", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": "wrong",
      },
      body,
    });
    const res = await mod.handler(req);
    assertEquals(res.status, 401);
    assertEquals(calls.length, 0);
  } finally {
    restore();
    cleanup();
  }
});

denoTest("telegram webhook handles malformed JSON", async () => {
  Deno.env.set("TELEGRAM_WEBHOOK_SECRET", "testsecret");
  const { restore } = mockTelegram();
  try {
    const mod = await import("../supabase/functions/telegram-webhook/index.ts");
    const req = new Request("https://example.com", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": "testsecret",
      },
      body: "{ bad",
    });
    const res = await mod.handler(req);
    assertEquals(res.status, 400);
  } finally {
    restore();
    cleanup();
  }
});

denoTest(
  "telegram webhook rejects missing secret header",
  async () => {
    Deno.env.set("TELEGRAM_WEBHOOK_SECRET", "correct");
    const { calls, restore } = mockTelegram();
    try {
      const mod = await import("../supabase/functions/telegram-webhook/index.ts");
      const body = await Deno.readTextFile(
        new URL("./fixtures/telegram-start.json", import.meta.url),
      );
      const req = new Request("https://example.com/telegram-bot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body,
      });
      const res = await mod.handler(req);
      assertEquals(res.status, 401);
      assertEquals(calls.length, 0);
    } finally {
      restore();
      cleanup();
    }
  },
);

denoTest("telegram webhook rejects GET requests", async () => {
  const { restore } = mockTelegram();
  try {
    const mod = await import("../supabase/functions/telegram-webhook/index.ts");
    const req = new Request("https://example.com/telegram-bot", {
      method: "GET",
    });
    const res = await mod.handler(req);
    assertEquals(res.status, 405);
  } finally {
    restore();
    cleanup();
  }
});

function cleanup() {
  Deno.env.delete("TELEGRAM_BOT_TOKEN");
  Deno.env.delete("MINI_APP_URL");
  Deno.env.delete("TELEGRAM_WEBHOOK_SECRET");
}

function denoEnvCleanup() {
  cleanup();
}

function denoTest(name: string, fn: () => Promise<void>) {
  Deno.test(name, fn);
}
