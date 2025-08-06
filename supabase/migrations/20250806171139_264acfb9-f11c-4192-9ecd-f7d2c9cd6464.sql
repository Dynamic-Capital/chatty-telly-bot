-- Update all bot content to be beginner-friendly, short, and with icons
UPDATE bot_content SET content_value = CASE content_key
  WHEN 'welcome_message' THEN '🎯 Welcome to Dynamic Capital VIP Bot!\n\n📈 Get premium trading signals & education\n💎 Join our VIP community\n\n👇 Choose what you need:'
  
  WHEN 'vip_benefits' THEN '💎 VIP Benefits:\n\n📊 Premium trading signals\n🎯 Market analysis\n📚 Trading education\n💬 VIP community access\n🏆 Expert support'
  
  WHEN 'contact_info' THEN '📞 Follow us for updates:\n\n📸 Instagram: @dynamic.capital\n📘 Facebook: Dynamic Capital\n📊 TradingView: DynamicCapital-FX\n🎵 TikTok: @the.wandering.trader'
  
  WHEN 'faq_general' THEN '❓ Common Questions:\n\n• What is VIP? Premium trading community\n• How to join? Choose a plan below\n• Payment methods? Bank transfer or crypto\n• Support? Contact us anytime!\n\n💡 Need help? Ask anything!'
  
  WHEN 'payment_instructions' THEN '💳 How to Pay:\n\n1️⃣ Choose your plan\n2️⃣ Make payment\n3️⃣ Upload receipt\n4️⃣ Get instant access!\n\n✅ Simple & secure'
  
  WHEN 'risk_disclaimer' THEN '⚠️ Important Notice:\n\nTrading involves risk. Only invest what you can afford to lose.\n\n📚 Always do your research\n💡 Start small as a beginner'
  
  ELSE content_value
END
WHERE content_key IN ('welcome_message', 'vip_benefits', 'contact_info', 'faq_general', 'payment_instructions', 'risk_disclaimer');

-- Add more beginner-friendly content
INSERT INTO bot_content (content_key, content_value, description, created_by) VALUES 
('quick_help', '🆘 Quick Help:\n\n• 📊 VIP Plans - Premium signals\n• 📚 Education - Learn trading\n• 💬 Support - Ask questions\n• 📱 Contact - Follow us\n\nNeed help? Just ask! 😊', 'Quick help menu for beginners', 'system'),
('getting_started', '🚀 New to Trading?\n\n1️⃣ Start with education\n2️⃣ Learn the basics\n3️⃣ Join VIP community\n4️⃣ Practice with signals\n\n📚 We''ll guide you step by step!', 'Getting started guide for beginners', 'system'),
('plan_comparison', '💎 Choose Your Plan:\n\n🥉 Basic: Essential signals\n🥈 Premium: More analysis\n🥇 VIP: Everything included\n\n📞 Need help choosing? Contact us!', 'Simple plan comparison', 'system')
ON CONFLICT (content_key) DO UPDATE SET 
content_value = EXCLUDED.content_value,
updated_at = now();