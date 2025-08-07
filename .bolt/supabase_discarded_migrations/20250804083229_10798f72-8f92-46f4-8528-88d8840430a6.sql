-- Add sample promotional codes
INSERT INTO public.promotions (code, discount_type, discount_value, valid_from, valid_until, max_uses, current_uses, is_active, description) VALUES
  ('SAVE20', 'percentage', 20, NOW(), NOW() + INTERVAL '30 days', 100, 0, true, '20% off any subscription plan'),
  ('FLAT50', 'fixed', 50, NOW(), NOW() + INTERVAL '7 days', 50, 0, true, '$50 off any subscription'),
  ('WELCOME15', 'percentage', 15, NOW(), NOW() + INTERVAL '60 days', 200, 0, true, '15% welcome discount for new users'),
  ('VIP30', 'percentage', 30, NOW(), NOW() + INTERVAL '14 days', 25, 0, true, '30% VIP exclusive discount'),
  ('LIFETIME100', 'fixed', 100, NOW(), NOW() + INTERVAL '3 days', 10, 0, true, '$100 off lifetime plans only'),
  ('STUDENT25', 'percentage', 25, NOW(), NOW() + INTERVAL '90 days', 150, 0, true, '25% student discount'),
  ('FLASH40', 'percentage', 40, NOW(), NOW() + INTERVAL '2 days', 20, 0, true, '40% flash sale - limited time'),
  ('MEGA75', 'fixed', 75, NOW(), NOW() + INTERVAL '5 days', 30, 0, true, '$75 mega discount deal'),
  ('FIRST10', 'percentage', 10, NOW(), NOW() + INTERVAL '365 days', 1000, 0, true, '10% first-time user discount'),
  ('PREMIUM35', 'percentage', 35, NOW() + INTERVAL '1 day', NOW() + INTERVAL '10 days', 40, 0, true, '35% premium member exclusive');