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

-- Create materialized view for dashboard analytics (faster than real-time queries)
CREATE MATERIALIZED VIEW IF NOT EXISTS public.dashboard_stats AS
SELECT 
  (SELECT COUNT(*) FROM public.bot_users) as total_users,
  (SELECT COUNT(*) FROM public.bot_users WHERE is_vip = true) as vip_users,
  (SELECT COUNT(*) FROM public.bot_users WHERE is_admin = true) as admin_users,
  (SELECT COUNT(*) FROM public.payments WHERE status = 'pending') as pending_payments,
  (SELECT COUNT(*) FROM public.payments WHERE status = 'completed') as completed_payments,
  (SELECT COALESCE(SUM(amount), 0) FROM public.payments WHERE status = 'completed') as total_revenue,
  (SELECT COUNT(*) FROM public.user_interactions WHERE created_at >= NOW() - INTERVAL '24 hours') as daily_interactions,
  (SELECT COUNT(*) FROM public.bot_sessions WHERE created_at >= NOW() - INTERVAL '24 hours') as daily_sessions,
  NOW() as last_updated;

-- Create unique index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_dashboard_stats_updated ON public.dashboard_stats(last_updated);

-- Function to refresh dashboard stats
CREATE OR REPLACE FUNCTION public.refresh_dashboard_stats()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $$
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.dashboard_stats;
$$;

-- Update table statistics for better query planning
ANALYZE public.bot_users;
ANALYZE public.user_interactions;
ANALYZE public.bot_sessions;
ANALYZE public.payments;
ANALYZE public.user_subscriptions;
ANALYZE public.bot_content;
ANALYZE public.bot_settings;