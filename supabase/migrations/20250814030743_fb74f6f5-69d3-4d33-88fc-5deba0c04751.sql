-- Fix telegram webhook configuration
-- Insert the webhook secret into bot_settings if it doesn't exist
INSERT INTO bot_settings (setting_key, setting_value, is_active) 
VALUES ('TELEGRAM_WEBHOOK_SECRET', 'telegram_webhook_secret_placeholder', true)
ON CONFLICT (setting_key) DO UPDATE SET 
  setting_value = EXCLUDED.setting_value,
  is_active = true,
  updated_at = now();

-- Also add the mini app URL setting
INSERT INTO bot_settings (setting_key, setting_value, is_active) 
VALUES ('MINI_APP_URL', 'https://qeejuomcapbdlhnjqjcc.functions.supabase.co/miniapp/', true)
ON CONFLICT (setting_key) DO UPDATE SET 
  setting_value = EXCLUDED.setting_value,
  is_active = true,
  updated_at = now();

-- Add welcome message setting if missing
INSERT INTO bot_settings (setting_key, setting_value, is_active) 
VALUES ('WELCOME_MESSAGE', 'Welcome to Dynamic Capital VIP Bot! 🚀\n\nUse /start to begin or click the menu button below to access our services.', true)
ON CONFLICT (setting_key) DO UPDATE SET 
  setting_value = EXCLUDED.setting_value,
  is_active = true,
  updated_at = now();