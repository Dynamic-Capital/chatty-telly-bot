-- Ensure subscription_plans table has required columns for plan editing
ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS currency text DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS duration_months integer,
  ADD COLUMN IF NOT EXISTS is_lifetime boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS features text[] DEFAULT ARRAY[]::text[];

-- Maintain updated_at timestamp
DROP TRIGGER IF EXISTS update_subscription_plans_updated_at ON subscription_plans;
CREATE TRIGGER update_subscription_plans_updated_at
  BEFORE UPDATE ON subscription_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
