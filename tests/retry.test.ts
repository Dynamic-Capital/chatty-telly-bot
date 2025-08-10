// @ts-nocheck: cross-runtime test uses dynamic imports
let registerTest;
let assertEquals;
let assertRejects;
if (typeof Deno !== "undefined") {
  registerTest = Deno.test;
  const asserts = await import(
    "https://deno.land/std@0.224.0/testing/asserts.ts"
  );
  assertEquals = asserts.assertEquals;
  assertRejects = asserts.assertRejects;
} else {
  const { test } = await import("node:test");
  registerTest = test;
  const assert = (await import("node:assert")).strict;
  assertEquals = (a, b, msg) => assert.equal(a, b, msg);
  assertRejects = assert.rejects;
}

import { withRetry } from "../src/utils/retry.ts";

registerTest("withRetry retries with exponential backoff", async () => {
  const originalRandom = Math.random;
  const originalSetTimeout = globalThis.setTimeout;
  Math.random = () => 0; // eliminate jitter
  const delays = [];
  globalThis.setTimeout = (cb, ms) => {
    delays.push(ms);
    cb();
    return 0;
  };

  let attempts = 0;
  const failing = () => {
    attempts++;
    return Promise.reject(new Error("fail"));
  };

  await assertRejects(() => withRetry(failing, 3));
  assertEquals(attempts, 3);
  assertEquals(delays, [250, 500, 1000]);

  Math.random = originalRandom;
  globalThis.setTimeout = originalSetTimeout;
});

registerTest("withRetry resolves after eventual success", async () => {
  const originalRandom = Math.random;
  const originalSetTimeout = globalThis.setTimeout;
  Math.random = () => 0;
  const delays = [];
  globalThis.setTimeout = (cb, ms) => {
    delays.push(ms);
    cb();
    return 0;
  };

  let attempts = 0;
  const sometimesFails = () => {
    attempts++;
    if (attempts < 3) return Promise.reject(new Error("no"));
    return Promise.resolve("ok");
  };

  const result = await withRetry(sometimesFails, 5);
  assertEquals(result, "ok");
  assertEquals(attempts, 3);
  assertEquals(delays, [250, 500]);

  Math.random = originalRandom;
  globalThis.setTimeout = originalSetTimeout;
});
