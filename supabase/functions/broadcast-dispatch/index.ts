import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { optionalEnv, requireEnv } from "../_shared/env.ts";
import { bad, nf, ok, mna } from "../_shared/http.ts";
import { version } from "../_shared/version.ts";
export async function dispatchAudience(
  ids: number[],
  text: string,
  rps: number,
  send: (id: number, text: string) => Promise<boolean>,
) {
  const delay = rps > 0 ? 1000 / rps : 0;
  let success = 0, failed = 0;
  for (const id of ids) {
    const ok = await send(id, text);
    if (ok) success++; else failed++;
    if (delay) await new Promise((r) => setTimeout(r, delay));
  }
  return { success, failed };
}

export async function handler(req: Request): Promise<Response> {
  const v = version(req, "broadcast-dispatch");
  if (v) return v;
  if (req.method !== "POST") return mna();
  const { id } = await req.json().catch(() => ({}));
  if (!id) {
    return bad("bad_request");
  }
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TELEGRAM_BOT_TOKEN } = requireEnv(
    ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "TELEGRAM_BOT_TOKEN"] as const,
  );
  const headers = {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    "content-type": "application/json",
  };
  const br = await fetch(
    `${SUPABASE_URL}/rest/v1/broadcast_messages?id=eq.${id}&select=content,target_audience`,
    { headers },
  );
  const row = (await br.json())?.[0];
  if (!row) {
    return nf("not_found");
  }
  const targets: number[] = row.target_audience?.telegram_ids || [];
  const text = row.content || "";
  const rps = Number(optionalEnv("BROADCAST_RPS") || "25");

  async function sendOnce(tid: number, msg: string) {
    let attempt = 0; let wait = 500;
    while (attempt < 3) {
      const resp = await fetch(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: tid, text: msg }),
        },
      );
      if (resp.status === 429 || resp.status >= 500) {
        await new Promise((r) => setTimeout(r, wait));
        wait *= 2; attempt++;
        continue;
      }
      return resp.ok;
    }
    return false;
  }

  const { success, failed } = await dispatchAudience(targets, text, rps, sendOnce);

  await fetch(`${SUPABASE_URL}/rest/v1/broadcast_messages?id=eq.${id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      successful_deliveries: success,
      failed_deliveries: failed,
      sent_at: new Date().toISOString(),
      delivery_status: "sent",
      total_recipients: targets.length,
    }),
  });

  return ok();
}

if (import.meta.main) serve(handler);
