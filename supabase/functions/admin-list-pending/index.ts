import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { verifyInitDataAndGetUser, isAdmin } from "../_shared/telegram.ts";
import { createClient } from "../_shared/client.ts";

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  let body: { initData?: string; limit?: number; offset?: number }; try { body = await req.json(); } catch { return new Response("Bad JSON", { status: 400 }); }

  const supa = createClient();

  const u = await verifyInitDataAndGetUser(body.initData || "");
  if (!u || !isAdmin(u.id)) return new Response("Unauthorized", { status: 401 });

  const limit = Math.min(Math.max(body.limit ?? 25, 1), 100);
  const offset = Math.max(body.offset ?? 0, 0);

  // Pull payments pending + join plan & user
  const { data: rows, error } = await supa
    .from("payments")
    .select("id,created_at,user_id,plan_id,amount,currency,status,webhook_data, bot_users!inner(telegram_id), subscription_plans!inner(name,duration_months)")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return new Response(JSON.stringify({ ok:false, error: error.message }), { status: 500 });

  // For each receipt path, create short-lived signed URL for preview
  const out = [];
  for (const r of rows || []) {
    let signed_url: string | null = null;
    const bucket = r.webhook_data?.storage_bucket || "receipts";
    const path   = r.webhook_data?.storage_path || null;
    if (path) {
      const { data: signed } = await supa.storage.from(bucket).createSignedUrl(path, 600); // 10 min
      signed_url = signed?.signedUrl || null;
    }
    out.push({
      id: r.id,
      created_at: r.created_at,
      telegram_id: r.bot_users?.telegram_id || null,
      plan: r.subscription_plans?.name || null,
      months: r.subscription_plans?.duration_months || null,
      amount: r.amount, currency: r.currency,
      receipt_url: signed_url
    });
  }

  return new Response(JSON.stringify({ ok:true, items: out }), { headers: { "content-type":"application/json" }});
});
