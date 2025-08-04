import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Binance Pay API configuration
const BINANCE_PAY_API_KEY = Deno.env.get('BINANCE_API_KEY')!;
const BINANCE_PAY_SECRET_KEY = Deno.env.get('BINANCE_SECRET_KEY')!;
const BINANCE_PAY_MERCHANT_ID = "59586072";
const BINANCE_PAY_BASE_URL = "https://bpay.binanceapi.com";

async function generateSignature(timestamp: string, nonce: string, body: string, secretKey: string): Promise<string> {
  const payload = timestamp + '\n' + nonce + '\n' + body + '\n';
  
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secretKey);
  const messageData = encoder.encode(payload);
  
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, messageData);
  
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

function generateNonce(): string {
  return crypto.randomUUID().replace(/-/g, '');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { planId, telegramUserId, telegramUsername } = await req.json();

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get plan details
    const { data: plan, error: planError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', planId)
      .single();

    if (planError || !plan) {
      throw new Error('Plan not found');
    }

    // Create payment record
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert({
        user_id: telegramUserId,
        plan_id: planId,
        amount: plan.price,
        currency: 'USDT', // Default crypto currency
        payment_method: 'binance_pay',
        status: 'pending'
      })
      .select()
      .single();

    if (paymentError || !payment) {
      throw new Error('Failed to create payment record');
    }

    // Prepare Binance Pay checkout request
    const timestamp = Date.now().toString();
    const nonce = generateNonce();
    
    const orderData = {
      merchantId: BINANCE_PAY_MERCHANT_ID,
      merchantTradeNo: payment.id,
      orderAmount: plan.price.toString(),
      currency: 'USDT',
      goods: {
        goodsType: "02", // Virtual goods
        goodsCategory: "6000", // Digital content
        referenceGoodsId: plan.id,
        goodsName: plan.name,
        goodsDetail: `VIP Subscription - ${plan.name} (${plan.duration_months} months)`
      },
      buyer: {
        referenceBuyerId: telegramUserId,
        buyerName: {
          firstName: telegramUsername || "User",
          lastName: ""
        }
      },
      returnUrl: `https://t.me/your_bot`, // Replace with your bot link
      cancelUrl: `https://t.me/your_bot`, // Replace with your bot link
      webhookUrl: `${supabaseUrl}/functions/v1/binance-pay-webhook`
    };

    const requestBody = JSON.stringify(orderData);
    
    // Generate HMAC signature with your API keys
    const signature = await generateSignature(timestamp, nonce, requestBody, BINANCE_PAY_SECRET_KEY);
    
    const headers = {
      'Content-Type': 'application/json',
      'BinancePay-Timestamp': timestamp,
      'BinancePay-Nonce': nonce,
      'BinancePay-Certificate-SN': BINANCE_PAY_API_KEY,
      'BinancePay-Signature': signature,
    };

    console.log('Creating Binance Pay checkout for payment:', payment.id);
    console.log('Order data:', orderData);

    // Create checkout session with Binance Pay
    const binanceResponse = await fetch(`${BINANCE_PAY_BASE_URL}/binancepay/openapi/v3/order`, {
      method: 'POST',
      headers,
      body: requestBody
    });

    const binanceData = await binanceResponse.json();
    console.log('Binance Pay response:', binanceData);

    if (!binanceResponse.ok || binanceData.status !== 'SUCCESS') {
      throw new Error(`Binance Pay error: ${binanceData.errorMessage || 'Unknown error'}`);
    }

    // Update payment with Binance Pay details
    await supabase
      .from('payments')
      .update({
        payment_provider_id: binanceData.data.prepayId,
        webhook_data: binanceData.data
      })
      .eq('id', payment.id);

    return new Response(JSON.stringify({
      success: true,
      paymentId: payment.id,
      checkoutUrl: binanceData.data.checkoutUrl,
      qrCodeUrl: binanceData.data.qrcodeLink,
      deeplink: binanceData.data.deeplink,
      universalUrl: binanceData.data.universalUrl
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in binance-pay-checkout:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});