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

import { getCached, clearCache, cacheStats } from "../src/utils/cache.ts";

const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => (key in store ? store[key] : null),
    setItem: (key, value) => {
      store[key] = value;
    },
    removeItem: (key) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    key: (i) => Object.keys(store)[i] ?? null,
    get length() {
      return Object.keys(store).length;
    },
  };
})();

(globalThis as unknown as { localStorage: typeof localStorageMock }).localStorage = localStorageMock;

registerTest("clearCache only removes cached entries", async () => {
  localStorage.setItem("external", "keep");

  await getCached("foo", 1000, async () => "foo");
  await getCached("bar", 1000, async () => "bar");

  clearCache();

  assertEquals(localStorage.getItem("external"), "keep");
  assertEquals(localStorage.getItem("foo"), null);
  assertEquals(localStorage.getItem("bar"), null);
  assertEquals(cacheStats().size, 0);
});
