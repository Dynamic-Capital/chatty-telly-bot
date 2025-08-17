import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "../_shared/client.ts";
import { optionalEnv, requireEnv } from "../_shared/env.ts";
import { createLogger } from "../_shared/logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Binance Pay API configuration
const {
  BINANCE_API_KEY: _BINANCE_PAY_API_KEY,
  BINANCE_SECRET_KEY: _BINANCE_PAY_SECRET_KEY,
  BINANCE_PAY_MERCHANT_ID: _BINANCE_PAY_MERCHANT_ID,
} = requireEnv([
  "BINANCE_API_KEY",
  "BINANCE_SECRET_KEY",
  "BINANCE_PAY_MERCHANT_ID",
] as const);
const _BINANCE_PAY_BASE_URL = "https://bpay.binanceapi.com";

async function _generateSignature(
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

function _generateNonce(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

function getLogger(req: Request) {
  return createLogger({
    function: "binance-pay-checkout",
    requestId:
      req.headers.get("sb-request-id") ||
      req.headers.get("x-request-id") ||
      crypto.randomUUID(),
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const logger = getLogger(req);

  try {
    logger.info("Binance Pay checkout request started");
    const requestBody = await req.json().catch(() => ({}));
    logger.info("Request body:", requestBody);

    const {
      planId,
      telegramUserId,
      telegramUsername: _telegramUsername,
      test,
    } = requestBody;

    if (test) {
      return new Response(
        JSON.stringify({ success: true, message: "binance-pay-checkout OK" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!planId || !telegramUserId) {
      throw new Error("Missing required parameters: planId or telegramUserId");
    }

    // Check if API keys are available
    const binanceApiKey = optionalEnv("BINANCE_API_KEY");
    const binanceSecretKey = optionalEnv("BINANCE_SECRET_KEY");

    logger.info("API Keys check:", {
      hasApiKey: !!binanceApiKey,
      hasSecretKey: !!binanceSecretKey,
      apiKeyLength: binanceApiKey ? binanceApiKey.length : 0,
    });

    if (!binanceApiKey || !binanceSecretKey) {
      logger.error("Missing Binance API credentials");
      throw new Error("Binance API credentials not configured");
    }

    // Initialize Supabase client
    const supabase = createClient();
    logger.info("Supabase client initialized");

    // Get plan details
    logger.info("Fetching plan with ID:", planId);
    const { data: plan, error: planError } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("id", planId)
      .single();

    if (planError) {
      logger.error("Plan fetch error:", planError);
      throw new Error(`Plan fetch error: ${planError.message}`);
    }

    if (!plan) {
      logger.error("Plan not found for ID:", planId);
      throw new Error("Plan not found");
    }

    logger.info("Plan found:", plan);

    // Ensure bot user exists and get its UUID
    logger.info("Ensuring bot user exists for telegram ID", telegramUserId);
    const { data: bu } = await supabase
      .from("bot_users")
      .select("id")
      .eq("telegram_id", telegramUserId)
      .limit(1);
    let botUserId = bu?.[0]?.id as string | undefined;
    if (!botUserId) {
      const { data: ins, error: insErr } = await supabase
        .from("bot_users")
        .insert({ telegram_id: telegramUserId })
        .select("id")
        .single();
      if (insErr) {
        logger.error("Bot user creation error:", insErr);
        throw new Error("Failed to create bot user");
      }
      botUserId = ins?.id;
    }
    if (!botUserId) {
      throw new Error("Bot user not found after creation attempt");
    }

    // Create payment record
    const paymentData = {
      user_id: botUserId,
      plan_id: planId,
      amount: plan.price,
      currency: "USDT",
      payment_method: "binance_pay",
      status: "pending",
    };

    logger.info("Creating payment with data:", paymentData);

    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert(paymentData)
      .select()
      .single();

    if (paymentError) {
      logger.error("Payment creation error:", paymentError);
      throw new Error(`Payment creation error: ${paymentError.message}`);
    }

    if (!payment) {
      throw new Error("Failed to create payment record");
    }

    logger.info("Payment record created:", payment);

    const orderPayload = {
      merchantId: _BINANCE_PAY_MERCHANT_ID,
      merchantTradeNo: payment.id.toString(),
      tradeType: "WEB",
      totalFee: Math.round(Number(plan.price) * 100),
      currency: "USDT",
      productDetail: plan.name,
    };

    const timestamp = Date.now().toString();
    const nonce = _generateNonce();
    const body = JSON.stringify(orderPayload);
    const signature = await _generateSignature(
      timestamp,
      nonce,
      body,
      _BINANCE_PAY_SECRET_KEY,
    );

    const orderResponse = await fetch(
      `${_BINANCE_PAY_BASE_URL}/binancepay/openapi/v3/order`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "BinancePay-Timestamp": timestamp,
          "BinancePay-Nonce": nonce,
          "BinancePay-Certificate-SN": _BINANCE_PAY_API_KEY,
          "BinancePay-Signature": signature,
        },
        body,
      },
    );

    const orderResult = await orderResponse.json();
    logger.info("Binance Pay order result:", orderResult);

    if (orderResult.status !== "SUCCESS") {
      throw new Error(
        orderResult.errorMessage || "Binance Pay order creation failed",
      );
    }

    const providerId = orderResult?.data?.prepayId;
    if (providerId) {
      const { error: updateErr } = await supabase
        .from("payments")
        .update({ payment_provider_id: providerId })
        .eq("id", payment.id)
        .single();
      if (updateErr) {
        logger.error("Failed to update payment provider id:", updateErr);
      }
    }

    const checkoutData = {
      success: true,
      paymentId: payment.id,
      checkoutUrl: orderResult.data.checkoutUrl,
      qrCodeUrl: orderResult.data.qrCode,
      deeplink: orderResult.data.deeplink,
      universalUrl: orderResult.data.universalUrl,
    };

    return new Response(JSON.stringify(checkoutData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    logger.error("Error in binance-pay-checkout:", error);
    return new Response(
      JSON.stringify({
        error: error.message,
        success: false,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
