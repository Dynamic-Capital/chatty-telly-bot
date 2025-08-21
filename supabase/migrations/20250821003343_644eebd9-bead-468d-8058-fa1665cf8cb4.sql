-- Security Fix 1: Create security definer function to check user roles safely
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Security Fix 2: Create function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS BOOLEAN AS $$
  SELECT COALESCE((
    SELECT role = 'admin' 
    FROM public.profiles 
    WHERE id = auth.uid()
  ), false);
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Security Fix 3: Drop all existing overly permissive RLS policies
DROP POLICY IF EXISTS "Service role can manage bot users" ON public.bot_users;
DROP POLICY IF EXISTS "Service role can manage payments" ON public.payments;
DROP POLICY IF EXISTS "Service role can manage user subscriptions" ON public.user_subscriptions;
DROP POLICY IF EXISTS "Service role can manage admin logs" ON public.admin_logs;
DROP POLICY IF EXISTS "Authenticated users can read active settings" ON public.bot_settings;

-- Security Fix 4: Create secure RLS policies for bot_users
CREATE POLICY "Admins can manage all bot users" ON public.bot_users
  FOR ALL TO authenticated
  USING (public.is_current_user_admin());

CREATE POLICY "Service role only for bot users" ON public.bot_users
  FOR ALL TO service_role
  USING (true);

-- Security Fix 5: Create secure RLS policies for payments
CREATE POLICY "Admins can view all payments" ON public.payments
  FOR SELECT TO authenticated
  USING (public.is_current_user_admin());

CREATE POLICY "Service role only for payments" ON public.payments
  FOR ALL TO service_role
  USING (true);

-- Security Fix 6: Create secure RLS policies for user_subscriptions
CREATE POLICY "Admins can manage all subscriptions" ON public.user_subscriptions
  FOR ALL TO authenticated
  USING (public.is_current_user_admin());

CREATE POLICY "Service role only for subscriptions" ON public.user_subscriptions
  FOR ALL TO service_role
  USING (true);

-- Security Fix 7: Create secure RLS policies for admin_logs
CREATE POLICY "Admins can view admin logs" ON public.admin_logs
  FOR SELECT TO authenticated
  USING (public.is_current_user_admin());

CREATE POLICY "Service role only for admin logs" ON public.admin_logs
  FOR ALL TO service_role
  USING (true);

-- Security Fix 8: Secure bot_settings to hide sensitive data
CREATE POLICY "Admins can view all bot settings" ON public.bot_settings
  FOR SELECT TO authenticated
  USING (public.is_current_user_admin());

CREATE POLICY "Public can view non-sensitive bot settings" ON public.bot_settings
  FOR SELECT TO authenticated
  USING (
    is_active = true AND 
    setting_key NOT IN ('TELEGRAM_WEBHOOK_SECRET', 'ADMIN_API_SECRET', 'OPENAI_API_KEY', 'BINANCE_API_KEY', 'BINANCE_SECRET_KEY')
  );

CREATE POLICY "Service role only for bot settings" ON public.bot_settings
  FOR ALL TO service_role
  USING (true);

-- Security Fix 9: Fix privilege escalation in profiles
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Users can update their own profile except role" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id AND 
    (OLD.role IS NULL OR NEW.role = OLD.role) -- Prevent role changes
  );

CREATE POLICY "Admins can update all profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.is_current_user_admin());

-- Security Fix 10: Create secure function for webhook secret validation
CREATE OR REPLACE FUNCTION public.get_webhook_secret_secure()
RETURNS TEXT AS $$
DECLARE
  secret TEXT;
BEGIN
  -- Only allow service role to access webhook secret
  IF current_setting('role') != 'service_role' THEN
    RAISE EXCEPTION 'Access denied: webhook secret access restricted';
  END IF;
  
  SELECT setting_value INTO secret
  FROM public.bot_settings
  WHERE setting_key = 'TELEGRAM_WEBHOOK_SECRET' 
    AND is_active = true
  LIMIT 1;
  
  RETURN secret;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;