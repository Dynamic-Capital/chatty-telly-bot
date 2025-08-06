-- Create user_sessions table for session management
CREATE TABLE public.user_sessions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    telegram_user_id TEXT NOT NULL,
    session_data JSONB,
    awaiting_input TEXT,
    package_data JSONB,
    promo_data JSONB,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_activity TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    ended_at TIMESTAMP WITH TIME ZONE,
    end_reason TEXT
);

-- Add missing columns to bot_users table for follow-up functionality
ALTER TABLE public.bot_users 
ADD COLUMN IF NOT EXISTS follow_up_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_follow_up TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- Enable RLS on user_sessions
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user_sessions
CREATE POLICY "Bot can manage user sessions" 
ON public.user_sessions 
FOR ALL 
USING (true);

-- Create index for better performance on common queries
CREATE INDEX idx_user_sessions_telegram_user_id ON public.user_sessions(telegram_user_id);
CREATE INDEX idx_user_sessions_active ON public.user_sessions(is_active, last_activity);
CREATE INDEX idx_bot_users_follow_up ON public.bot_users(follow_up_count, updated_at);

-- Update updated_at trigger for user_sessions
CREATE TRIGGER update_user_sessions_updated_at
    BEFORE UPDATE ON public.user_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();