-- Ensure B-tree indexes on key foreign key columns for performance
CREATE INDEX IF NOT EXISTS idx_bot_users_telegram_id ON public.bot_users USING BTREE (telegram_id);

CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments USING BTREE (user_id);
CREATE INDEX IF NOT EXISTS idx_payments_plan_id ON public.payments USING BTREE (plan_id);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_telegram_user_id ON public.user_subscriptions USING BTREE (telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_plan_id ON public.user_subscriptions USING BTREE (plan_id);

CREATE INDEX IF NOT EXISTS idx_education_enrollments_package_id ON public.education_enrollments USING BTREE (package_id);

-- Additional frequently queried foreign key
CREATE INDEX IF NOT EXISTS idx_user_package_assignments_bot_user_id ON public.user_package_assignments USING BTREE (bot_user_id);
