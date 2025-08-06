-- Add performance indexes for frequently queried tables
CREATE INDEX IF NOT EXISTS idx_bot_users_telegram_id_lookup ON bot_users (telegram_id);
CREATE INDEX IF NOT EXISTS idx_bot_users_admin_vip ON bot_users (is_admin, is_vip);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_active_lookup ON user_subscriptions (telegram_user_id, is_active, payment_status);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_active ON subscription_plans (is_lifetime, price);
CREATE INDEX IF NOT EXISTS idx_payments_user_status ON payments (user_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_bot_sessions_user_active ON bot_sessions (telegram_user_id, session_start);
CREATE INDEX IF NOT EXISTS idx_promotions_active_code ON promotions (code, is_active, valid_from, valid_until);
CREATE INDEX IF NOT EXISTS idx_media_files_telegram_file ON media_files (telegram_file_id, uploaded_by);

-- Add composite indexes for common admin queries
CREATE INDEX IF NOT EXISTS idx_admin_stats_composite ON bot_users (created_at, is_admin, is_vip);
CREATE INDEX IF NOT EXISTS idx_payment_analytics ON payments (created_at, status, amount, currency);

-- Optimize bot_content table for faster lookups
CREATE INDEX IF NOT EXISTS idx_bot_content_key_active ON bot_content (content_key, is_active);
CREATE INDEX IF NOT EXISTS idx_bot_settings_key_active ON bot_settings (setting_key, is_active);