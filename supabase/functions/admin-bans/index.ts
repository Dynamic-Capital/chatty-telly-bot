import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "../_shared/client.ts";
import { isAdmin, verifyInitDataAndGetUser } from "../_shared/telegram.ts";
import { ok, bad, unauth, mna } from "../_shared/http.ts";

serve(async (req) => {
  const url = new URL(req.url);
  if (req.method === "GET" && url.pathname.endsWith("/version")) {
    return ok({ name: "admin-bans", ts: new Date().toISOString() });
  }
  if (req.method === "HEAD") return new Response(null, { status: 200 });
  if (req.method !== "POST") return mna();

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
    return bad("Bad JSON");
  }

  const u = await verifyInitDataAndGetUser(body.initData || "");
  if (!u || !isAdmin(u.id)) {
    return unauth();
  }

  const supa = createClient();

  if (body.op === "list") {
    const { data } = await supa.from("abuse_bans").select(
      "id,telegram_id,reason,created_at,expires_at",
    ).order("created_at", { ascending: false }).limit(100);
    return ok({ items: data || [] });
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
    return ok();
  }
  if (body.op === "remove" && body.telegram_id) {
    await supa.from("abuse_bans").delete().eq("telegram_id", body.telegram_id);
    return ok();
  }
  return bad("Bad Request");
});
