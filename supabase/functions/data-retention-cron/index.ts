import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ok } from "../_shared/http.ts";
import { requireEnv } from "../_shared/env.ts";

serve(async (req) => {
  const url = new URL(req.url);
  if (req.method === "GET" && url.pathname.endsWith("/version")) {
    return ok({ name: "data-retention-cron", ts: new Date().toISOString() });
  }
  if (req.method === "HEAD") return new Response(null, { status: 200 });
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } =
    requireEnv(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const);
  const supa = createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  );
  const days = Number(Deno.env.get("RETENTION_DAYS") ?? "90");
  const cutoff = new Date(Date.now() - days * 86400000).toISOString();

  const del1 = await supa.from("user_interactions").delete().lte(
    "created_at",
    cutoff,
  ).select("id");
  const del2 = await supa.from("user_sessions").delete().lte(
    "last_activity",
    cutoff,
  ).select("id");
  const del3 = await supa.from("abuse_bans").delete().lt(
    "expires_at",
    new Date().toISOString(),
  ).select("id");

  await supa.from("admin_logs").insert({
    admin_telegram_id: "system",
    action_type: "data_retention",
    action_description: `Cleaned interactions(${
      del1.data?.length || 0
    }), sessions(${del2.data?.length || 0}), bans(${del3.data?.length || 0})`,
  });

  return new Response(
    JSON.stringify({
      ok: true,
      deleted: {
        interactions: del1.data?.length || 0,
        sessions: del2.data?.length || 0,
        bans: del3.data?.length || 0,
      },
    }),
    { headers: { "content-type": "application/json" } },
  );
});
