-- Create VIP bot launch promo code with 50% lifetime discount
INSERT INTO public.promotions (
  code,
  description,
  discount_type,
  discount_value,
  valid_from,
  valid_until,
  is_active,
  max_uses,
  current_uses
) VALUES (
  'VIPBOTLAUNCH50',
  'VIP Bot Launch - 50% OFF Lifetime',
  'percentage',
  50,
  now(),
  now() + interval '30 days',
  true,
  100,
  0
);

-- Disable all other active promo codes
UPDATE public.promotions 
SET is_active = false 
WHERE code != 'VIPBOTLAUNCH50' AND is_active = true;