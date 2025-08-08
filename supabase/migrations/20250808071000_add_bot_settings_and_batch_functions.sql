/*
  # Add Bot Settings Table and Batch Fetch Functions

  1. Create bot_settings table for configurable bot behavior
  2. Enable RLS and add policy for bot access
  3. Seed table with default settings
  4. Add index and updated_at trigger
  5. Create helper functions for batch fetching content and settings
*/

-- 1. Create bot_settings table
CREATE TABLE IF NOT EXISTS bot_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text UNIQUE NOT NULL,
  setting_value text NOT NULL,
  setting_type text DEFAULT 'text',
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE bot_settings ENABLE ROW LEVEL SECURITY;

-- Policy allowing bot management
DROP POLICY IF EXISTS "Bot can manage settings" ON bot_settings;
CREATE POLICY "Bot can manage settings"
  ON bot_settings
  FOR ALL
  TO public
  USING (true);

-- Seed default settings
INSERT INTO bot_settings (setting_key, setting_value, setting_type, description, is_active)
VALUES
  ('session_timeout_minutes', '30', 'number', 'Minutes before inactive session expires', true),
  ('follow_up_delay_minutes', '60', 'number', 'Minutes between follow-up messages', true),
  ('max_follow_ups', '3', 'number', 'Maximum number of follow-up messages', true),
  ('maintenance_mode', 'false', 'boolean', 'Enable maintenance mode for bot', true),
  ('auto_welcome', 'true', 'boolean', 'Automatically send welcome message to new users', true),
  ('admin_notifications', 'true', 'boolean', 'Send notifications to admins', true),
  ('auto_delete_delay_seconds', '10', 'number', 'Delay before auto deleting bot messages', true)
ON CONFLICT (setting_key) DO NOTHING;

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_bot_settings_key_active
  ON bot_settings (setting_key, is_active);

-- Trigger to maintain updated_at
DROP TRIGGER IF EXISTS update_bot_settings_updated_at ON bot_settings;
CREATE TRIGGER update_bot_settings_updated_at
  BEFORE UPDATE ON bot_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 2. Batch content fetch helper
CREATE OR REPLACE FUNCTION get_bot_content_batch(content_keys text[])
RETURNS TABLE (content_key text, content_value text)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT content_key, content_value
  FROM bot_content
  WHERE content_key = ANY(content_keys)
    AND is_active = true;
$$;

-- 3. Batch settings fetch helper
CREATE OR REPLACE FUNCTION get_bot_settings_batch(setting_keys text[])
RETURNS TABLE (setting_key text, setting_value text)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT setting_key, setting_value
  FROM bot_settings
  WHERE setting_key = ANY(setting_keys)
    AND is_active = true;
$$;
