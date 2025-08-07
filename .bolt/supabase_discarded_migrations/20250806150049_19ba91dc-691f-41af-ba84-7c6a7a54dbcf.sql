-- Remove problematic views that cause security warnings
DROP VIEW IF EXISTS public.active_vip_users;
DROP VIEW IF EXISTS public.recent_user_activity;
DROP VIEW IF EXISTS public.payment_summary;
DROP MATERIALIZED VIEW IF EXISTS public.dashboard_stats;
DROP FUNCTION IF EXISTS public.refresh_dashboard_stats();

-- Create optimized functions for common queries instead of views
CREATE OR REPLACE FUNCTION public.get_bot_stats()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT jsonb_build_object(
    'total_users', (SELECT COUNT(*) FROM public.bot_users),
    'vip_users', (SELECT COUNT(*) FROM public.bot_users WHERE is_vip = true),
    'admin_users', (SELECT COUNT(*) FROM public.bot_users WHERE is_admin = true),
    'pending_payments', (SELECT COUNT(*) FROM public.payments WHERE status = 'pending'),
    'completed_payments', (SELECT COUNT(*) FROM public.payments WHERE status = 'completed'),
    'total_revenue', (SELECT COALESCE(SUM(amount), 0) FROM public.payments WHERE status = 'completed'),
    'daily_interactions', (SELECT COUNT(*) FROM public.user_interactions WHERE created_at >= NOW() - INTERVAL '24 hours'),
    'daily_sessions', (SELECT COUNT(*) FROM public.bot_sessions WHERE created_at >= NOW() - INTERVAL '24 hours'),
    'last_updated', NOW()
  );
$$;

-- Optimize bot content retrieval with single query
CREATE OR REPLACE FUNCTION public.get_bot_content_batch(content_keys text[])
RETURNS TABLE(content_key text, content_value text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT bc.content_key, bc.content_value
  FROM public.bot_content bc
  WHERE bc.content_key = ANY(content_keys)
    AND bc.is_active = true;
$$;

-- Optimize bot settings retrieval with single query  
CREATE OR REPLACE FUNCTION public.get_bot_settings_batch(setting_keys text[])
RETURNS TABLE(setting_key text, setting_value text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT bs.setting_key, bs.setting_value
  FROM public.bot_settings bs
  WHERE bs.setting_key = ANY(setting_keys)
    AND bs.is_active = true;
$$;

-- Create function to get user with all related data in one query
CREATE OR REPLACE FUNCTION public.get_user_complete_data(telegram_user_id_param text)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT jsonb_build_object(
    'user_info', to_jsonb(bu.*),
    'active_subscriptions', (
      SELECT COALESCE(jsonb_agg(to_jsonb(us.*)), '[]'::jsonb)
      FROM public.user_subscriptions us
      WHERE us.telegram_user_id = telegram_user_id_param
        AND us.is_active = true
    ),
    'recent_interactions', (
      SELECT COALESCE(jsonb_agg(to_jsonb(ui.*)), '[]'::jsonb)
      FROM (
        SELECT * FROM public.user_interactions ui
        WHERE ui.telegram_user_id = telegram_user_id_param
        ORDER BY ui.created_at DESC
        LIMIT 10
      ) ui
    ),
    'pending_payments', (
      SELECT COALESCE(jsonb_agg(to_jsonb(p.*)), '[]'::jsonb)
      FROM public.payments p
      JOIN public.bot_users bu ON bu.id = p.user_id
      WHERE bu.telegram_id = telegram_user_id_param
        AND p.status = 'pending'
    )
  )
  FROM public.bot_users bu
  WHERE bu.telegram_id = telegram_user_id_param;
$$;