import {
  assert,
  assertFalse,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { setTestEnv, clearTestEnv } from "./env-mock.ts";

async function importBot() {
  // Bust module cache to allow different env per test
  return await import(`../telegram-bot/index.ts?cache=${crypto.randomUUID()}`);
}

Deno.test("start command includes Mini App button when env present", async () => {
  setTestEnv({
    SUPABASE_URL: "https://example.com",
    SUPABASE_ANON_KEY: "anon",
    SUPABASE_SERVICE_ROLE_KEY: "srv",
  });
  Deno.env.set("TELEGRAM_BOT_TOKEN", "token");
  Deno.env.set("TELEGRAM_BOT_USERNAME", "mybot");
  Deno.env.set("MINI_APP_URL", "https://mini.example.com/");

  const calls: { input: string; body: string }[] = [];
  const origFetch = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const body = typeof init?.body === "string"
      ? init.body
      : init?.body
      ? JSON.stringify(init.body)
      : "";
    calls.push({ input: String(input), body });
    return new Response("[]", { status: 200 });
  };

  const { commandHandlers } = await importBot();
  await commandHandlers["/start"]({ chatId: 1 });

  const sendCalls = calls.filter((c) => c.input.includes("/sendMessage"));
  const hasButton = sendCalls.some((c) =>
    c.body.includes("\"web_app\"") || c.body.includes("\"url\"")
  );
  assert(hasButton);

  globalThis.fetch = origFetch;
  clearTestEnv();
  Deno.env.delete("TELEGRAM_BOT_TOKEN");
  Deno.env.delete("TELEGRAM_BOT_USERNAME");
  Deno.env.delete("MINI_APP_URL");
});

Deno.test("start command omits Mini App button when env missing", async () => {
  setTestEnv({
    SUPABASE_URL: "https://example.com",
    SUPABASE_ANON_KEY: "anon",
    SUPABASE_SERVICE_ROLE_KEY: "srv",
  });
  Deno.env.set("TELEGRAM_BOT_TOKEN", "token");
  Deno.env.set("TELEGRAM_BOT_USERNAME", "mybot");

  const calls: { input: string; body: string }[] = [];
  const origFetch = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const body = typeof init?.body === "string"
      ? init.body
      : init?.body
      ? JSON.stringify(init.body)
      : "";
    calls.push({ input: String(input), body });
    return new Response("[]", { status: 200 });
  };

  const { commandHandlers } = await importBot();
  await commandHandlers["/start"]({ chatId: 1 });

  const sendCalls = calls.filter((c) => c.input.includes("/sendMessage"));
  const hasButton = sendCalls.some((c) =>
    c.body.includes("\"web_app\"") || c.body.includes("\"url\"")
  );
  assertFalse(hasButton);

  globalThis.fetch = origFetch;
  clearTestEnv();
  Deno.env.delete("TELEGRAM_BOT_TOKEN");
  Deno.env.delete("TELEGRAM_BOT_USERNAME");
});

