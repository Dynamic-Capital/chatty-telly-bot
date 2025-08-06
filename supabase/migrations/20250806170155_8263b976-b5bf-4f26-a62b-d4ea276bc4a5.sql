-- Set admin status for the main user
UPDATE bot_users SET is_admin = true WHERE telegram_id = '225513686';

-- Add essential bot content if missing
INSERT INTO bot_content (content_key, content_value, description, created_by) VALUES 
('welcome_message', 'Welcome to Dynamic Capital VIP Bot! 🚀\n\nChoose an option below:', 'Main welcome message', 'system'),
('trading_results_channel', '@DynamicCapital_Results', 'Trading results channel username', 'system'),
('trading_results_channel_id', '@DynamicCapital_Results', 'Trading results channel ID for posting', 'system')
ON CONFLICT (content_key) DO NOTHING;

-- Add essential bot settings if missing  
INSERT INTO bot_settings (setting_key, setting_value, description) VALUES
('auto_delete_enabled', 'false', 'Enable automatic message deletion'),
('auto_delete_delay_seconds', '300', 'Delay before auto-deleting messages'),
('session_timeout_minutes', '30', 'User session timeout'),
('maintenance_mode', 'false', 'Bot maintenance mode'),
('welcome_auto_delete', 'false', 'Auto-delete welcome messages')
ON CONFLICT (setting_key) DO NOTHING;