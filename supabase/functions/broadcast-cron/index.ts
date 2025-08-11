// >>> DC BLOCK: broadcast-cron-core (start)
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { requireEnv } from "../_shared/env.ts";
import { functionUrl } from "../_shared/edge.ts";

serve(async (_req) => {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = requireEnv(
    ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const,
  );
  const headers = {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  };
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/broadcast_messages?delivery_status=eq.scheduled&scheduled_at=lte.${new Date().toISOString()}&select=id`,
    { headers },
  );
  const rows = await r.json();
  const url = functionUrl("broadcast-dispatch");
  for (const row of rows || []) {
    if (!url) break;
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: row.id }),
    });
  }
  return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
});
// <<< DC BLOCK: broadcast-cron-core (end)
