import { assertEquals } from "https://deno.land/std@0.224.0/testing/asserts.ts";
import { setFlag, publish } from "../src/utils/config.ts";

// helper to compute HMAC SHA-512 signature
async function sign(secret: string, timestamp: string, nonce: string, body: string) {
  const payload = `${timestamp}\n${nonce}\n${body}\n`;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

function setupTelegramMock() {
  const orig = globalThis.fetch;
  globalThis.fetch = async (input: Request | string | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? String(input) : input instanceof URL ? input.toString() : input.url;
    if (url.startsWith("https://api.telegram.org")) {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    return orig(input as any, init);
  };
  return () => (globalThis.fetch = orig);
}

Deno.test("binance webhook processes successful payment", async () => {
  await setFlag("payments_enabled", true);
  await publish();
  Deno.env.set("SUPABASE_URL", "https://supabase.test");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "svc");
  Deno.env.set("TELEGRAM_BOT_TOKEN", "tbot");
  Deno.env.set("SUPABASE_ANON_KEY", "anon");
  Deno.env.set("BINANCE_SECRET_KEY", "shhh");

  const payments = [{
    id: "p1",
    user_id: 100,
    plan_id: "plan1",
    status: "pending",
    subscription_plans: { is_lifetime: false, duration_months: 1, name: "Basic" },
  }];
  const bot_users = [{
    id: "u1",
    telegram_id: 100,
    is_vip: false,
    current_plan_id: null,
    subscription_expires_at: null,
  }];
  (globalThis as any).__SUPA_MOCK__ = {
    tables: { payments, bot_users, user_subscriptions: [], admin_logs: [], plan_channels: [], channel_memberships: [] },
  };
  const restore = setupTelegramMock();
  try {
    const mod = await import("../supabase/functions/binance-pay-webhook/index.ts");
    const body = { bizType: "PAY_SUCCESS", data: { merchantTradeNo: "p1", transactionId: "tx123", payerInfo: {}, transactionTime: "0" } };
    const raw = JSON.stringify(body);
    const ts = "1";
    const nonce = "abc";
    const sig = await sign("shhh", ts, nonce, raw);
    const req = new Request("https://example.com", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "BinancePay-Timestamp": ts,
        "BinancePay-Nonce": nonce,
        "BinancePay-Signature": sig,
      },
      body: raw,
    });
    const res = await mod.handler(req);
    assertEquals(res.status, 200);
    assertEquals(payments[0].status, "completed");
    assertEquals(payments[0].payment_provider_id, "tx123");
    assertEquals(bot_users[0].is_vip, true);
  } finally {
    restore();
    Deno.env.delete("SUPABASE_ANON_KEY");
    await new Promise((r) => setTimeout(r, 0));
    await setFlag("payments_enabled", false);
    await publish();
  }
});

Deno.test("binance webhook rejects invalid signature", async () => {
  await setFlag("payments_enabled", true);
  await publish();
  Deno.env.set("SUPABASE_URL", "https://supabase.test");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "svc");
  Deno.env.set("TELEGRAM_BOT_TOKEN", "tbot");
  Deno.env.set("SUPABASE_ANON_KEY", "anon");
  Deno.env.set("BINANCE_SECRET_KEY", "shhh");
  const payments = [{ id: "p1", user_id: 100, plan_id: "plan1", status: "pending", subscription_plans: { is_lifetime: false, duration_months: 1, name: "Basic" } }];
  const bot_users = [{ id: "u1", telegram_id: 100, is_vip: false, current_plan_id: null, subscription_expires_at: null }];
  (globalThis as any).__SUPA_MOCK__ = {
    tables: { payments, bot_users, user_subscriptions: [], admin_logs: [], plan_channels: [], channel_memberships: [] },
  };
  const restore = setupTelegramMock();
  try {
    const mod = await import("../supabase/functions/binance-pay-webhook/index.ts");
    const body = { bizType: "PAY_SUCCESS", data: { merchantTradeNo: "p1", transactionId: "tx123" } };
    const raw = JSON.stringify(body);
    const ts = "1";
    const nonce = "abc";
    const req = new Request("https://example.com", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "BinancePay-Timestamp": ts,
        "BinancePay-Nonce": nonce,
        "BinancePay-Signature": "WRONG",
      },
      body: raw,
    });
    const res = await mod.handler(req);
    assertEquals(res.status, 403);
    assertEquals(payments[0].status, "pending");
    assertEquals(bot_users[0].is_vip, false);
  } finally {
    restore();
    Deno.env.delete("SUPABASE_ANON_KEY");
    await new Promise((r) => setTimeout(r, 0));
    await setFlag("payments_enabled", false);
    await publish();
  }
});
