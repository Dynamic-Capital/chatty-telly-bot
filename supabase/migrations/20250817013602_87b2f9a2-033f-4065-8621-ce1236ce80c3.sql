-- Fix critical security issue: user_sessions table lacks proper RLS policies
-- This prevents unauthorized access to active user sessions and session hijacking

-- Add policy for users to view only their own sessions
CREATE POLICY "Users can view their own sessions" 
ON public.user_sessions 
FOR SELECT 
USING (
  telegram_user_id IN (
    SELECT telegram_id 
    FROM public.bot_users 
    WHERE id = auth.uid()
  )
);

-- Add policy for users to insert their own sessions
CREATE POLICY "Users can create their own sessions"
ON public.user_sessions 
FOR INSERT 
WITH CHECK (
  telegram_user_id IN (
    SELECT telegram_id 
    FROM public.bot_users 
    WHERE id = auth.uid()
  )
);

-- Add policy for users to update their own sessions
CREATE POLICY "Users can update their own sessions"
ON public.user_sessions 
FOR UPDATE 
USING (
  telegram_user_id IN (
    SELECT telegram_id 
    FROM public.bot_users 
    WHERE id = auth.uid()
  )
);

-- Add policy for admins to manage all sessions
CREATE POLICY "Admins can manage all sessions"
ON public.user_sessions 
FOR ALL
USING (
  EXISTS (
    SELECT 1 
    FROM public.bot_users 
    WHERE id = auth.uid() 
    AND is_admin = true
  )
);

-- Add index for performance on telegram_user_id lookups
CREATE INDEX IF NOT EXISTS idx_user_sessions_telegram_user_id 
ON public.user_sessions(telegram_user_id);

-- Add index for active session queries
CREATE INDEX IF NOT EXISTS idx_user_sessions_active 
ON public.user_sessions(telegram_user_id, is_active) 
WHERE is_active = true;