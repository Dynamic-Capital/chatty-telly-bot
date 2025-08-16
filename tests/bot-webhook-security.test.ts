import { assertEquals } from "https://deno.land/std@0.224.0/testing/asserts.ts";

async function loadHandler() {
  const mod = await import("../supabase/functions/telegram-webhook/index.ts");
  return mod.handler as (req: Request) => Promise<Response>;
}

function setSecret(secret: string) {
  Deno.env.set("TELEGRAM_WEBHOOK_SECRET", secret);
}

function clearSecret() {
  Deno.env.delete("TELEGRAM_WEBHOOK_SECRET");
}

Deno.test("bot webhook rejects missing secret", async () => {
  setSecret("testsecret");
  try {
    const handler = await loadHandler();
    const req = new Request("https://example.com/telegram-bot", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    const res = await handler(req);
    assertEquals(res.status, 401);
  } finally {
    clearSecret();
  }
});

Deno.test("bot webhook rejects wrong secret", async () => {
  setSecret("correct");
  try {
    const handler = await loadHandler();
    const req = new Request("https://example.com/telegram-bot", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": "wrong",
      },
      body: "{}",
    });
    const res = await handler(req);
    assertEquals(res.status, 401);
  } finally {
    clearSecret();
  }
});

Deno.test("bot webhook accepts correct secret", async () => {
  setSecret("right");
  try {
    const handler = await loadHandler();
    const req = new Request("https://example.com/telegram-bot", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": "right",
      },
      body: "{}",
    });
    const res = await handler(req);
    assertEquals(res.status, 200);
  } finally {
    clearSecret();
  }
});
