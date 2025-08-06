-- Performance optimization: Add missing indexes for faster queries

-- Critical indexes for telegram bot operations
CREATE INDEX IF NOT EXISTS idx_bot_users_telegram_id ON public.bot_users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_bot_users_is_admin ON public.bot_users(is_admin) WHERE is_admin = true;
CREATE INDEX IF NOT EXISTS idx_bot_users_is_vip ON public.bot_users(is_vip) WHERE is_vip = true;
CREATE INDEX IF NOT EXISTS idx_bot_users_created_at ON public.bot_users(created_at DESC);

-- Session and interaction indexes
CREATE INDEX IF NOT EXISTS idx_user_interactions_telegram_user_id ON public.user_interactions(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_user_interactions_created_at ON public.user_interactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_interactions_type_created ON public.user_interactions(interaction_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bot_sessions_telegram_user_id ON public.bot_sessions(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_bot_sessions_created_at ON public.bot_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bot_sessions_active ON public.bot_sessions(telegram_user_id, created_at DESC) WHERE session_end IS NULL;

-- Payment and subscription indexes
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON public.payments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_status_created ON public.payments(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_telegram_user_id ON public.user_subscriptions(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_active ON public.user_subscriptions(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status_date ON public.user_subscriptions(payment_status, created_at DESC);

-- Content and settings indexes
CREATE INDEX IF NOT EXISTS idx_bot_content_key_active ON public.bot_content(content_key) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_bot_settings_key_active ON public.bot_settings(setting_key) WHERE is_active = true;

-- Analytics and reporting indexes
CREATE INDEX IF NOT EXISTS idx_daily_analytics_date ON public.daily_analytics(date DESC);
CREATE INDEX IF NOT EXISTS idx_promo_analytics_created_at ON public.promo_analytics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_promo_analytics_promo_code ON public.promo_analytics(promo_code, created_at DESC);

-- Education and promotion indexes
CREATE INDEX IF NOT EXISTS idx_education_enrollments_telegram_user_id ON public.education_enrollments(student_telegram_id);
CREATE INDEX IF NOT EXISTS idx_education_enrollments_status ON public.education_enrollments(enrollment_status);
CREATE INDEX IF NOT EXISTS idx_education_packages_active ON public.education_packages(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_promotions_active ON public.promotions(is_active, valid_from, valid_until) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_promotion_usage_promotion_id ON public.promotion_usage(promotion_id);

-- Admin and logging indexes
CREATE INDEX IF NOT EXISTS idx_admin_logs_admin_telegram_id ON public.admin_logs(admin_telegram_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON public.admin_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_logs_action_type ON public.admin_logs(action_type, created_at DESC);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_user_interactions_user_type_date ON public.user_interactions(telegram_user_id, interaction_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_user_status_date ON public.payments(user_id, status, created_at DESC);