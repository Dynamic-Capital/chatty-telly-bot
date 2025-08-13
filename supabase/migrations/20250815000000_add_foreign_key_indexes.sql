-- Add indexes on foreign key columns to improve join performance
CREATE INDEX IF NOT EXISTS idx_promo_analytics_plan_id ON public.promo_analytics(plan_id);
CREATE INDEX IF NOT EXISTS idx_user_surveys_recommended_plan_id ON public.user_surveys(recommended_plan_id);
CREATE INDEX IF NOT EXISTS idx_education_enrollments_package_id ON public.education_enrollments(package_id);
CREATE INDEX IF NOT EXISTS idx_education_enrollments_student_bot_user_id ON public.education_enrollments(student_bot_user_id);
CREATE INDEX IF NOT EXISTS idx_promotion_usage_promotion_id ON public.promotion_usage(promotion_id);
