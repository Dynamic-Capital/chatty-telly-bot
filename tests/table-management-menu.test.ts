import { assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("table management menu responds when env vars set", async () => {
  Deno.env.set("SUPABASE_URL", "https://example.supabase.co");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "servicekey");
  Deno.env.set("SUPABASE_ANON_KEY", "anonkey");
  Deno.env.set("TELEGRAM_BOT_TOKEN", "testtoken");

  const calls: Array<{ url: string; body: string }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: Request | string | URL, init?: RequestInit) => {
    calls.push({ url: String(input), body: init?.body ? String(init.body) : "" });
    const url = String(input);
    if (url.includes("supabase.co")) {
      return new Response(JSON.stringify([{ content_value: "x" }]), { status: 200 });
    }
    if (url.includes("api.telegram.org")) {
      return new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }), { status: 200 });
    }
    return new Response("{}", { status: 200 });
  };

  try {
    const mod = await import("../supabase/functions/telegram-bot/admin-handlers/index.ts");
    await mod.handleTableManagement(1, "user");
    assert(calls.some((c) => c.url.includes("api.telegram.org")), "sendMessage not called");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
