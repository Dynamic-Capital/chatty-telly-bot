/*
  # Add default auto reply templates

  - insert beginner-friendly templates for welcome, help, unknown command, and general messages
*/
INSERT INTO auto_reply_templates (name, trigger_type, message_template, is_active, display_order)
VALUES
  ('auto_reply_welcome', 'system', '👋 Hey {{firstName}}! Welcome aboard 🚀\nUse /start anytime to open the main menu.', true, 1),
  ('auto_reply_help', 'command', '❓ **Need Help?**\n\nUse /start for the main menu.\n🛟 Support: @DynamicCapital_Support', true, 2),
  ('auto_reply_unknown', 'fallback', '🤔 I\'m not sure what you meant.\nTry /start for options or /help for commands.', true, 3),
  ('auto_reply_general', 'general', '🤖 Thanks for your message! Use /start to see what I can do.', true, 4)
ON CONFLICT (name) DO UPDATE
  SET message_template = EXCLUDED.message_template,
      updated_at = now();
