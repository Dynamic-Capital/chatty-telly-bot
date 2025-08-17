// functions/_tests/webhook-secret.test.ts
// Test validation of x-telegram-bot-api-secret-token header for telegram-webhook.
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { setTestEnv, clearTestEnv } from "../../supabase/functions/_tests/env-mock.ts";

// Provide minimal environment so the handler module can load without reaching for
// real secrets or network resources.
setTestEnv({
  SUPABASE_URL: "http://local",
  SUPABASE_ANON_KEY: "anon",
  SUPABASE_SERVICE_ROLE_KEY: "service",
  TELEGRAM_BOT_TOKEN: "test-token",
  TELEGRAM_WEBHOOK_SECRET: "test-secret",
});

const mod = await import("../../supabase/functions/telegram-webhook/index.ts");
const handler: (req: Request) => Promise<Response> = mod.default ?? mod.handler;

Deno.test("accepts valid webhook secret", async () => {
  const req = new Request("http://local/telegram-webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-telegram-bot-api-secret-token": "test-secret",
    },
    body: "{}",
  });
  const res = await handler(req);
  assertEquals(res.status, 200);
});

Deno.test("rejects invalid webhook secret", async () => {
  const req = new Request("http://local/telegram-webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-telegram-bot-api-secret-token": "wrong-secret",
    },
    body: "{}",
  });
  const res = await handler(req);
  assertEquals(res.status, 401);
  clearTestEnv();
});
