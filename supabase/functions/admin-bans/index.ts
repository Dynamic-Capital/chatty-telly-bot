import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isAdmin, verifyInitDataAndGetUser } from "../_shared/telegram.ts";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  let body: {
    initData: string;
    op: "list" | "add" | "remove";
    telegram_id?: string;
    reason?: string;
    days?: number;
  };
  try {
    body = await req.json();
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  const u = await verifyInitDataAndGetUser(body.initData || "");
  if (!u || !isAdmin(u.id)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supa = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  if (body.op === "list") {
    const { data } = await supa.from("abuse_bans").select(
      "id,telegram_id,reason,created_at,expires_at",
    ).order("created_at", { ascending: false }).limit(100);
    return new Response(JSON.stringify({ ok: true, items: data || [] }), {
      headers: { "content-type": "application/json" },
    });
  }
  if (body.op === "add" && body.telegram_id) {
    const exp = body.days
      ? new Date(Date.now() + body.days * 86400000).toISOString()
      : null;
    await supa.from("abuse_bans").insert({
      telegram_id: body.telegram_id,
      reason: body.reason || "ban",
      expires_at: exp,
      created_by: String(u.id),
    });
    return new Response(JSON.stringify({ ok: true }));
  }
  if (body.op === "remove" && body.telegram_id) {
    await supa.from("abuse_bans").delete().eq("telegram_id", body.telegram_id);
    return new Response(JSON.stringify({ ok: true }));
  }
  return new Response("Bad Request", { status: 400 });
});
