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

import { calcFinalAmount, redeemKey } from "../supabase/functions/_shared/promo.ts";
import { makeReferralLink } from "../supabase/functions/referral-link/index.ts";

registerTest("promo validation math", () => {
  assertEquals(calcFinalAmount(100, "percent", 20), 80);
  assertEquals(calcFinalAmount(100, "fixed", 30), 70);
});

registerTest("idempotent redeem key", () => {
  const a = redeemKey("p1", "CODE");
  const b = redeemKey("p1", "CODE");
  assertEquals(a, b);
});

registerTest("referral link format", () => {
  const link = makeReferralLink("mybot", 12345);
  assertEquals(link, "https://t.me/mybot?startapp=ref_12345");
});
