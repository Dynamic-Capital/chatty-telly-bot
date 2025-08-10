// @ts-nocheck: cross-runtime test uses dynamic imports
let registerTest;
let assertEquals;
let assertRejects;
if (typeof Deno !== "undefined") {
  registerTest = (name, fn) => Deno.test(name, fn);
  const asserts = await import(
    "https://deno.land/std@0.224.0/testing/asserts.ts"
  );
  assertEquals = asserts.assertEquals;
  assertRejects = asserts.assertRejects;
} else {
  const { test } = await import("node:test");
  registerTest = (name, fn) => test(name, { concurrency: false }, fn);
  const assert = (await import("node:assert")).strict;
  assertEquals = (a, b, msg) => assert.equal(a, b, msg);
  assertRejects = assert.rejects;
}

import { circuit } from "../src/utils/circuit.ts";

registerTest("cooldown starts at failure time", async () => {
  const originalNow = Date.now;
  let t = 0;
  // stub Date.now
  Date.now = () => t;
  try {
    const breaker = circuit(1, 100);
    const failing = async () => {
      t = 50; // time passes before failure
      throw new Error("fail");
    };
    await assertRejects(() => breaker.run(failing));
    t = 120; // 70ms after failure but 120ms after start
    let ran = false;
    await assertRejects(
      () =>
        breaker.run(async () => {
          ran = true;
        }),
      Error,
    );
    assertEquals(ran, false);
  } finally {
    Date.now = originalNow;
  }
});
