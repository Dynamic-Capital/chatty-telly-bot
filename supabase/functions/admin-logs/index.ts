import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyInitDataAndGetUser, isAdmin } from "../_shared/telegram.ts";
import { requireEnv } from "../_shared/env.ts";

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  let body: { initData: string; limit?: number; offset?: number }; try { body = await req.json(); } catch { return new Response("Bad JSON", { status: 400 }); }

  const u = await verifyInitDataAndGetUser(body.initData || "");
  if (!u || !isAdmin(u.id)) return new Response("Unauthorized", { status: 401 });

  const { SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: svc } =
    requireEnv(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const);
  const supa = createClient(url, svc, { auth: { persistSession: false } });

  const limit = Math.min(Math.max(body.limit ?? 20, 1), 100);
  const offset = Math.max(body.offset ?? 0, 0);

  const { data, error } = await supa.from("admin_logs")
    .select("created_at,admin_telegram_id,action_type,action_description,affected_table,affected_record_id")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return new Response(JSON.stringify({ ok:false, error: error.message }), { status: 500 });
  return new Response(JSON.stringify({ ok:true, items: data }), { headers: { "content-type":"application/json" }});
});
