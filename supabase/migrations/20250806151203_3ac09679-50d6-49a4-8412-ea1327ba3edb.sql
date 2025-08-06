-- Create storage buckets for broadcasting media
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('broadcast-media', 'broadcast-media', false, 52428800, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/mpeg', 'video/quicktime', 'video/webm']),
  ('temp-uploads', 'temp-uploads', false, 52428800, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/mpeg', 'video/quicktime', 'video/webm'])
ON CONFLICT (id) DO NOTHING;

-- RLS policies for broadcast media bucket
CREATE POLICY "Admins can upload broadcast media" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'broadcast-media' 
  AND EXISTS (
    SELECT 1 FROM public.bot_users 
    WHERE telegram_id = auth.jwt() ->> 'telegram_user_id' 
    AND is_admin = true
  )
);

CREATE POLICY "Admins can view broadcast media" ON storage.objects
FOR SELECT USING (
  bucket_id = 'broadcast-media'
  AND EXISTS (
    SELECT 1 FROM public.bot_users 
    WHERE telegram_id = auth.jwt() ->> 'telegram_user_id' 
    AND is_admin = true
  )
);

CREATE POLICY "Admins can delete broadcast media" ON storage.objects
FOR DELETE USING (
  bucket_id = 'broadcast-media'
  AND EXISTS (
    SELECT 1 FROM public.bot_users 
    WHERE telegram_id = auth.jwt() ->> 'telegram_user_id' 
    AND is_admin = true
  )
);

-- RLS policies for temp uploads bucket
CREATE POLICY "Anyone can upload to temp bucket" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'temp-uploads');

CREATE POLICY "Anyone can view temp uploads" ON storage.objects
FOR SELECT USING (bucket_id = 'temp-uploads');

CREATE POLICY "Service role can delete temp uploads" ON storage.objects
FOR DELETE USING (bucket_id = 'temp-uploads');

-- Add media columns to broadcast_messages table
ALTER TABLE public.broadcast_messages 
ADD COLUMN IF NOT EXISTS media_type TEXT CHECK (media_type IN ('image', 'video', 'document')),
ADD COLUMN IF NOT EXISTS media_url TEXT,
ADD COLUMN IF NOT EXISTS media_file_path TEXT,
ADD COLUMN IF NOT EXISTS media_file_size BIGINT,
ADD COLUMN IF NOT EXISTS media_mime_type TEXT;

-- Create function for fast stats with connection pooling optimization
CREATE OR REPLACE FUNCTION public.get_dashboard_stats_fast()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  WITH stats AS (
    SELECT 
      COUNT(*) FILTER (WHERE TRUE) as total_users,
      COUNT(*) FILTER (WHERE is_vip = true) as vip_users,
      COUNT(*) FILTER (WHERE is_admin = true) as admin_users
    FROM public.bot_users
  ),
  payment_stats AS (
    SELECT 
      COUNT(*) FILTER (WHERE status = 'pending') as pending_payments,
      COUNT(*) FILTER (WHERE status = 'completed') as completed_payments,
      COALESCE(SUM(amount) FILTER (WHERE status = 'completed'), 0) as total_revenue
    FROM public.payments
  ),
  activity_stats AS (
    SELECT 
      COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') as daily_interactions
    FROM public.user_interactions
  ),
  session_stats AS (
    SELECT 
      COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') as daily_sessions
    FROM public.bot_sessions
  )
  SELECT jsonb_build_object(
    'total_users', s.total_users,
    'vip_users', s.vip_users,
    'admin_users', s.admin_users,
    'pending_payments', ps.pending_payments,
    'completed_payments', ps.completed_payments,
    'total_revenue', ps.total_revenue,
    'daily_interactions', as_.daily_interactions,
    'daily_sessions', ss.daily_sessions,
    'last_updated', NOW()
  )
  FROM stats s, payment_stats ps, activity_stats as_, session_stats ss;
$$;

-- Create optimized batch upsert function for user interactions
CREATE OR REPLACE FUNCTION public.batch_insert_user_interactions(
  interactions jsonb
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $$
  INSERT INTO public.user_interactions (
    telegram_user_id, 
    interaction_type, 
    interaction_data, 
    session_id, 
    page_context,
    created_at
  )
  SELECT 
    (interaction->>'telegram_user_id')::text,
    (interaction->>'interaction_type')::text,
    (interaction->>'interaction_data')::jsonb,
    (interaction->>'session_id')::text,
    (interaction->>'page_context')::text,
    (interaction->>'created_at')::timestamptz
  FROM jsonb_array_elements(interactions) AS interaction;
$$;

-- Create cleanup function for old media files
CREATE OR REPLACE FUNCTION public.cleanup_old_media_files(
  cleanup_days INTEGER DEFAULT 14
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  cleanup_date TIMESTAMPTZ;
  deleted_count INTEGER := 0;
  freed_bytes BIGINT := 0;
  old_file RECORD;
BEGIN
  cleanup_date := NOW() - (cleanup_days || ' days')::INTERVAL;
  
  -- Get files to delete and calculate space
  FOR old_file IN
    SELECT name, metadata->>'size' as file_size, bucket_id
    FROM storage.objects 
    WHERE created_at < cleanup_date 
    AND bucket_id IN ('broadcast-media', 'temp-uploads', 'payment-receipts', 'bot-media')
  LOOP
    -- Delete from storage
    DELETE FROM storage.objects 
    WHERE name = old_file.name AND bucket_id = old_file.bucket_id;
    
    deleted_count := deleted_count + 1;
    freed_bytes := freed_bytes + COALESCE((old_file.file_size)::BIGINT, 0);
  END LOOP;
  
  -- Clean up related database records
  DELETE FROM public.media_files 
  WHERE created_at < cleanup_date;
  
  -- Clean up old broadcast messages
  DELETE FROM public.broadcast_messages 
  WHERE created_at < cleanup_date AND delivery_status = 'completed';
  
  RETURN jsonb_build_object(
    'deleted_files', deleted_count,
    'freed_bytes', freed_bytes,
    'freed_mb', ROUND(freed_bytes / 1024.0 / 1024.0, 2),
    'cleanup_date', cleanup_date,
    'cleanup_days', cleanup_days
  );
END;
$$;