import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { verifyInitDataAndGetUser, isAdmin } from "../_shared/telegram.ts";

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  let body: { initData?: string }; try { body = await req.json(); } catch { return new Response("Bad JSON", { status: 400 }); }
  const u = await verifyInitDataAndGetUser(body.initData || "");
  const ok = !!(u && isAdmin(u.id));
  return new Response(JSON.stringify({ ok, user_id: u?.id ?? null }), { headers: { "content-type":"application/json" }});
});
