import { assertEquals } from "https://deno.land/std@0.224.0/testing/asserts.ts";

// Build valid Telegram initData given user object and bot token
async function makeInitData(user: { id: number }) {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
  const enc = new TextEncoder();
  const secret = await crypto.subtle.digest("SHA-256", enc.encode(token));
  const key = await crypto.subtle.importKey("raw", secret, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const auth_date = Math.floor(Date.now() / 1000).toString();
  const params = new URLSearchParams();
  params.set("auth_date", auth_date);
  params.set("user", encodeURIComponent(JSON.stringify(user)));
  const dataCheck = Array.from(params.entries()).map(([k, v]) => `${k}=${v}`).sort().join("\n");
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(dataCheck));
  const hash = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
  params.set("hash", hash);
  return params.toString();
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

Deno.test("admin approves payment via telegram", async () => {
  Deno.env.set("SUPABASE_URL", "https://supabase.test");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "svc");
  Deno.env.set("TELEGRAM_BOT_TOKEN", "tbot");
  Deno.env.set("TELEGRAM_ADMIN_IDS", "999");

  const payments = [{ id: "p1", user_id: "u1", plan_id: "plan1", status: "pending" }];
  const bot_users = [{ id: "u1", telegram_id: "100", is_vip: false, subscription_expires_at: null }];
  const user_subscriptions: any[] = [];
  (globalThis as any).__SUPA_MOCK__ = {
    tables: { payments, bot_users, user_subscriptions, admin_logs: [] },
  };
  const restore = setupTelegramMock();
  try {
    const mod = await import("../supabase/functions/admin-act-on-payment/index.ts");
    const initData = await makeInitData({ id: 999 });
    const req = new Request("https://example.com", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData, payment_id: "p1", decision: "approve" }),
    });
    const res = await mod.handler(req);
    assertEquals(res.status, 200);
    assertEquals(payments[0].status, "completed");
    assertEquals(bot_users[0].is_vip, true);
    // ensure subscription inserted
    assertEquals(user_subscriptions.length, 1);
  } finally {
    restore();
    await new Promise((r) => setTimeout(r, 0));
  }
});
