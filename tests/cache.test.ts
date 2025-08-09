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

const { getCached, clearCache, cacheStats } = await import("../src/utils/cache.ts");

registerTest("clearCache only removes cached entries", async () => {
  localStorage.setItem("external", "keep");

  await getCached("foo", 1000, () => Promise.resolve("foo"));
  await getCached("bar", 1000, () => Promise.resolve("bar"));

  clearCache();

  assertEquals(localStorage.getItem("external"), "keep");
  assertEquals(localStorage.getItem("foo"), null);
  assertEquals(localStorage.getItem("bar"), null);
  assertEquals(cacheStats().size, 0);
});

registerTest("getCached removes invalid localStorage entries", async () => {
  clearCache();
  localStorage.clear();
  // expired entry should be replaced
  const key = "temp";
  localStorage.setItem(key, JSON.stringify({ value: "old", expiry: Date.now() - 1 }));
  const fresh = await getCached(key, 1000, async () => "new");
  assertEquals(fresh, "new");
  const stored = JSON.parse(localStorage.getItem(key)!);
  assertEquals(stored.value, "new");

  // malformed entry should be ignored and replaced
  clearCache(key);
  localStorage.setItem(key, "not-json");
  const newer = await getCached(key, 1000, async () => "newer");
  assertEquals(newer, "newer");
  const stored2 = JSON.parse(localStorage.getItem(key)!);
  assertEquals(stored2.value, "newer");
});
