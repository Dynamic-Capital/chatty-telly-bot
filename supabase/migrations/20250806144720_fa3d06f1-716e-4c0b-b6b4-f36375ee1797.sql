-- Additional security enhancements for sensitive data protection

-- Ensure payments table has proper RLS
DROP POLICY IF EXISTS "Bot can manage payments" ON public.payments;
CREATE POLICY "Service role can manage payments" ON public.payments FOR ALL USING (true);

-- Ensure user_subscriptions has proper protection 
DROP POLICY IF EXISTS "Bot can manage user subscriptions" ON public.user_subscriptions;
CREATE POLICY "Service role can manage user subscriptions" ON public.user_subscriptions FOR ALL USING (true);

-- Ensure bot_users sensitive data is protected
DROP POLICY IF EXISTS "Bot can manage users" ON public.bot_users;
CREATE POLICY "Service role can manage bot users" ON public.bot_users FOR ALL USING (true);

-- Ensure media files (receipts) are protected
DROP POLICY IF EXISTS "Bot can manage media files" ON public.media_files;
CREATE POLICY "Service role can manage media files" ON public.media_files FOR ALL USING (true);

-- Ensure education enrollments are protected
DROP POLICY IF EXISTS "Bot can manage enrollments" ON public.education_enrollments;
CREATE POLICY "Service role can manage education enrollments" ON public.education_enrollments FOR ALL USING (true);

-- Ensure admin logs are properly protected
DROP POLICY IF EXISTS "Bot can manage admin logs" ON public.admin_logs;
CREATE POLICY "Service role can manage admin logs" ON public.admin_logs FOR ALL USING (true);

-- Ensure user sessions are protected
DROP POLICY IF EXISTS "Bot can manage user sessions" ON public.user_sessions;
CREATE POLICY "Service role can manage user sessions" ON public.user_sessions FOR ALL USING (true);

-- Ensure bot sessions are protected
DROP POLICY IF EXISTS "Bot can manage sessions" ON public.bot_sessions;
CREATE POLICY "Service role can manage bot sessions" ON public.bot_sessions FOR ALL USING (true);

-- Ensure user interactions are protected
DROP POLICY IF EXISTS "Bot can manage user interactions" ON public.user_interactions;
CREATE POLICY "Service role can manage user interactions" ON public.user_interactions FOR ALL USING (true);

-- Ensure conversion tracking is protected
DROP POLICY IF EXISTS "Bot can manage conversion tracking" ON public.conversion_tracking;
CREATE POLICY "Service role can manage conversion tracking" ON public.conversion_tracking FOR ALL USING (true);

-- Ensure promo analytics are protected
DROP POLICY IF EXISTS "Bot can manage promo analytics" ON public.promo_analytics;
CREATE POLICY "Service role can manage promo analytics" ON public.promo_analytics FOR ALL USING (true);

-- Ensure promotion usage is protected
DROP POLICY IF EXISTS "Bot can manage promotion usage" ON public.promotion_usage;
CREATE POLICY "Service role can manage promotion usage" ON public.promotion_usage FOR ALL USING (true);

-- Ensure daily analytics are protected
DROP POLICY IF EXISTS "Bot can manage daily analytics" ON public.daily_analytics;
CREATE POLICY "Service role can manage daily analytics" ON public.daily_analytics FOR ALL USING (true);

-- Ensure user surveys are protected
DROP POLICY IF EXISTS "Bot can manage user surveys" ON public.user_surveys;
CREATE POLICY "Service role can manage user surveys" ON public.user_surveys FOR ALL USING (true);

-- Ensure broadcast messages are protected
DROP POLICY IF EXISTS "Bot can manage broadcast messages" ON public.broadcast_messages;
CREATE POLICY "Service role can manage broadcast messages" ON public.broadcast_messages FOR ALL USING (true);

-- Create function to check if current user is service role
CREATE OR REPLACE FUNCTION public.is_service_role()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT current_setting('role') = 'service_role';
$$;

-- Add function to get masked payment data for admins only
CREATE OR REPLACE FUNCTION public.get_masked_payment_info(payment_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT CASE 
    WHEN public.is_user_admin(auth.jwt() ->> 'telegram_user_id') THEN
      jsonb_build_object(
        'id', p.id,
        'amount', p.amount,
        'currency', p.currency,
        'status', p.status,
        'payment_method', p.payment_method,
        'created_at', p.created_at,
        'masked_provider_id', LEFT(p.payment_provider_id, 4) || '****'
      )
    ELSE
      jsonb_build_object('error', 'Access denied')
  END
  FROM public.payments p
  WHERE p.id = payment_id;
$$;