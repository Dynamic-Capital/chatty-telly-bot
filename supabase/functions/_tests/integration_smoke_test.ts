// Uses MINI_APP_URL and FUNCTIONS_BASE from CI env to hit live endpoints.
// No secrets; just reachability.
const MINI = Deno.env.get("MINI_APP_URL");
const BASE = Deno.env.get("FUNCTIONS_BASE") || (MINI ? new URL(MINI).origin : "");

Deno.test("miniapp reachable", async () => {
  if (!MINI) return; // skip locally
  const r = await fetch(MINI, { method: "HEAD" });
  if (!r.ok && r.status >= 400) throw new Error(`Mini app not reachable: ${r.status}`);
});

Deno.test("ops-health ok", async () => {
  if (!BASE) return;
  const r = await fetch(`${BASE}/ops-health`);
  if (!r.ok) throw new Error(`ops-health failed: ${r.status}`);
  const j = await r.json();
  if (!j.ok) throw new Error(`ops-health report not ok`);
});
