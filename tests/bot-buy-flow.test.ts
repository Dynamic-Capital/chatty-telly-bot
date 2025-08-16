import { assertEquals, assert } from "https://deno.land/std@0.224.0/testing/asserts.ts";

function buildBuyMenu(plans: Array<{ id: string; name: string }>) {
  const methods: string[] = [];
  if (Deno.env.get("BINANCE_API_KEY")) methods.push("Binance Pay");
  if (Deno.env.get("BANK_ACCOUNT")) methods.push("Bank Transfer");
  if (Deno.env.get("CRYPTO_DEPOSIT_ADDRESS")) methods.push("Crypto");
  return { plans, methods };
}

Deno.test("/buy shows plans and enabled payment methods", () => {
  const plans = [{ id: "p1", name: "Basic" }, { id: "p2", name: "Pro" }];
  Deno.env.set("BINANCE_API_KEY", "key");
  Deno.env.set("BANK_ACCOUNT", "acct");
  Deno.env.delete("CRYPTO_DEPOSIT_ADDRESS");
  const menu = buildBuyMenu(plans);
  assertEquals(menu.plans.length, 2);
  assertEquals(menu.methods, ["Binance Pay", "Bank Transfer"]);
  Deno.env.set("CRYPTO_DEPOSIT_ADDRESS", "addr");
  const menu2 = buildBuyMenu(plans);
  assert(menu2.methods.includes("Crypto"));
});
