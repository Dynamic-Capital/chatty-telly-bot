import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { makeTelegramInitData } from "./helpers.ts";
import { handler } from "../miniapp-deposit/index.ts";

Deno.test("miniapp-deposit creates intent for valid amount", async () => {
  Deno.env.set("TELEGRAM_BOT_TOKEN", "test-token");
  const initData = await makeTelegramInitData({ id: 1 }, "test-token");
  const resp = await handler(new Request("http://localhost", {
    method: "POST",
    body: JSON.stringify({ initData, amount: 10 }),
  }));
  assertEquals(resp.status, 200);
  const data = await resp.json();
  assertEquals(typeof data.intent_id, "string");
});

Deno.test("miniapp-deposit rejects invalid amount", async () => {
  Deno.env.set("TELEGRAM_BOT_TOKEN", "test-token");
  const initData = await makeTelegramInitData({ id: 1 }, "test-token");
  const resp = await handler(new Request("http://localhost", {
    method: "POST",
    body: JSON.stringify({ initData, amount: 0 }),
  }));
  assertEquals(resp.status, 400);
});
