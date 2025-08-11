// functions/_tests/miniapp-health.test.ts
// Offline shape tests for the miniapp-health function.
// No secrets required. We assert response structure for GET and for POST without env (VIP unknown).
import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

let mod: any = null;
try {
  mod = await import("../../supabase/functions/miniapp-health/index.ts");
} catch {
  // skip tests if function missing
}

Deno.test("miniapp-health: module present", () => {
  assert(!!mod, "miniapp-health function was not found at expected path");
});

Deno.test("miniapp-health: GET returns ok payload", async () => {
  if (!mod?.default) return;
  const res: Response = await mod.default(
    new Request("http://x/miniapp-health", { method: "GET" }),
  );
  assertEquals(res.status, 200);
  const j = await res.json();
  assertEquals(j.ok, true);
  assert(typeof j.env === "object");
});

Deno.test("miniapp-health: POST without env returns shape with vip.is_vip null or boolean", async () => {
  if (!mod?.default) return;
  const req = new Request("http://x/miniapp-health", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ telegram_id: "12345" }),
  });
  const res: Response = await mod.default(req);
  assertEquals(res.status, 200);
  const j = await res.json();
  assertEquals(j.ok, true);
  assertEquals(j.telegram_id, "12345");
  assert(typeof j.vip.source === "string");
  assert("is_vip" in j.vip);
});
