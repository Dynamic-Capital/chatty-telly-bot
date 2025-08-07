/*
  # Improve default bot messages for beginner-friendly experience

  - Update welcome message with clearer guidance
  - Add package_info and promo_info content templates
*/

INSERT INTO bot_content (content_key, content_value, content_type, description, is_active, created_by, last_modified_by)
VALUES
  (
    'welcome_message',
    '👋 Welcome to Dynamic Capital VIP Bot!\n\n🚀 Ready to boost your trading journey?\n\n📦 Browse VIP packages\n🎁 Apply promo codes\n📚 Access education\n\nUse the menu below to get started ⬇️',
    'text',
    'Updated friendly welcome message',
    true,
    'system',
    'system'
  ),
  (
    'package_info',
    '📦 VIP Packages\n\nPick a plan that fits your goals:\n• Monthly signals\n• Lifetime access\n• Education bundles\n\nUse /vip to view current offers.',
    'text',
    'Info about subscription packages',
    true,
    'system',
    'system'
  ),
  (
    'promo_info',
    '🎁 Promo Codes\n\nHave a discount code? Send it during checkout to save!\n\nTip: Watch our channel for new promotions.',
    'text',
    'Info about promo code usage',
    true,
    'system',
    'system'
  )
ON CONFLICT (content_key) DO UPDATE
  SET content_value = EXCLUDED.content_value,
      updated_at = now(),
      last_modified_by = 'system';
