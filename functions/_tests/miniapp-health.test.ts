// functions/_tests/miniapp-health.test.ts
// Offline shape tests for the miniapp-health function.
// No secrets required. We assert response structure for GET and for POST without env (VIP unknown).
import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { setTestEnv } from "../../supabase/functions/_tests/env-mock.ts";

setTestEnv({
  SUPABASE_URL: "http://local",
  SUPABASE_SERVICE_ROLE_KEY: "test-svc",
});

(globalThis as any).fetch = async () =>
  new Response("[]", {
    status: 200,
    headers: { "content-type": "application/json" },
  });

(globalThis as any).setInterval = () => 0;
(globalThis as any).clearInterval = () => {};

let mod: any = null;
try {
  mod = await import(
    new URL("../../supabase/functions/miniapp-health/index.ts", import.meta.url)
      .href
  );
} catch {
  // skip tests if function missing
}

Deno.test("miniapp-health: module present", () => {
  assert(!!mod, "miniapp-health function was not found at expected path");
});

Deno.test("miniapp-health: GET returns 405", async () => {
  if (!mod?.default) return;
  const res: Response = await mod.default(
    new Request("http://x/miniapp-health", { method: "GET" }),
  );
  assertEquals(res.status, 405);
});

Deno.test("miniapp-health: POST without env returns vip.is_vip", async () => {
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
  assert("vip" in j);
  assert("is_vip" in j.vip);
});
