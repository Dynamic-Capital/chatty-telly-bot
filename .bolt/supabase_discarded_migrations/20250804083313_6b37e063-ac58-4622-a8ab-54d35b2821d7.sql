-- Add additional unique promotional codes
INSERT INTO public.promotions (code, discount_type, discount_value, valid_from, valid_until, max_uses, current_uses, is_active, description) VALUES
  ('FLASH30', 'percentage', 30, NOW(), NOW() + INTERVAL '48 hours', 50, 0, true, '30% flash sale - 48 hours only'),
  ('MEGA75', 'fixed', 75, NOW(), NOW() + INTERVAL '7 days', 25, 0, true, '$75 mega discount on any plan'),
  ('STUDENT15', 'percentage', 15, NOW(), NOW() + INTERVAL '90 days', 200, 0, true, '15% student discount'),
  ('VIP40', 'percentage', 40, NOW(), NOW() + INTERVAL '5 days', 30, 0, true, '40% VIP exclusive offer'),
  ('NEWUSER25', 'percentage', 25, NOW(), NOW() + INTERVAL '30 days', 100, 0, true, '25% new user welcome bonus'),
  ('WEEKEND50', 'fixed', 50, NOW(), NOW() + INTERVAL '3 days', 75, 0, true, '$50 weekend special deal'),
  ('PREMIUM35', 'percentage', 35, NOW(), NOW() + INTERVAL '14 days', 40, 0, true, '35% premium membership discount'),
  ('EARLY20', 'percentage', 20, NOW(), NOW() + INTERVAL '60 days', 150, 0, true, '20% early bird special'),
  ('LOYALTY100', 'fixed', 100, NOW(), NOW() + INTERVAL '10 days', 15, 0, true, '$100 loyalty reward - lifetime plans');