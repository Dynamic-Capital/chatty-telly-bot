-- Add broadcasting content templates and settings
INSERT INTO bot_content (content_key, content_value, content_type, description, is_active) VALUES 
(
  'broadcast_greeting',
  '👋 *Hello Everyone!*

🎉 **Welcome to Dynamic Capital VIP!**

I''m your new trading assistant bot, here to help you:

🔔 **Stay Updated:**
• Real-time market alerts
• Trading signals and insights
• Educational content delivery

💰 **Maximize Profits:**
• VIP package access
• Exclusive trading strategies
• Direct mentor support

🚀 **Get Started:**
• Use /start to access the main menu
• Explore our VIP packages
• Join our community discussions

Looking forward to helping you succeed in trading! 📈

*Powered by Dynamic Capital Team* 💎',
  'text',
  'Default greeting message for broadcasting to channels',
  true
),
(
  'broadcast_intro',
  '🤖 *Bot Introduction*

📢 **Dynamic Capital VIP Bot is now LIVE!**

🎯 **What I can do for you:**

💎 **VIP Services:**
• Show available membership packages
• Process subscription requests  
• Provide member support

🎓 **Education Hub:**
• Access trading courses
• View learning materials
• Track your progress

📊 **Market Intelligence:**
• Real-time trading signals
• Market analysis updates
• Price alerts & notifications

🛟 **24/7 Support:**
• Answer frequently asked questions
• Connect you with support team
• Resolve account issues

**🚀 Get Started Now:**
Send me /start to explore all features!

*Ready to transform your trading journey?* 💰📈',
  'text',
  'Bot introduction message for new channels',
  true
),
(
  'auto_intro',
  '👋 *Hello {chatTitle}!*

🤖 **Dynamic Capital VIP Bot** is now active here!

🚀 **I''m here to help with:**
• 💎 VIP membership packages
• 🎓 Trading education resources  
• 📊 Market updates & signals
• 🛟 24/7 customer support

**🎯 Get started with /start**

*Thank you for adding me to your community!* 🙏',
  'text',
  'Automatic introduction when bot joins new chats',
  true
);

-- Add broadcasting settings
INSERT INTO bot_settings (setting_key, setting_value, setting_type, description, is_active) VALUES 
(
  'broadcast_channels',
  '',
  'string',
  'Comma-separated list of channel IDs for broadcasting (e.g. -1001234567890,-1001234567891)',
  true
),
(
  'auto_intro_enabled',
  'true',
  'boolean',
  'Enable automatic introduction when bot is added to new channels',
  true
),
(
  'broadcast_delay_ms',
  '1500',
  'number',
  'Delay between broadcast messages in milliseconds to avoid rate limiting',
  true
);