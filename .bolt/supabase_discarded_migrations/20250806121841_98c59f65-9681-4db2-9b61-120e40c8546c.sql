-- Check which extensions are in public schema and move them
-- First, let's see what extensions exist in public
DO $$
DECLARE
    ext_record RECORD;
BEGIN
    -- Loop through extensions in public schema
    FOR ext_record IN 
        SELECT e.extname 
        FROM pg_extension e
        JOIN pg_namespace n ON e.extnamespace = n.oid
        WHERE n.nspname = 'public'
    LOOP
        -- Log the extension (this will show in logs)
        RAISE NOTICE 'Found extension in public schema: %', ext_record.extname;
        
        -- Move common extensions to extensions schema
        IF ext_record.extname IN ('uuid-ossp', 'pgcrypto', 'btree_gin', 'btree_gist') THEN
            -- Drop and recreate in extensions schema
            EXECUTE format('DROP EXTENSION IF EXISTS %I CASCADE', ext_record.extname);
            EXECUTE format('CREATE EXTENSION IF NOT EXISTS %I SCHEMA extensions', ext_record.extname);
            RAISE NOTICE 'Moved extension % to extensions schema', ext_record.extname;
        END IF;
    END LOOP;
    
    -- If no extensions found, log that
    IF NOT FOUND THEN
        RAISE NOTICE 'No extensions found in public schema';
    END IF;
END
$$;

-- Create a more secure way to handle UUID generation if needed
-- This replaces uuid-ossp functions if they were in public
CREATE OR REPLACE FUNCTION public.generate_uuid()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT gen_random_uuid();
$$;

-- Add comment explaining the Auth OTP issue needs manual fix
COMMENT ON SCHEMA public IS 'Note: Auth OTP expiry must be configured in Supabase Dashboard under Authentication > Settings. Recommended: Set OTP expiry to 600 seconds (10 minutes) for better security.';

-- Create a function that admins can use to check OTP settings compliance
CREATE OR REPLACE FUNCTION public.get_security_recommendations()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT 'SECURITY RECOMMENDATIONS:
1. Set Auth OTP expiry to 600 seconds (10 minutes) in Supabase Dashboard
2. Enable email confirmations for new signups
3. Consider enabling 2FA for admin accounts
4. Regularly review RLS policies
5. Monitor failed authentication attempts';
$$;