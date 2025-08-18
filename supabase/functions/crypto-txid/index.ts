import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { verifyInitDataAndGetUser } from "../_shared/telegram.ts";
import { createClient } from "../_shared/client.ts";
import { bad, mna, ok, unauth } from "../_shared/http.ts";

serve(async (req) => {
  if (req.method !== "POST") return mna();

  let body: { initData?: string; txid?: string };
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
    const { error } = await supa.from("payment_intents").insert({
      user_id: crypto.randomUUID(),
      method: "crypto",
      expected_amount: 0,
      currency: "USD",
      status: "pending",
      notes: body.txid,
    });
    if (error) console.error(error);
  }

  return ok();
});
