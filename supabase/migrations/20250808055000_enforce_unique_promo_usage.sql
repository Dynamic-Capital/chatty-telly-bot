-- Enforce single promo usage per user
-- Each telegram user can apply a given promotion only once
CREATE UNIQUE INDEX IF NOT EXISTS idx_promotion_usage_unique_user_per_promo
ON promotion_usage (promotion_id, telegram_user_id);

-- Ensure RLS and policy for service role
ALTER TABLE promotion_usage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Bot can manage promotion usage" ON promotion_usage;
CREATE POLICY "Bot can manage promotion usage"
ON promotion_usage
FOR ALL
TO service_role
USING (true);
