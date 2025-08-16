import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "../_shared/client.ts";
import { requireEnv, optionalEnv } from "../_shared/env.ts";
import { createLogger } from "../_shared/logger.ts";
import { alertAdmins } from "../_shared/alerts.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const { BINANCE_API_KEY, BINANCE_SECRET_KEY } = requireEnv([
  "BINANCE_API_KEY",
  "BINANCE_SECRET_KEY",
] as const);

async function generateSignature(
  timestamp: string,
  nonce: string,
  body: string,
  secretKey: string,
): Promise<string> {
  const payload = timestamp + "\n" + nonce + "\n" + body + "\n";
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secretKey);
  const messageData = encoder.encode(payload);
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, messageData);
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

function getLogger(req: Request) {
  return createLogger({
    function: "binancepay-webhook",
    requestId:
      req.headers.get("sb-request-id") ||
      req.headers.get("x-request-id") ||
      crypto.randomUUID(),
  });
}

export async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const logger = getLogger(req);
  try {
    const timestamp = req.headers.get("BinancePay-Timestamp") || "";
    const nonce = req.headers.get("BinancePay-Nonce") || "";
    const signature = req.headers.get("BinancePay-Signature") || "";
    const certSn = req.headers.get("BinancePay-Certificate-SN") || "";
    const bodyText = await req.text();

    if (certSn !== BINANCE_API_KEY) {
      logger.warn("Invalid certificate serial number", { certSn });
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const expected = await generateSignature(
      timestamp,
      nonce,
      bodyText,
      BINANCE_SECRET_KEY,
    );
    if (signature !== expected) {
      logger.warn("Signature mismatch", { signature, expected });
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }

    const payload = JSON.parse(bodyText || "{}");
    logger.info("Webhook payload", payload);
    const status = String(payload?.data?.status || payload?.bizStatus || "").toUpperCase();
    if (status.includes("PAID")) {
      const paymentId = payload?.data?.merchantTradeNo;
      if (paymentId) {
        const supabase = createClient();
        const { data: payment, error } = await supabase
          .from("payments")
          .update({ status: "awaiting_admin", webhook_data: payload })
          .eq("id", paymentId)
          .select()
          .single();
        if (error) logger.error("Payment update error", error);
        if (payment) {
          const botUser = optionalEnv("TELEGRAM_BOT_USERNAME");
          const cmd = `/approve ${payment.id}`;
          const link = botUser
            ? `<a href="https://t.me/${botUser}?start=approve_${payment.id}">${cmd}</a>`
            : cmd;
          await alertAdmins(`Payment ${payment.id} paid via Binance Pay. ${link}`);
        }
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    logger.error("binancepay-webhook error", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
}

if (import.meta.main) serve(handler);

