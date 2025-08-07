-- Fix missing foreign key relationships and optimize database structure

-- Add missing foreign key constraints
ALTER TABLE broadcast_messages 
ADD CONSTRAINT fk_broadcast_messages_media_file 
FOREIGN KEY (media_file_id) REFERENCES media_files(id) ON DELETE SET NULL;

ALTER TABLE bot_users 
ADD CONSTRAINT fk_bot_users_current_plan 
FOREIGN KEY (current_plan_id) REFERENCES subscription_plans(id) ON DELETE SET NULL;

ALTER TABLE education_enrollments 
ADD CONSTRAINT fk_education_enrollments_package 
FOREIGN KEY (package_id) REFERENCES education_packages(id) ON DELETE CASCADE;

ALTER TABLE education_packages 
ADD CONSTRAINT fk_education_packages_category 
FOREIGN KEY (category_id) REFERENCES education_categories(id) ON DELETE SET NULL;

ALTER TABLE payments 
ADD CONSTRAINT fk_payments_plan 
FOREIGN KEY (plan_id) REFERENCES subscription_plans(id) ON DELETE CASCADE;

ALTER TABLE promo_analytics 
ADD CONSTRAINT fk_promo_analytics_plan 
FOREIGN KEY (plan_id) REFERENCES subscription_plans(id) ON DELETE SET NULL;

ALTER TABLE promotion_usage 
ADD CONSTRAINT fk_promotion_usage_promotion 
FOREIGN KEY (promotion_id) REFERENCES promotions(id) ON DELETE CASCADE;

ALTER TABLE user_subscriptions 
ADD CONSTRAINT fk_user_subscriptions_plan 
FOREIGN KEY (plan_id) REFERENCES subscription_plans(id) ON DELETE SET NULL;

ALTER TABLE user_surveys 
ADD CONSTRAINT fk_user_surveys_recommended_plan 
FOREIGN KEY (recommended_plan_id) REFERENCES subscription_plans(id) ON DELETE SET NULL;

-- Add missing indexes for better performance
CREATE INDEX IF NOT EXISTS idx_bot_users_subscription_expires ON bot_users(subscription_expires_at) WHERE subscription_expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bot_users_current_plan ON bot_users(current_plan_id) WHERE current_plan_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_education_enrollments_status ON education_enrollments(enrollment_status);
CREATE INDEX IF NOT EXISTS idx_education_enrollments_payment_status ON education_enrollments(payment_status);
CREATE INDEX IF NOT EXISTS idx_education_packages_category ON education_packages(category_id) WHERE category_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_education_packages_featured ON education_packages(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_education_packages_starts_at ON education_packages(starts_at) WHERE starts_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_plan ON payments(plan_id);
CREATE INDEX IF NOT EXISTS idx_promotions_code ON promotions(code);
CREATE INDEX IF NOT EXISTS idx_promotions_active ON promotions(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_promotions_valid_period ON promotions(valid_from, valid_until);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_telegram_user ON user_subscriptions(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_active ON user_subscriptions(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_user_interactions_telegram_user ON user_interactions(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_user_interactions_type ON user_interactions(interaction_type);

-- Create composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_bot_users_lookup ON bot_users(telegram_id, is_vip, subscription_expires_at);
CREATE INDEX IF NOT EXISTS idx_education_enrollments_lookup ON education_enrollments(student_telegram_id, enrollment_status, payment_status);
CREATE INDEX IF NOT EXISTS idx_media_files_lookup ON media_files(uploaded_by, file_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_broadcast_messages_lookup ON broadcast_messages(delivery_status, scheduled_at, created_at DESC);

-- Add check constraints for data integrity
ALTER TABLE bot_users ADD CONSTRAINT check_subscription_expires_future 
CHECK (subscription_expires_at IS NULL OR subscription_expires_at > created_at);

ALTER TABLE education_packages ADD CONSTRAINT check_positive_price 
CHECK (price >= 0);

ALTER TABLE education_packages ADD CONSTRAINT check_positive_duration 
CHECK (duration_weeks > 0);

ALTER TABLE education_packages ADD CONSTRAINT check_max_students_positive 
CHECK (max_students IS NULL OR max_students > 0);

ALTER TABLE education_enrollments ADD CONSTRAINT check_positive_payment_amount 
CHECK (payment_amount IS NULL OR payment_amount >= 0);

ALTER TABLE education_enrollments ADD CONSTRAINT check_progress_percentage 
CHECK (progress_percentage >= 0 AND progress_percentage <= 100);

ALTER TABLE media_files ADD CONSTRAINT check_positive_file_size 
CHECK (file_size >= 0);

ALTER TABLE payments ADD CONSTRAINT check_positive_amount 
CHECK (amount > 0);

ALTER TABLE subscription_plans ADD CONSTRAINT check_positive_price_plans 
CHECK (price >= 0);

ALTER TABLE subscription_plans ADD CONSTRAINT check_positive_duration_months 
CHECK (duration_months > 0);

-- Fix function search path security issue
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_education_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER  
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_daily_analytics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.daily_analytics (date)
  VALUES (CURRENT_DATE)
  ON CONFLICT (date) DO NOTHING;
END;
$$;