/*
  # Fix VIP Plans Management System

  1. Database Functions
    - Add helper functions for plan management
    - Ensure proper error handling
    - Add validation functions

  2. Security
    - Verify RLS policies for subscription_plans
    - Ensure admin access is properly configured

  3. Indexes
    - Add performance indexes for plan queries
    - Optimize for admin operations
*/

-- Add index for better plan management performance
CREATE INDEX IF NOT EXISTS idx_subscription_plans_management 
ON subscription_plans (created_at DESC, is_lifetime, price);

-- Add index for plan lookups by admin
CREATE INDEX IF NOT EXISTS idx_subscription_plans_admin_lookup 
ON subscription_plans (id, name, price, is_lifetime);

-- Ensure RLS policy allows admin management
DO $$
BEGIN
  -- Check if admin management policy exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'subscription_plans' 
    AND policyname = 'Admins can manage subscription plans'
  ) THEN
    CREATE POLICY "Admins can manage subscription plans"
      ON subscription_plans
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM profiles 
          WHERE profiles.id = auth.uid() 
          AND profiles.role = 'admin'
        )
      );
  END IF;
END $$;

-- Function to validate plan data
CREATE OR REPLACE FUNCTION validate_subscription_plan_data(
  plan_name TEXT,
  plan_price NUMERIC,
  plan_duration INTEGER,
  plan_is_lifetime BOOLEAN,
  plan_features TEXT[]
) RETURNS JSON AS $$
DECLARE
  validation_result JSON;
  errors TEXT[] := '{}';
BEGIN
  -- Validate name
  IF plan_name IS NULL OR LENGTH(TRIM(plan_name)) < 3 THEN
    errors := array_append(errors, 'Plan name must be at least 3 characters');
  END IF;

  -- Validate price
  IF plan_price IS NULL OR plan_price <= 0 THEN
    errors := array_append(errors, 'Plan price must be greater than 0');
  END IF;

  -- Validate duration for non-lifetime plans
  IF NOT plan_is_lifetime AND (plan_duration IS NULL OR plan_duration <= 0) THEN
    errors := array_append(errors, 'Duration must be greater than 0 for non-lifetime plans');
  END IF;

  -- Validate features
  IF plan_features IS NULL OR array_length(plan_features, 1) = 0 THEN
    errors := array_append(errors, 'At least one feature is required');
  END IF;

  -- Return validation result
  IF array_length(errors, 1) > 0 THEN
    validation_result := json_build_object(
      'valid', false,
      'errors', errors
    );
  ELSE
    validation_result := json_build_object(
      'valid', true,
      'errors', '[]'::JSON
    );
  END IF;

  RETURN validation_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get plan statistics
CREATE OR REPLACE FUNCTION get_plan_statistics(plan_id_param UUID DEFAULT NULL)
RETURNS JSON AS $$
DECLARE
  result JSON;
  plan_stats RECORD;
BEGIN
  IF plan_id_param IS NOT NULL THEN
    -- Get stats for specific plan
    SELECT 
      sp.id,
      sp.name,
      sp.price,
      sp.currency,
      sp.duration_months,
      sp.is_lifetime,
      COALESCE(active_subs.count, 0) as active_subscriptions,
      COALESCE(total_subs.count, 0) as total_subscriptions,
      COALESCE(revenue.total, 0) as total_revenue
    INTO plan_stats
    FROM subscription_plans sp
    LEFT JOIN (
      SELECT plan_id, COUNT(*) as count
      FROM user_subscriptions 
      WHERE is_active = true AND plan_id = plan_id_param
      GROUP BY plan_id
    ) active_subs ON sp.id = active_subs.plan_id
    LEFT JOIN (
      SELECT plan_id, COUNT(*) as count
      FROM user_subscriptions 
      WHERE plan_id = plan_id_param
      GROUP BY plan_id
    ) total_subs ON sp.id = total_subs.plan_id
    LEFT JOIN (
      SELECT plan_id, SUM(amount) as total
      FROM payments 
      WHERE status = 'completed' AND plan_id = plan_id_param
      GROUP BY plan_id
    ) revenue ON sp.id = revenue.plan_id
    WHERE sp.id = plan_id_param;

    result := row_to_json(plan_stats);
  ELSE
    -- Get overall statistics
    SELECT json_build_object(
      'total_plans', COUNT(*),
      'active_plans', COUNT(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM user_subscriptions us WHERE us.plan_id = sp.id AND us.is_active = true
      )),
      'total_revenue', COALESCE(SUM(revenue.total), 0),
      'total_subscriptions', COALESCE(SUM(subs.count), 0)
    ) INTO result
    FROM subscription_plans sp
    LEFT JOIN (
      SELECT plan_id, SUM(amount) as total
      FROM payments 
      WHERE status = 'completed'
      GROUP BY plan_id
    ) revenue ON sp.id = revenue.plan_id
    LEFT JOIN (
      SELECT plan_id, COUNT(*) as count
      FROM user_subscriptions
      GROUP BY plan_id
    ) subs ON sp.id = subs.plan_id;
  END IF;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION validate_subscription_plan_data TO authenticated;
GRANT EXECUTE ON FUNCTION get_plan_statistics TO authenticated;