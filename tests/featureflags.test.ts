// @ts-nocheck
let registerTest;
let assertEquals;
if (typeof Deno !== "undefined") {
  registerTest = Deno.test;
  ({ assertEquals } = await import(
    "https://deno.land/std@0.224.0/testing/asserts.ts"
  ));
} else {
  const { test } = await import("node:test");
  registerTest = test;
  const assert = (await import("node:assert")).strict;
  assertEquals = (a, b, msg) => assert.equal(a, b, msg);
}

import {
  getFlag,
  preview,
  publish,
  rollback,
  setFlag,
} from "../src/utils/config.ts";

registerTest("feature flag workflow", async () => {
  const name = "payments_enabled";
  // ensure starting state
  assertEquals(await getFlag(name, false), false);
  await setFlag(name, true);
  // runtime still false
  assertEquals(await getFlag(name, false), false);
  // preview shows true
  const draft = await preview();
  assertEquals(draft.data[name], true);
  // publish and runtime now true
  await publish();
  assertEquals(await getFlag(name, false), true);
  // change draft to false and publish
  await setFlag(name, false);
  await publish();
  assertEquals(await getFlag(name, true), false);
  // rollback restores previous true
  await rollback();
  assertEquals(await getFlag(name, false), true);
});
