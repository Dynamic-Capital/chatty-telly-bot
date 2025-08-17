import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { verifyInitDataAndGetUser } from "../_shared/telegram.ts";
import { createClient } from "../_shared/client.ts";
import { ok, bad, unauth, mna } from "../_shared/http.ts";

serve(async (req) => {
  if (req.method !== "POST") return mna();

  let body: { initData?: string; type?: string; bank?: string; network?: string };
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

  if (body.type === "bank") {
    const pay_code = crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
    let userId: string | undefined;
    if (supa) {
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
      await supa.from("payment_intents").insert({
        user_id: userId ?? crypto.randomUUID(),
        method: "bank",
        expected_amount: 0,
        currency: "USD",
        pay_code,
        status: "pending",
        notes: body.bank || null,
      }).catch(() => null);
    }
    return ok({ pay_code });
  }

  if (body.type === "crypto") {
    const deposit_address = Deno.env.get("CRYPTO_DEPOSIT_ADDRESS") || "DEMO-ADDRESS";
    let userId: string | undefined;
    if (supa) {
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
      await supa.from("payment_intents").insert({
        user_id: userId ?? crypto.randomUUID(),
        method: "crypto",
        expected_amount: 0,
        currency: "USD",
        status: "pending",
        notes: body.network || null,
      }).catch(() => null);
    }
    return ok({ deposit_address });
  }

  return bad("Unknown intent type");
});
