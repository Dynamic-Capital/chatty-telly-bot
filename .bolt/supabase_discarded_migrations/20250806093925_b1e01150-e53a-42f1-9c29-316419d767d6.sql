-- Create session tracking table
CREATE TABLE IF NOT EXISTS public.bot_sessions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    telegram_user_id TEXT NOT NULL,
    session_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    session_end TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER,
    activity_count INTEGER DEFAULT 0,
    session_data JSONB DEFAULT '{}',
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bot_sessions ENABLE ROW LEVEL SECURITY;

-- Create policy for bot to manage sessions
CREATE POLICY "Bot can manage sessions" ON public.bot_sessions
FOR ALL USING (true);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_bot_sessions_telegram_user_id ON public.bot_sessions(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_bot_sessions_session_start ON public.bot_sessions(session_start);
CREATE INDEX IF NOT EXISTS idx_bot_sessions_active ON public.bot_sessions(session_end) WHERE session_end IS NULL;

-- Create trigger for updating updated_at
CREATE TRIGGER update_bot_sessions_updated_at
    BEFORE UPDATE ON public.bot_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Create auto reply templates if not exists
INSERT INTO public.bot_content (content_key, content_value, description, content_type) VALUES
('auto_reply_welcome', '🚀 Welcome to Dynamic Capital VIP, {firstName}! 

We''re excited to help you succeed in trading! 🎯

🌟 **What we offer:**
• 📈 Real-time trading signals
• 💎 VIP community access  
• 🎓 Professional education
• 💬 Expert mentorship
• 📊 Market analysis

Ready to get started? Choose an option below! 👇', 'Auto reply welcome message', 'text'),

('auto_reply_help', '❓ **Need Help?**

🤖 **Available Commands:**
• `/start` - Main menu
• `/admin` - Admin panel (admins only)
• `/help` - This help message
• `/status` - Bot status

💬 **Quick Actions:**
• View VIP packages
• Browse education courses
• Check promotions
• Contact support

🛟 **Need personal help?** 
Contact: @DynamicCapital_Support', 'Auto reply help message', 'text'),

('auto_reply_unknown', '🤔 I didn''t understand that command.

💡 **Try these instead:**
• `/start` - Return to main menu
• `/help` - Get help
• Use the buttons in my messages

🤖 I''m here to help with your trading journey!', 'Auto reply for unknown commands', 'text')

ON CONFLICT (content_key) DO UPDATE SET
content_value = EXCLUDED.content_value,
updated_at = now();

-- Insert default bot settings for session management
INSERT INTO public.bot_settings (setting_key, setting_value, description, setting_type) VALUES
('session_timeout_hours', '24', 'Session timeout in hours', 'number'),
('auto_session_cleanup', 'true', 'Automatically cleanup old sessions', 'boolean'),
('track_user_activity', 'true', 'Track detailed user activity', 'boolean'),
('session_warning_hours', '23', 'Warn user before session expires (hours)', 'number')
ON CONFLICT (setting_key) DO UPDATE SET
setting_value = EXCLUDED.setting_value,
updated_at = now();