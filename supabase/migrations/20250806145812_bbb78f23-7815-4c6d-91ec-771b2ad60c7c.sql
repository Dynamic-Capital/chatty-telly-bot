-- Performance optimization: Add missing indexes for faster queries

-- Critical indexes for telegram bot operations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bot_users_telegram_id ON public.bot_users(telegram_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bot_users_is_admin ON public.bot_users(is_admin) WHERE is_admin = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bot_users_is_vip ON public.bot_users(is_vip) WHERE is_vip = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bot_users_created_at ON public.bot_users(created_at DESC);

-- Session and interaction indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_interactions_telegram_user_id ON public.user_interactions(telegram_user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_interactions_created_at ON public.user_interactions(created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_interactions_type_created ON public.user_interactions(interaction_type, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bot_sessions_telegram_user_id ON public.bot_sessions(telegram_user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bot_sessions_created_at ON public.bot_sessions(created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bot_sessions_active ON public.bot_sessions(telegram_user_id, created_at DESC) WHERE session_end IS NULL;

-- Payment and subscription indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_created_at ON public.payments(created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_status_created ON public.payments(status, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_subscriptions_telegram_user_id ON public.user_subscriptions(telegram_user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_subscriptions_active ON public.user_subscriptions(is_active) WHERE is_active = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_subscriptions_status_date ON public.user_subscriptions(payment_status, created_at DESC);

-- Content and settings indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bot_content_key_active ON public.bot_content(content_key) WHERE is_active = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bot_settings_key_active ON public.bot_settings(setting_key) WHERE is_active = true;

-- Analytics and reporting indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_daily_analytics_date ON public.daily_analytics(date DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_promo_analytics_created_at ON public.promo_analytics(created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_promo_analytics_promo_code ON public.promo_analytics(promo_code, created_at DESC);

-- Education and promotion indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_education_enrollments_telegram_user_id ON public.education_enrollments(student_telegram_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_education_enrollments_status ON public.education_enrollments(enrollment_status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_education_packages_active ON public.education_packages(is_active) WHERE is_active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_promotions_active ON public.promotions(is_active, valid_from, valid_until) WHERE is_active = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_promotion_usage_promotion_id ON public.promotion_usage(promotion_id);

-- Admin and logging indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_admin_logs_admin_telegram_id ON public.admin_logs(admin_telegram_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_admin_logs_created_at ON public.admin_logs(created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_admin_logs_action_type ON public.admin_logs(action_type, created_at DESC);

-- Composite indexes for common query patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_interactions_user_type_date ON public.user_interactions(telegram_user_id, interaction_type, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_user_status_date ON public.payments(user_id, status, created_at DESC);

-- Create optimized views for common queries
CREATE OR REPLACE VIEW public.active_vip_users AS
SELECT bu.telegram_id, bu.first_name, bu.last_name, bu.username, 
       bu.subscription_expires_at, bu.created_at
FROM public.bot_users bu
WHERE bu.is_vip = true 
  AND (bu.subscription_expires_at IS NULL OR bu.subscription_expires_at > NOW());

CREATE OR REPLACE VIEW public.recent_user_activity AS
SELECT ui.telegram_user_id, 
       COUNT(*) as interaction_count,
       MAX(ui.created_at) as last_activity,
       bu.first_name, bu.last_name, bu.is_vip, bu.is_admin
FROM public.user_interactions ui
JOIN public.bot_users bu ON bu.telegram_id = ui.telegram_user_id
WHERE ui.created_at >= NOW() - INTERVAL '24 hours'
GROUP BY ui.telegram_user_id, bu.first_name, bu.last_name, bu.is_vip, bu.is_admin;

CREATE OR REPLACE VIEW public.payment_summary AS
SELECT p.user_id,
       COUNT(*) as total_payments,
       COUNT(*) FILTER (WHERE p.status = 'completed') as completed_payments,
       COUNT(*) FILTER (WHERE p.status = 'pending') as pending_payments,
       SUM(p.amount) FILTER (WHERE p.status = 'completed') as total_revenue,
       MAX(p.created_at) as last_payment_date
FROM public.payments p
GROUP BY p.user_id;

-- Update table statistics for better query planning
ANALYZE public.bot_users;
ANALYZE public.user_interactions;
ANALYZE public.bot_sessions;
ANALYZE public.payments;
ANALYZE public.user_subscriptions;
ANALYZE public.bot_content;
ANALYZE public.bot_settings;