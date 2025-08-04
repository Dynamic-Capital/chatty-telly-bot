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
    console.log('Binance Pay checkout request started');
    const requestBody = await req.json();
    console.log('Request body:', requestBody);
    
    const { planId, telegramUserId, telegramUsername } = requestBody;

    if (!planId || !telegramUserId) {
      throw new Error('Missing required parameters: planId or telegramUserId');
    }

    // Check if API keys are available
    const binanceApiKey = Deno.env.get('BINANCE_API_KEY');
    const binanceSecretKey = Deno.env.get('BINANCE_SECRET_KEY');
    
    console.log('API Keys check:', { 
      hasApiKey: !!binanceApiKey, 
      hasSecretKey: !!binanceSecretKey,
      apiKeyLength: binanceApiKey ? binanceApiKey.length : 0
    });

    if (!binanceApiKey || !binanceSecretKey) {
      console.error('Missing Binance API credentials');
      throw new Error('Binance API credentials not configured');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration missing');
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    console.log('Supabase client initialized');

    // Get plan details
    console.log('Fetching plan with ID:', planId);
    const { data: plan, error: planError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', planId)
      .single();

    if (planError) {
      console.error('Plan fetch error:', planError);
      throw new Error(`Plan fetch error: ${planError.message}`);
    }
    
    if (!plan) {
      console.error('Plan not found for ID:', planId);
      throw new Error('Plan not found');
    }

    console.log('Plan found:', plan);

    // Create payment record
    const paymentData = {
      user_id: telegramUserId,
      plan_id: planId,
      amount: plan.price,
      currency: 'USDT',
      payment_method: 'binance_pay',
      status: 'pending'
    };
    
    console.log('Creating payment with data:', paymentData);

    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert(paymentData)
      .select()
      .single();

    if (paymentError) {
      console.error('Payment creation error:', paymentError);
      throw new Error(`Payment creation error: ${paymentError.message}`);
    }

    if (!payment) {
      throw new Error('Failed to create payment record');
    }

    console.log('Payment record created:', payment);

    // For now, return a mock checkout URL for testing
    // TODO: Implement real Binance Pay API when credentials are ready
    const mockCheckoutData = {
      success: true,
      paymentId: payment.id,
      checkoutUrl: `https://pay.binance.com/checkout/${payment.id}`,
      qrCodeUrl: `https://pay.binance.com/qr/${payment.id}`,
      deeplink: `binance://pay?orderId=${payment.id}&amount=${plan.price}&currency=USDT`,
      universalUrl: `https://app.binance.com/payment/${payment.id}`
    };

    console.log('Returning checkout data:', mockCheckoutData);

    return new Response(JSON.stringify(mockCheckoutData), {
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