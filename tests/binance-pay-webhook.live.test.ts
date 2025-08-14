import { assertEquals } from "https://deno.land/std@0.224.0/testing/asserts.ts";
import { setFlag, publish } from "../src/utils/config.ts";

// compute HMAC SHA-512 signature for Binance headers
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

function mockTelegram() {
  const calls: Array<{ url: string; body: string }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: Request | string | URL, init?: RequestInit) => {
    calls.push({ url: String(input), body: init?.body ? String(init.body) : "" });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };
  return { calls, restore: () => (globalThis.fetch = originalFetch) };
}

denoEnvCleanup();

denoTest("binance webhook completes payment and updates DB", async () => {
  setEnv();
  await setFlag("payments_enabled", true);
  await publish();
  const { calls, restore } = mockTelegram();
  try {
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
    const mod = await import("../supabase/functions/binance-pay-webhook/index.ts");
    const body = await Deno.readTextFile(new URL("./fixtures/binance-pay-success.json", import.meta.url));
    const ts = "1";
    const nonce = "abc";
    const sig = await sign("shhh", ts, nonce, body);
    const req = new Request("https://example.com", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "BinancePay-Timestamp": ts,
        "BinancePay-Nonce": nonce,
        "BinancePay-Signature": sig,
      },
      body,
    });
    const res = await mod.handler(req);
    assertEquals(res.status, 200);
    assertEquals(payments[0].status, "completed");
    assertEquals(bot_users[0].is_vip, true);
    assertEquals(calls.length > 0, true);
  } finally {
    restore();
    cleanup();
    await new Promise((r) => setTimeout(r, 0));
    await setFlag("payments_enabled", false);
    await publish();
  }
});

denoTest("binance webhook rejects invalid signature", async () => {
  setEnv();
  await setFlag("payments_enabled", true);
  await publish();
  const { restore } = mockTelegram();
  try {
    const payments = [{
      id: "p1",
      user_id: 100,
      plan_id: "plan1",
      status: "pending",
      subscription_plans: { is_lifetime: false, duration_months: 1, name: "Basic" },
    }];
    const bot_users = [{ id: "u1", telegram_id: 100, is_vip: false, current_plan_id: null, subscription_expires_at: null }];
    (globalThis as any).__SUPA_MOCK__ = {
      tables: { payments, bot_users, user_subscriptions: [], admin_logs: [], plan_channels: [], channel_memberships: [] },
    };
    const mod = await import("../supabase/functions/binance-pay-webhook/index.ts");
    const body = await Deno.readTextFile(new URL("./fixtures/binance-pay-success.json", import.meta.url));
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
      body,
    });
    const res = await mod.handler(req);
    assertEquals(res.status, 403);
    assertEquals(payments[0].status, "pending");
    assertEquals(bot_users[0].is_vip, false);
  } finally {
    restore();
    cleanup();
    await new Promise((r) => setTimeout(r, 0));
     await setFlag("payments_enabled", false);
     await publish();
  }
});

denoTest("binance webhook errors when payment missing", async () => {
  setEnv();
  await setFlag("payments_enabled", true);
  await publish();
  const { restore } = mockTelegram();
  try {
    const payments: any[] = [];
    const bot_users: any[] = [];
    (globalThis as any).__SUPA_MOCK__ = {
      tables: { payments, bot_users, user_subscriptions: [], admin_logs: [], plan_channels: [], channel_memberships: [] },
    };
    const mod = await import("../supabase/functions/binance-pay-webhook/index.ts");
    const body = await Deno.readTextFile(new URL("./fixtures/binance-pay-success.json", import.meta.url));
    const ts = "1";
    const nonce = "abc";
    const sig = await sign("shhh", ts, nonce, body);
    const req = new Request("https://example.com", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "BinancePay-Timestamp": ts,
        "BinancePay-Nonce": nonce,
        "BinancePay-Signature": sig,
      },
      body,
    });
    const res = await mod.handler(req);
    assertEquals(res.status, 500);
  } finally {
    restore();
    cleanup();
    await new Promise((r) => setTimeout(r, 0));
    await setFlag("payments_enabled", false);
    await publish();
  }
});

function setEnv() {
  Deno.env.set("SUPABASE_URL", "https://supabase.test");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "svc");
  Deno.env.set("TELEGRAM_BOT_TOKEN", "tbot");
  Deno.env.set("BINANCE_SECRET_KEY", "shhh");
}

function cleanup() {
  Deno.env.delete("SUPABASE_URL");
  Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
  Deno.env.delete("TELEGRAM_BOT_TOKEN");
  Deno.env.delete("BINANCE_SECRET_KEY");
  delete (globalThis as any).__SUPA_MOCK__;
}

function denoEnvCleanup() {
  cleanup();
}

function denoTest(name: string, fn: () => Promise<void>) {
  Deno.test(name, fn);
}
