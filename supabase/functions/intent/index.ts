import { verifyInitDataAndGetUser } from "../_shared/telegram.ts";
import { createClient } from "../_shared/client.ts";
import { ok, bad, unauth, mna, oops } from "../_shared/http.ts";
import { getContent } from "../_shared/config.ts";
Deno.serve(async (req) => {
  if (req.method !== "POST") return mna();

  let body: { initData?: string; type?: string; bank?: string; network?: string; amount?: number; currency?: string };
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
    const currency = body.currency === "MVR" ? "MVR" : "USD";
    const baseAmount = body.amount || 50;
    const expected = currency === "MVR" ? baseAmount * 17.5 : baseAmount;
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
      const { error: intentErr } = await supa.from("payment_intents").insert({
        user_id: userId ?? crypto.randomUUID(),
        method: "bank",
        expected_amount: expected,
        currency,
        pay_code,
        status: "pending",
        notes: body.bank || null,
      });
      if (intentErr) {
        console.error("create bank payment intent error", intentErr);
        return oops("Failed to create payment intent");
      }
    }
    return ok({ pay_code });
  }

  if (body.type === "crypto") {
    const deposit_address = await getContent<string>("crypto_usdt_trc20")
      || "DEMO-ADDRESS";

    // Get default crypto amount from config or use a reasonable default
    const defaultAmount = parseFloat(
      await getContent<string>("default_crypto_amount") || "50",
    );
    const currency = body.currency === "MVR" ? "MVR" : "USD";
    const baseAmount = body.amount || defaultAmount;
    const expected = currency === "MVR" ? baseAmount * 17.5 : baseAmount;

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
      const { error: intentErr } = await supa.from("payment_intents").insert({
        user_id: userId ?? crypto.randomUUID(),
        method: "crypto",
        expected_amount: expected,
        currency,
        status: "pending",
        notes: body.network || null,
      });
      if (intentErr) {
        console.error("create crypto payment intent error", intentErr);
        return oops("Failed to create payment intent");
      }
    }
    return ok({ deposit_address });
  }

  return bad("Unknown intent type");
});
