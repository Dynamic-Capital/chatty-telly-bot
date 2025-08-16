import { assertEquals } from "https://deno.land/std@0.224.0/testing/asserts.ts";

async function sign(ts: string, nonce: string, body: string, secret: string) {
  const payload = ts + "\n" + nonce + "\n" + body + "\n";
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), {
    name: "HMAC",
    hash: "SHA-512",
  }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

Deno.test("binancepay webhook marks payment awaiting_admin", async () => {
  Deno.env.set("SUPABASE_URL", "https://supabase.test");
  Deno.env.set("SUPABASE_ANON_KEY", "anon");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "svc");
  Deno.env.set("BINANCE_API_KEY", "apiKey");
  Deno.env.set("BINANCE_SECRET_KEY", "sec");
  Deno.env.set("TELEGRAM_BOT_TOKEN", "tbot");
  Deno.env.set("TELEGRAM_ADMIN_IDS", "1");
  Deno.env.set("TELEGRAM_BOT_USERNAME", "mybot");

  const payments = [{
    id: "p1",
    status: "pending",
    user_id: "u1",
    plan_id: "plan1",
    amount: 10,
    currency: "USDT",
    payment_method: "binance_pay",
  }];
  (globalThis as any).__SUPA_MOCK__ = { tables: { payments, admin_logs: [] } };

  const calls: Array<{ url: string; body: string }> = [];
  const origFetch = globalThis.fetch;
  globalThis.fetch = async (input: any, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.url;
    if (url.startsWith("https://api.telegram.org")) {
      calls.push({ url, body: init?.body ? String(init.body) : "" });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    return new Response("{}", { status: 200 });
  };

  try {
    const payload = { bizStatus: "PAY_SUCCESS", data: { merchantTradeNo: "p1", status: "PAID" } };
    const body = JSON.stringify(payload);
    const ts = Date.now().toString();
    const nonce = "abc123";
    const sig = await sign(ts, nonce, body, "sec");
    const req = new Request("https://example.com", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "BinancePay-Timestamp": ts,
        "BinancePay-Nonce": nonce,
        "BinancePay-Signature": sig,
        "BinancePay-Certificate-SN": "apiKey",
      },
      body,
    });
    const mod = await import("../supabase/functions/binancepay-webhook/index.ts");
    const res = await mod.handler(req);
    assertEquals(res.status, 200);
    assertEquals(payments[0].status, "awaiting_admin");
    assertEquals(payments[0].webhook_data.bizStatus, "PAY_SUCCESS");
    assertEquals(calls.length, 1);
    if (!calls[0].body.includes("/approve p1")) {
      throw new Error("missing approve link");
    }
  } finally {
    globalThis.fetch = origFetch;
    Deno.env.delete("SUPABASE_URL");
    Deno.env.delete("SUPABASE_ANON_KEY");
    Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
    Deno.env.delete("BINANCE_API_KEY");
    Deno.env.delete("BINANCE_SECRET_KEY");
    Deno.env.delete("TELEGRAM_BOT_TOKEN");
    Deno.env.delete("TELEGRAM_ADMIN_IDS");
    Deno.env.delete("TELEGRAM_BOT_USERNAME");
  }
});

