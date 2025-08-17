import { assertEquals } from "https://deno.land/std@0.224.0/testing/asserts.ts";
import { setTestEnv, clearTestEnv } from "./env-mock.ts";

Deno.test("telegram-bot rejects requests without secret", async () => {
  setTestEnv({
    TELEGRAM_WEBHOOK_SECRET: "s3cr3t",
    SUPABASE_URL: "https://example.com",
    SUPABASE_SERVICE_ROLE_KEY: "srv",
    TELEGRAM_BOT_TOKEN: "token",
    MINI_APP_URL: "https://example.com/",
  });
  const { default: handler } = await import("../telegram-bot/index.ts");
  const req = new Request("https://example.com/telegram-bot", {
    method: "POST",
    body: "{}",
  });
  const res = await handler(req);
  assertEquals(res.status, 401);
  clearTestEnv();
});

Deno.test("telegram-bot accepts valid secret", async () => {
  setTestEnv({
    TELEGRAM_WEBHOOK_SECRET: "s3cr3t",
    SUPABASE_URL: "https://example.com",
    SUPABASE_SERVICE_ROLE_KEY: "srv",
    TELEGRAM_BOT_TOKEN: "token",
    MINI_APP_URL: "https://example.com/",
  });
  const { default: handler } = await import("../telegram-bot/index.ts");
  const req = new Request("https://example.com/telegram-bot", {
    method: "POST",
    headers: { "x-telegram-bot-api-secret-token": "s3cr3t" },
    body: JSON.stringify({ test: "ping" }),
  });
  const res = await handler(req);
  assertEquals(res.status, 200);
  const json = await res.json();
  assertEquals(json.pong, true);
  clearTestEnv();
});

Deno.test("telegram-bot /version endpoint", async () => {
  const { default: handler } = await import("../telegram-bot/index.ts");
  const req = new Request("https://example.com/version", { method: "GET" });
  const res = await handler(req);
  assertEquals(res.status, 200);
  const json = await res.json();
  assertEquals(json.name, "telegram-bot");
});
