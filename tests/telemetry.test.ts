// @ts-nocheck: cross-runtime test uses dynamic imports
let registerTest;
let assertEquals;
if (typeof Deno !== "undefined") {
  registerTest = Deno.test;
  ({ assertEquals } = await import("https://deno.land/std@0.224.0/testing/asserts.ts"));
} else {
  const { test } = await import("node:test");
  registerTest = test;
  const assert = (await import("node:assert")).strict;
  assertEquals = (a, b, msg) => assert.equal(a, b, msg);
}

import {
  handleEvent,
  setAlertSender,
  resetCounters,
  checkWebhookHealth,
} from "../src/telemetry/alerts.ts";

registerTest("error spike triggers single alert", async () => {
  resetCounters();
  const msgs: string[] = [];
  setAlertSender((msg) => {
    msgs.push(msg);
  });
  for (let i = 0; i < 12; i++) {
    handleEvent("error", {});
  }
  assertEquals(msgs.length, 1);
});

registerTest("webhook error alert is rate limited", async () => {
  resetCounters();
  const msgs: string[] = [];
  setAlertSender((msg) => {
    msgs.push(msg);
  });
  // mock fetch to return recent webhook error
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ result: { last_error_date: Math.floor(Date.now() / 1000) } }),
  }) as any;

  await checkWebhookHealth();
  await checkWebhookHealth();
  assertEquals(msgs.length, 1);
});
