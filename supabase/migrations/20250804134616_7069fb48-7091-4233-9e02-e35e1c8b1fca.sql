-- Add missing notes column to bot_users table
ALTER TABLE public.bot_users 
ADD COLUMN notes TEXT;

-- Add index for better performance on notes queries
CREATE INDEX IF NOT EXISTS idx_bot_users_notes ON public.bot_users(notes) WHERE notes IS NOT NULL;