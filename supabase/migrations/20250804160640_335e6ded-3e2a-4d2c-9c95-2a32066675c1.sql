-- Add sample active promotions
INSERT INTO public.promotions (code, description, discount_type, discount_value, valid_from, valid_until, is_active, max_uses) VALUES
('NEWMEMBER20', 'New Member Special - 20% Off First Month', 'percentage', 20, NOW(), NOW() + INTERVAL '30 days', true, 100),
('VIP50', 'VIP Upgrade - $50 Off Annual Plans', 'fixed', 50, NOW(), NOW() + INTERVAL '60 days', true, 50),
('EARLYBIRD', 'Early Bird Discount - 15% Off All Plans', 'percentage', 15, NOW(), NOW() + INTERVAL '14 days', true, NULL)
ON CONFLICT DO NOTHING;