// @ts-nocheck: cross-runtime test uses dynamic imports
let registerTest, assertEquals;
if (typeof Deno !== "undefined") {
  registerTest = (name, fn) => Deno.test(name, fn);
  const asserts = await import("https://deno.land/std@0.224.0/testing/asserts.ts");
  assertEquals = asserts.assertEquals;
} else {
  const { test } = await import("node:test");
  registerTest = (name, fn) => test(name, { concurrency: false }, fn);
  const assert = (await import("node:assert")).strict;
  assertEquals = (a, b, m) => assert.equal(a, b, m);
}

import { dispatchAudience } from "../supabase/functions/broadcast-dispatch/index.ts";

registerTest("dispatch sends to all", async () => {
  const ids = [1, 2, 3];
  const { success, failed } = await dispatchAudience(ids, "hi", 100, async () => true);
  assertEquals(success, 3);
  assertEquals(failed, 0);
});
