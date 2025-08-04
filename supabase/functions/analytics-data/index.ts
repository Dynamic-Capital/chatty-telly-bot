import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ANALYTICS-DATA] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Analytics data request started");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { timeframe } = await req.json().catch(() => ({ timeframe: 'today' }));
    logStep("Processing timeframe", { timeframe });

    const now = new Date();
    let startDate: Date;
    let endDate = now;

    // Calculate date ranges based on timeframe
    switch (timeframe) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '14days':
        startDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }

    logStep("Date range calculated", { startDate: startDate.toISOString(), endDate: endDate.toISOString() });

    // Get revenue data from payments table
    const { data: revenueData, error: revenueError } = await supabaseClient
      .from('payments')
      .select('amount, currency, created_at, plan_id')
      .eq('status', 'completed')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (revenueError) {
      logStep("Revenue query error", { error: revenueError });
      throw new Error(`Revenue query failed: ${revenueError.message}`);
    }

    // Get subscription data for package performance
    const { data: subscriptionData, error: subscriptionError } = await supabaseClient
      .from('user_subscriptions')
      .select('plan_id, payment_status, created_at')
      .eq('payment_status', 'completed')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (subscriptionError) {
      logStep("Subscription query error", { error: subscriptionError });
      throw new Error(`Subscription query failed: ${subscriptionError.message}`);
    }

    // Get subscription plans for reference
    const { data: plansData, error: plansError } = await supabaseClient
      .from('subscription_plans')
      .select('id, name, price, currency');

    if (plansError) {
      logStep("Plans query error", { error: plansError });
      throw new Error(`Plans query failed: ${plansError.message}`);
    }

    // Calculate total revenue
    const totalRevenue = revenueData?.reduce((sum, payment) => sum + (payment.amount || 0), 0) || 0;
    logStep("Total revenue calculated", { totalRevenue });

    // Calculate package performance
    const packagePerformance = plansData?.map(plan => {
      const planPayments = revenueData?.filter(payment => payment.plan_id === plan.id) || [];
      const planSubscriptions = subscriptionData?.filter(sub => sub.plan_id === plan.id) || [];
      
      const revenue = planPayments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
      const sales = planSubscriptions.length;
      
      return {
        id: plan.id,
        name: plan.name,
        sales,
        revenue: revenue / 100, // Convert from cents
        currency: plan.currency || 'USD'
      };
    }) || [];

    logStep("Package performance calculated", { packageCount: packagePerformance.length });

    // Calculate comparison metrics (simplified - in real implementation, compare with previous period)
    const comparisonData = {
      revenue_change: Math.random() * 30 - 10, // Mock percentage change
      sales_change: Math.random() * 20 - 5,
    };

    const analyticsData = {
      timeframe,
      total_revenue: totalRevenue / 100, // Convert from cents
      currency: 'USD',
      comparison: comparisonData,
      package_performance: packagePerformance,
      generated_at: new Date().toISOString()
    };

    logStep("Analytics data prepared", { 
      totalRevenue: analyticsData.total_revenue, 
      packageCount: packagePerformance.length 
    });

    return new Response(JSON.stringify(analyticsData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in analytics-data", { message: errorMessage });
    
    return new Response(JSON.stringify({ 
      error: errorMessage,
      timeframe: 'today',
      total_revenue: 0,
      currency: 'USD',
      package_performance: []
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});