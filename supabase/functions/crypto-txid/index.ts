import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { verifyInitDataAndGetUser } from "../_shared/telegram.ts";
import { createClient } from "../_shared/client.ts";
import { bad, mna, ok, unauth } from "../_shared/http.ts";

serve(async (req) => {
  if (req.method !== "POST") return mna();

  let body: { initData?: string; txid?: string; amount?: number; currency?: string };
  try {
    body = await req.json();
  } catch {
    return bad("Bad JSON");
  }

  const u = await verifyInitDataAndGetUser(body.initData || "");
  if (!u) return unauth();

  let supa;
  try {
    supa = createClient();
  } catch (_) {
    supa = null;
  }

  if (supa && body.txid) {
    let userId: string | undefined;
    const { data: bu } = await supa
      .from("bot_users")
      .select("id")
      .eq("telegram_id", String(u.id))
      .limit(1);
    userId = bu?.[0]?.id as string | undefined;
    if (!userId) {
      const { data: ins } = await supa
        .from("bot_users")
        .insert({ telegram_id: String(u.id) })
        .select("id")
        .single();
      userId = ins?.id as string | undefined;
    }
    const currency = body.currency === "MVR" ? "MVR" : "USD";
    const baseAmount = body.amount || 0;
    const expected = currency === "MVR" ? baseAmount * 17.5 : baseAmount;
    const { error } = await supa.from("payment_intents").insert({
      user_id: userId ?? crypto.randomUUID(),
      method: "crypto",
      expected_amount: expected,
      currency,
      status: "pending",
      notes: body.txid,
    });
    if (error) console.error(error);
  }

  return ok();
});
