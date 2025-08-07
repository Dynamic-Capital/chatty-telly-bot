-- Fix remaining security issues

-- 1. Fix Function Search Path Mutable by setting search_path for existing functions
-- Update all existing functions to have proper search_path

-- Fix the existing functions to have secure search_path
ALTER FUNCTION public.update_education_updated_at_column() SET search_path TO '';
ALTER FUNCTION public.update_daily_analytics() SET search_path TO '';
ALTER FUNCTION public.handle_new_user() SET search_path TO '';
ALTER FUNCTION public.handle_updated_at() SET search_path TO '';
ALTER FUNCTION public.update_updated_at_column() SET search_path TO '';

-- Update the OTP helper function we just created
ALTER FUNCTION public.is_valid_otp_timeframe() SET search_path TO '';

-- 2. Address extension in public schema issue
-- Check if there are any extensions in public and recommend moving them
-- Most commonly this affects extensions like uuid-ossp, but we'll handle it properly

-- Create a function to check for extensions in public schema
CREATE OR REPLACE FUNCTION public.check_extensions_in_public()
RETURNS TABLE(extension_name name, schema_name name)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT e.extname, n.nspname
  FROM pg_extension e
  JOIN pg_namespace n ON e.extnamespace = n.oid
  WHERE n.nspname = 'public';
$$;

-- Note: The auth OTP expiry needs to be fixed in Supabase dashboard settings
-- This cannot be fixed via SQL migration as it's a platform configuration

-- Add additional security functions for the bot
CREATE OR REPLACE FUNCTION public.validate_telegram_user_id(telegram_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  -- Validate telegram user ID format (should be numeric)
  SELECT telegram_id ~ '^[0-9]+$' AND length(telegram_id) <= 20;
$$;

-- Function to safely get user role (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.get_user_role(user_telegram_id text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT CASE 
    WHEN bu.is_admin = true THEN 'admin'
    WHEN bu.is_vip = true THEN 'vip'
    ELSE 'user'
  END
  FROM public.bot_users bu
  WHERE bu.telegram_id = user_telegram_id
  LIMIT 1;
$$;

-- Function to check if user is admin (security definer to avoid RLS issues)
CREATE OR REPLACE FUNCTION public.is_user_admin(user_telegram_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT COALESCE((
    SELECT is_admin 
    FROM public.bot_users 
    WHERE telegram_id = user_telegram_id
  ), false);
$$;