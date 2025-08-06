-- Fix message formatting issue in admin dashboard - remove asterisks causing entity parsing errors
UPDATE bot_content SET content_value = CASE content_key
  WHEN 'admin_dashboard_template' THEN '🔐 Enhanced Admin Dashboard

📊 System Status: {status}
👤 Admin: {admin_id}  
🕐 Uptime: {uptime} minutes
🕐 Last Updated: {timestamp}

📈 Live Statistics:
• 👥 Total Users: {user_count}
• 💎 VIP Members: {vip_count}
• 📦 Active Plans: {plan_count}
• 🎁 Active Promos: {promo_count}
• 💬 Active Sessions: {session_count}
• 🔗 Memory Sessions: {memory_sessions}

🚀 Management Tools:
• 🔄 Bot Control - Status, refresh, restart
• 👥 User Management - Admins, VIP, analytics
• 📦 Package Control - VIP & education packages  
• 💰 Promotions Hub - Discounts & campaigns
• 💬 Content Editor - Messages & UI text
• ⚙️ Bot Settings - Configuration & behavior
• 📈 Analytics Center - Reports & insights
• 📢 Broadcasting - Mass communication
• 🔧 System Tools - Maintenance & utilities'
  ELSE content_value
END
WHERE content_key = 'admin_dashboard_template';

-- Add missing admin handlers content if not exists
INSERT INTO bot_content (content_key, content_value, description, created_by) VALUES 
('missing_handler_error', '❌ Feature temporarily unavailable. Please try again later or contact admin.', 'Error message for missing handlers', 'system'),
('handler_development', '🚧 This feature is under development. Coming soon!', 'Development message for incomplete features', 'system')
ON CONFLICT (content_key) DO NOTHING;