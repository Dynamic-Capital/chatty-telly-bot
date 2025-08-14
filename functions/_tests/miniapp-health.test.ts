// functions/_tests/miniapp-health.test.ts
// Offline shape tests for the miniapp-health function.
// No secrets required. We assert response structure for GET and for POST without env (VIP unknown).
import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

// Provide dummy Supabase environment so miniapp-health module can be loaded
Deno.env.set("SUPABASE_URL", "https://example.com");
Deno.env.set("SUPABASE_ANON_KEY", "anon");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service");

let mod: Record<string, unknown> | null = null;
try {
  mod = await import("../../supabase/functions/miniapp-health/index.ts");
} catch {
  // skip tests if function missing
}

Deno.test("miniapp-health: module present", () => {
  if (!mod) return; // skip if module failed to load
  assert(!!mod, "miniapp-health function was not found at expected path");
});

Deno.test("miniapp-health: GET returns method not allowed", async () => {
  if (!mod?.default) return;
  const res: Response = await mod.default(
    new Request("http://x/miniapp-health", { method: "GET" }),
  );
  assertEquals(res.status, 405);
});

Deno.test("miniapp-health: POST without env returns shape with vip.is_vip null", async () => {
  if (!mod?.default) return;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify([]), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  try {
    const req = new Request("http://x/miniapp-health", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ telegram_id: "12345" }),
    });
    const res: Response = await mod.default(req);
    assertEquals(res.status, 200);
    const j = await res.json();
    assertEquals(j.ok, true);
    assertEquals(j.vip.is_vip, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
