-- Add missing foreign key constraints for plan relations

-- Ensure conversion_tracking.plan_id references subscription_plans
ALTER TABLE conversion_tracking
ADD CONSTRAINT conversion_tracking_plan_id_fkey
  FOREIGN KEY (plan_id)
  REFERENCES subscription_plans(id)
  ON DELETE SET NULL;

-- Ensure promo_analytics.plan_id references subscription_plans
ALTER TABLE promo_analytics
ADD CONSTRAINT promo_analytics_plan_id_fkey
  FOREIGN KEY (plan_id)
  REFERENCES subscription_plans(id)
  ON DELETE SET NULL;

-- Ensure user_surveys.recommended_plan_id references subscription_plans
ALTER TABLE user_surveys
ADD CONSTRAINT user_surveys_recommended_plan_id_fkey
  FOREIGN KEY (recommended_plan_id)
  REFERENCES subscription_plans(id)
  ON DELETE SET NULL;
