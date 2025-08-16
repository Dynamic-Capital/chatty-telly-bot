import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "../_shared/client.ts";
import { bad, mna, ok, oops, unauth } from "../_shared/http.ts";
import { need } from "../_shared/env.ts";

async function tgSend(token: string, chatId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  }).catch(() => {});
}

async function activateSubscription(
  supa: ReturnType<typeof createClient>,
  paymentId: string,
) {
  await supa.rpc("finalize_completed_payment", { p_payment_id: paymentId })
    .catch(
      () => {},
    );
}

serve(async (req) => {
  const url = new URL(req.url);
  if (req.method === "GET" && url.pathname.endsWith("/version")) {
    return ok({ name: "crypto-webhook", ts: new Date().toISOString() });
  }
  if (req.method === "HEAD") return new Response(null, { status: 200 });
  if (req.method !== "POST") return mna();

  const hdr = req.headers.get("X-Crypto-Secret") || "";
  const secret = need("CRYPTO_WEBHOOK_SECRET");
  if (hdr !== secret) return unauth();

  let body: {
    txId?: string;
    to?: string;
    amount?: number;
    currency?: string;
    planId?: string;
    telegramId?: string | number;
    confirms?: number;
  };
  try {
    body = await req.json();
  } catch {
    return bad("Bad JSON");
  }

  const { txId, to, amount, currency, planId, telegramId, confirms } = body;
  if (
    !txId || !to || amount == null || !currency || !planId || !telegramId ||
    confirms == null
  ) {
    return bad("Missing fields");
  }

  const minConf = Number(need("CRYPTO_MIN_CONFIRMS"));
  const isConfirmed = Number(confirms) >= minConf;

  const supa = createClient();

  const { data: user } = await supa
    .from("bot_users")
    .select("id")
    .eq("telegram_id", String(telegramId))
    .maybeSingle();
  const userId = user?.id;
  if (!userId) return bad("Unknown user");

  const paymentData = {
    user_id: userId,
    plan_id: planId,
    amount,
    currency,
    payment_method: "crypto",
    payment_provider_id: txId,
    status: isConfirmed ? "completed" : "pending",
    webhook_data: { to, confirms },
  };

  const { data: payment, error } = await supa
    .from("payments")
    .upsert(paymentData, { onConflict: "payment_provider_id" })
    .select()
    .single();
  if (error || !payment) return oops("Database error", error?.message || "");

  await supa.from("admin_logs").insert({
    admin_telegram_id: "system",
    action_type: isConfirmed ? "payment_completed" : "payment_pending",
    action_description: isConfirmed
      ? `Crypto payment ${txId} confirmed`
      : `Crypto payment ${txId} pending (${confirms} confs)`,
    affected_table: "payments",
    affected_record_id: payment.id,
  });

  if (isConfirmed) {
    await activateSubscription(supa, payment.id);
    const token = need("TELEGRAM_BOT_TOKEN");
    await tgSend(
      token,
      String(telegramId),
      "✅ Payment confirmed. VIP activated.",
    );
  }

  return ok({ status: isConfirmed ? "completed" : "pending" });
});
