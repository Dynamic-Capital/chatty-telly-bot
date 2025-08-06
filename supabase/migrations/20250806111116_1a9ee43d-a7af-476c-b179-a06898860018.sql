-- Add auto-deletion settings for groups
INSERT INTO bot_settings (setting_key, setting_value, setting_type, description, is_active) VALUES 
(
  'auto_delete_enabled',
  'true',
  'boolean',
  'Enable automatic deletion of bot messages in groups after specified time',
  true
),
(
  'auto_delete_delay_seconds',
  '30',
  'number',
  'Number of seconds to wait before deleting bot messages in groups',
  true
);