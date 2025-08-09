import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const BOT = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
const SECRET = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") || "";
const BASE = (Deno.env.get("SUPABASE_URL") || "").replace(/\/$/,"");
const FN = "telegram-webhook";
const expected = BASE ? `${BASE}/functions/v1/${FN}` : null;

function red(s: string, keep = 4) { return s ? s.slice(0, keep) + "...redacted" : ""; }

serve(async () => {
  if (!BOT) {
    return new Response(JSON.stringify({ ok:false, error:"BOT_TOKEN missing" }), { headers:{"content-type":"application/json"}, status:500 });
  }
  const info = await fetch(`https://api.telegram.org/bot${BOT}/getWebhookInfo`).then(r=>r.json()).catch(e=>({ ok:false, error:String(e) }));
  return new Response(JSON.stringify({
    ok: true,
    expected_url: expected,
    has_secret: !!SECRET,
    token_preview: red(BOT),
    webhook_info: info
  }), { headers: {"content-type":"application/json","cache-control":"no-store"} });
});
