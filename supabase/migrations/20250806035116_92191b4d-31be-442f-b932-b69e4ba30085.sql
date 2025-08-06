-- Create content management tables for dynamic bot content
CREATE TABLE public.bot_content (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    content_key TEXT NOT NULL UNIQUE,
    content_value TEXT NOT NULL,
    content_type TEXT NOT NULL DEFAULT 'text',
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by TEXT,
    last_modified_by TEXT
);

-- Create bot settings table for configurable parameters
CREATE TABLE public.bot_settings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    setting_key TEXT NOT NULL UNIQUE,
    setting_value TEXT NOT NULL,
    setting_type TEXT NOT NULL DEFAULT 'string',
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create admin logs table for tracking admin actions
CREATE TABLE public.admin_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    admin_telegram_id TEXT NOT NULL,
    action_type TEXT NOT NULL,
    action_description TEXT NOT NULL,
    affected_table TEXT,
    affected_record_id UUID,
    old_values JSONB,
    new_values JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.bot_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Bot can manage content" ON public.bot_content FOR ALL USING (true);
CREATE POLICY "Bot can manage settings" ON public.bot_settings FOR ALL USING (true);
CREATE POLICY "Bot can manage admin logs" ON public.admin_logs FOR ALL USING (true);

-- Create indexes for better performance
CREATE INDEX idx_bot_content_key ON public.bot_content(content_key);
CREATE INDEX idx_bot_settings_key ON public.bot_settings(setting_key);
CREATE INDEX idx_admin_logs_admin_id ON public.admin_logs(admin_telegram_id);
CREATE INDEX idx_admin_logs_action_type ON public.admin_logs(action_type);

-- Add triggers for updated_at
CREATE TRIGGER update_bot_content_updated_at
    BEFORE UPDATE ON public.bot_content
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bot_settings_updated_at
    BEFORE UPDATE ON public.bot_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default content values
INSERT INTO public.bot_content (content_key, content_value, content_type, description) VALUES
('welcome_message', '🚀 *Welcome to Dynamic Capital VIP, {firstName}!*\n\nWe''re here to help you level up your trading with:\n\n• 🔔 Quick market updates\n• 📈 Beginner-friendly tips\n• 🎓 Easy learning resources\n\nReady to get started? Pick an option below 👇', 'text', 'Main welcome message shown on /start'),
('about_us', '🏢 *About Dynamic Capital*\n\nWe are a leading trading education platform dedicated to empowering traders with:\n\n• 📊 Professional market analysis\n• 🎓 Comprehensive education programs\n• 💼 VIP trading communities\n• 🤝 Personalized support\n\nJoin thousands of successful traders worldwide!', 'text', 'About us information'),
('support_message', '🛟 *Need Help?*\n\nOur support team is here for you!\n\n📧 Email: support@dynamiccapital.com\n💬 Telegram: @DynamicCapital_Support\n🕐 Support Hours: 24/7\n\nWe typically respond within 2-4 hours.', 'text', 'Support contact information'),
('terms_conditions', '📋 *Terms & Conditions*\n\nBy using our services, you agree to:\n\n• 🔒 Our privacy policy\n• 📊 Risk disclosures for trading\n• 💼 Service usage guidelines\n• 🚫 No financial advice disclaimer\n\nFull terms available at: dynamiccapital.com/terms', 'text', 'Terms and conditions'),
('faq_general', '❓ *Frequently Asked Questions*\n\n**Q: How do I upgrade to VIP?**\nA: Choose a VIP package and complete payment\n\n**Q: What payment methods do you accept?**\nA: Binance Pay, Bank Transfer, and Volet\n\n**Q: Can I cancel my subscription?**\nA: Yes, contact support for cancellation\n\n**Q: Do you offer refunds?**\nA: Refunds are considered case-by-case', 'text', 'General FAQ content');

-- Insert default bot settings
INSERT INTO public.bot_settings (setting_key, setting_value, setting_type, description) VALUES
('session_timeout_minutes', '30', 'number', 'User session timeout in minutes'),
('follow_up_delay_minutes', '10', 'number', 'Delay before sending follow-up messages'),
('max_follow_ups', '3', 'number', 'Maximum number of follow-up messages'),
('admin_notifications', 'true', 'boolean', 'Enable admin notifications for new users'),
('auto_welcome', 'true', 'boolean', 'Automatically send welcome message on /start'),
('maintenance_mode', 'false', 'boolean', 'Bot maintenance mode'),
('payment_reminder_hours', '24', 'number', 'Hours before payment reminder'),
('receipt_upload_enabled', 'true', 'boolean', 'Allow receipt uploads');

-- Fix database function search paths for security
ALTER FUNCTION public.update_updated_at_column() SET search_path = '';
ALTER FUNCTION public.update_education_updated_at_column() SET search_path = '';
ALTER FUNCTION public.update_daily_analytics() SET search_path = '';