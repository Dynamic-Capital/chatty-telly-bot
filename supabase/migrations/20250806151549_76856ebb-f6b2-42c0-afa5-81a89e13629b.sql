-- Create storage buckets for media files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES 
  ('broadcast-media', 'broadcast-media', false, 52428800, ARRAY['image/*', 'video/*']),
  ('temp-uploads', 'temp-uploads', false, 52428800, ARRAY['image/*', 'video/*']);

-- Storage policies for broadcast media
CREATE POLICY "Admins can upload broadcast media"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'broadcast-media' AND 
  EXISTS (SELECT 1 FROM public.bot_users WHERE telegram_id = auth.jwt() ->> 'telegram_user_id' AND is_admin = true)
);

CREATE POLICY "Admins can view broadcast media"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'broadcast-media' AND
  EXISTS (SELECT 1 FROM public.bot_users WHERE telegram_id = auth.jwt() ->> 'telegram_user_id' AND is_admin = true)
);

CREATE POLICY "Service role can manage broadcast media"
ON storage.objects FOR ALL
USING (bucket_id = 'broadcast-media');

-- Temp uploads policies
CREATE POLICY "Service role can manage temp uploads"
ON storage.objects FOR ALL
USING (bucket_id = 'temp-uploads');

-- Add media fields to broadcast_messages table
ALTER TABLE public.broadcast_messages 
ADD COLUMN media_type text,
ADD COLUMN media_url text,
ADD COLUMN media_file_path text,
ADD COLUMN media_caption text;

-- Fast dashboard stats function (optimized)
CREATE OR REPLACE FUNCTION public.get_dashboard_stats_fast()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  WITH stats AS (
    SELECT 
      COUNT(*) FILTER (WHERE true) as total_users,
      COUNT(*) FILTER (WHERE is_vip = true) as vip_users,
      COUNT(*) FILTER (WHERE is_admin = true) as admin_users,
      COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') as new_users_today
    FROM public.bot_users
  ),
  payment_stats AS (
    SELECT 
      COUNT(*) FILTER (WHERE status = 'pending') as pending_payments,
      COUNT(*) FILTER (WHERE status = 'completed') as completed_payments,
      COALESCE(SUM(amount) FILTER (WHERE status = 'completed'), 0) as total_revenue,
      COALESCE(SUM(amount) FILTER (WHERE status = 'completed' AND created_at >= NOW() - INTERVAL '24 hours'), 0) as today_revenue
    FROM public.payments
  ),
  interaction_stats AS (
    SELECT 
      COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') as daily_interactions,
      COUNT(DISTINCT telegram_user_id) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') as active_users_today
    FROM public.user_interactions
  )
  SELECT jsonb_build_object(
    'total_users', s.total_users,
    'vip_users', s.vip_users, 
    'admin_users', s.admin_users,
    'new_users_today', s.new_users_today,
    'pending_payments', p.pending_payments,
    'completed_payments', p.completed_payments,
    'total_revenue', p.total_revenue,
    'today_revenue', p.today_revenue,
    'daily_interactions', i.daily_interactions,
    'active_users_today', i.active_users_today,
    'last_updated', NOW()
  )
  FROM stats s, payment_stats p, interaction_stats i;
$function$;

-- Batch insert function for user interactions (performance optimization)
CREATE OR REPLACE FUNCTION public.batch_insert_user_interactions(interactions jsonb[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  INSERT INTO public.user_interactions (
    telegram_user_id, 
    interaction_type, 
    interaction_data, 
    session_id, 
    page_context
  )
  SELECT 
    (interaction->>'telegram_user_id')::text,
    (interaction->>'interaction_type')::text,
    (interaction->'interaction_data')::jsonb,
    (interaction->>'session_id')::text,
    (interaction->>'page_context')::text
  FROM unnest(interactions) AS interaction
  ON CONFLICT DO NOTHING;
END;
$function$;

-- Media cleanup function
CREATE OR REPLACE FUNCTION public.cleanup_old_media_files(retention_days integer DEFAULT 14)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  cleanup_result jsonb;
  deleted_count integer := 0;
  file_record record;
BEGIN
  -- Get old media files from broadcast messages
  FOR file_record IN 
    SELECT media_file_path, id 
    FROM public.broadcast_messages 
    WHERE media_file_path IS NOT NULL 
    AND created_at < NOW() - (retention_days || ' days')::interval
  LOOP
    -- Delete from storage (this would need to be handled by the edge function)
    UPDATE public.broadcast_messages 
    SET media_file_path = NULL, media_url = NULL 
    WHERE id = file_record.id;
    
    deleted_count := deleted_count + 1;
  END LOOP;

  -- Clean up orphaned media files records
  DELETE FROM public.media_files 
  WHERE created_at < NOW() - (retention_days || ' days')::interval;

  SELECT jsonb_build_object(
    'deleted_broadcast_media', deleted_count,
    'cleanup_date', NOW(),
    'retention_days', retention_days
  ) INTO cleanup_result;

  RETURN cleanup_result;
END;
$function$;

-- Fast content batch retrieval (optimized)
CREATE OR REPLACE FUNCTION public.get_bot_content_fast(content_keys text[])
RETURNS TABLE(content_key text, content_value text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT bc.content_key, bc.content_value
  FROM public.bot_content bc
  WHERE bc.content_key = ANY(content_keys)
    AND bc.is_active = true;
$function$;

-- Performance indexes for optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bot_users_lookup ON public.bot_users(telegram_id, is_admin, is_vip);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_status_date ON public.payments(status, created_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_interactions_user_date ON public.user_interactions(telegram_user_id, created_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_broadcast_messages_media ON public.broadcast_messages(media_file_path, created_at) WHERE media_file_path IS NOT NULL;