import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";
import { optionalEnv, requireEnv } from "../_shared/env.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Binance Pay API configuration
const {
  BINANCE_API_KEY: _BINANCE_PAY_API_KEY,
  BINANCE_SECRET_KEY: _BINANCE_PAY_SECRET_KEY,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
} = requireEnv(
  [
    "BINANCE_API_KEY",
    "BINANCE_SECRET_KEY",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
  ] as const,
);
const _BINANCE_PAY_MERCHANT_ID = "59586072";
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Binance Pay checkout request started");
    const requestBody = await req.json().catch(() => ({}));
    console.log("Request body:", requestBody);

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

    console.log("API Keys check:", {
      hasApiKey: !!binanceApiKey,
      hasSecretKey: !!binanceSecretKey,
      apiKeyLength: binanceApiKey ? binanceApiKey.length : 0,
    });

    if (!binanceApiKey || !binanceSecretKey) {
      console.error("Missing Binance API credentials");
      throw new Error("Binance API credentials not configured");
    }

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    console.log("Supabase client initialized");

    // Get plan details
    console.log("Fetching plan with ID:", planId);
    const { data: plan, error: planError } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("id", planId)
      .single();

    if (planError) {
      console.error("Plan fetch error:", planError);
      throw new Error(`Plan fetch error: ${planError.message}`);
    }

    if (!plan) {
      console.error("Plan not found for ID:", planId);
      throw new Error("Plan not found");
    }

    console.log("Plan found:", plan);

    // Create payment record
    const paymentData = {
      user_id: telegramUserId,
      plan_id: planId,
      amount: plan.price,
      currency: "USDT",
      payment_method: "binance_pay",
      status: "pending",
    };

    console.log("Creating payment with data:", paymentData);

    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert(paymentData)
      .select()
      .single();

    if (paymentError) {
      console.error("Payment creation error:", paymentError);
      throw new Error(`Payment creation error: ${paymentError.message}`);
    }

    if (!payment) {
      throw new Error("Failed to create payment record");
    }

    console.log("Payment record created:", payment);

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
    console.log("Binance Pay order result:", orderResult);

    if (orderResult.status !== "SUCCESS") {
      throw new Error(
        orderResult.errorMessage || "Binance Pay order creation failed",
      );
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
    console.error("Error in binance-pay-checkout:", error);
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
