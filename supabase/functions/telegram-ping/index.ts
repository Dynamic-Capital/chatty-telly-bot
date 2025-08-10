// >>> DC BLOCK: telegram-ping (start)
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const BOT = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";

async function tg(method: string, payload: unknown) {
  if (!BOT) throw new Error("TELEGRAM_BOT_TOKEN missing");
  const r = await fetch(`https://api.telegram.org/bot${BOT}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(8000)
  });
  return r;
}

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const chatId = Number(url.searchParams.get("chat_id") || 0);
    if (!chatId) return new Response(JSON.stringify({ ok:false, error:"chat_id required" }), { status:400, headers:{ "content-type":"application/json" } });
    const res = await tg("sendMessage", { chat_id: chatId, text: "pong ✅ (telegram-ping)" });
    const body = await res.text().catch(()=> "");
    return new Response(JSON.stringify({ ok: res.ok, status: res.status, preview: body.slice(0,200) }), { headers:{ "content-type":"application/json","cache-control":"no-store" }});
  } catch (e) {
    return new Response(JSON.stringify({ ok:false, error:String(e) }), { status:500, headers:{ "content-type":"application/json" }});
  }
});
// <<< DC BLOCK: telegram-ping (end)
