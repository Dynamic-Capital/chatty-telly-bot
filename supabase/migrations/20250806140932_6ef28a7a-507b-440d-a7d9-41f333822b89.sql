-- Clean up unused indexes (many indexes have 0 usage)
-- Note: pg_net extension in public schema is Supabase-managed and cannot be moved

-- Drop unused indexes that are not primary keys or unique constraints
DROP INDEX IF EXISTS idx_bot_users_notes;
DROP INDEX IF EXISTS idx_bot_users_follow_up;
DROP INDEX IF EXISTS idx_bot_users_vip;
DROP INDEX IF EXISTS idx_conversion_tracking_user_id;
DROP INDEX IF EXISTS idx_conversion_tracking_type;
DROP INDEX IF EXISTS idx_conversion_tracking_date;
DROP INDEX IF EXISTS idx_promo_analytics_code;
DROP INDEX IF EXISTS idx_promo_analytics_date;
DROP INDEX IF EXISTS idx_admin_logs_admin_id;
DROP INDEX IF EXISTS idx_admin_logs_action_type;
DROP INDEX IF EXISTS idx_user_sessions_active;

-- Keep essential indexes but drop duplicates
-- Keep idx_bot_users_telegram_id_lookup, drop the duplicate
DROP INDEX IF EXISTS idx_bot_users_telegram_id;

-- Add missing indexes for foreign keys that need them
CREATE INDEX IF NOT EXISTS idx_payments_plan_id ON payments (plan_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_plan_id ON user_subscriptions (plan_id);
CREATE INDEX IF NOT EXISTS idx_promotion_usage_promotion_id ON promotion_usage (promotion_id);
CREATE INDEX IF NOT EXISTS idx_education_packages_category_id ON education_packages (category_id);
CREATE INDEX IF NOT EXISTS idx_education_enrollments_package_id ON education_enrollments (package_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_messages_media_file_id ON broadcast_messages (media_file_id);

-- Add composite indexes for frequently used queries
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_status ON user_subscriptions (telegram_user_id, payment_status, is_active);
CREATE INDEX IF NOT EXISTS idx_bot_users_active_admin ON bot_users (is_admin, is_vip) WHERE telegram_id IS NOT NULL;