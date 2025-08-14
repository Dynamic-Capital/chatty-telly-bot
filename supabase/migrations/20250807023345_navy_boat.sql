/*
  # Fix Welcome Message Templates and Content Management

  1. Ensure bot_content table has proper structure
  2. Insert default welcome message templates
  3. Add missing content entries for proper functionality
  4. Update RLS policies for content management
*/

-- Ensure bot_content table exists with proper structure
CREATE TABLE IF NOT EXISTS bot_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_key text UNIQUE NOT NULL,
  content_value text NOT NULL,
  content_type text DEFAULT 'text',
  description text,
  is_active boolean DEFAULT true,
  created_by text,
  last_modified_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE bot_content ENABLE ROW LEVEL SECURITY;

-- Create or update RLS policies
DROP POLICY IF EXISTS "Bot can manage content" ON bot_content;
CREATE POLICY "Bot can manage content"
  ON bot_content
  FOR ALL
  TO public
  USING (true);

-- Insert default welcome message if it doesn't exist
INSERT INTO bot_content (content_key, content_value, content_type, description, is_active, created_by, last_modified_by)
VALUES (
  'welcome_message',
  '🎯 Welcome to Dynamic Capital VIP Bot!

📈 Get premium trading signals & education
💎 Join our VIP community

👇 Choose what you need:',
  'text',
  'Main welcome message shown on /start command',
  true,
  'system',
  'system'
) ON CONFLICT (content_key) DO NOTHING;

-- Insert default welcome back message for returning users
INSERT INTO bot_content (content_key, content_value, content_type, description, is_active, created_by, last_modified_by)
VALUES (
  'welcome_back_message',
  '👋 Welcome back to Dynamic Capital VIP Bot!

🔥 VIP Packages:
• 1 Month – access to premium signals
• 3 Months – best value plan
• Lifetime – one-time payment for lifetime access

Available commands:
/start - Main menu
/packages - View VIP packages
/vip - VIP benefits
/help - Show help
/support - Contact support
/about - About us',
  'text',
  'Welcome message for returning users',
  true,
  'system',
  'system'
) ON CONFLICT (content_key) DO NOTHING;

-- Insert other essential content entries
INSERT INTO bot_content (content_key, content_value, content_type, description, is_active, created_by, last_modified_by)
VALUES 
(
  'about_us',
  '🏢 About Dynamic Capital

We are a leading trading education and signals provider with years of experience in financial markets.

Our mission is to help traders succeed through:
• Premium trading signals
• Educational resources  
• Community support
• Expert guidance',
  'text',
  'About us information',
  true,
  'system',
  'system'
),
(
  'support_message',
  '🛟 *Need Help?*

Our support team is here for you!

📧 Email: support@dynamiccapital.com
💬 Telegram: @DynamicCapital_Support
🕐 Support Hours: 24/7

We typically respond within 2-4 hours.',
  'text',
  'Support contact information',
  true,
  'system',
  'system'
),
(
  'help_message',
  '❓ Bot Commands & Help

Available commands:
/start - Main menu
/packages - View VIP packages
/vip - VIP benefits
/help - Show this help
/support - Contact support
/about - About us

Need assistance? Contact @DynamicCapital_Support',
  'text',
  'Help and commands information',
  true,
  'system',
  'system'
),
(
  'vip_benefits',
  '💎 VIP Membership Benefits

🚀 Premium Trading Signals
📊 Daily Market Analysis
💬 VIP Community Access
🎓 Educational Resources
📞 Priority Support
💰 Exclusive Promotions',
  'text',
  'VIP membership benefits description',
  true,
  'system',
  'system'
),
(
  'payment_instructions',
  '💳 Payment Instructions

We accept:
🏦 Bank Transfer
🪙 USDT (TRC20)
💳 Binance Pay

After payment, upload your receipt and we''ll activate your VIP access within 24 hours.',
  'text',
  'Payment methods and instructions',
  true,
  'system',
  'system'
)
ON CONFLICT (content_key) DO NOTHING;

-- Ensure only USDT (TRC20) crypto address is stored
DELETE FROM bot_content
WHERE content_key IN ('crypto_btc_address', 'crypto_eth_address', 'crypto_usdt_erc20');

INSERT INTO bot_content (content_key, content_value, content_type, description, is_active, created_by, last_modified_by)
VALUES (
  'crypto_usdt_trc20',
  'TQeAph1kiaVbwvY2NS1EwepqrnoTpK6Wss',
  'text',
  'USDT (TRC20) payment address',
  true,
  'system',
  'system'
)
ON CONFLICT (content_key) DO UPDATE
SET content_value = EXCLUDED.content_value,
    content_type = EXCLUDED.content_type,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active,
    last_modified_by = EXCLUDED.last_modified_by;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_bot_content_key_active 
ON bot_content (content_key, is_active);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_bot_content_updated_at ON bot_content;
CREATE TRIGGER update_bot_content_updated_at
    BEFORE UPDATE ON bot_content
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
