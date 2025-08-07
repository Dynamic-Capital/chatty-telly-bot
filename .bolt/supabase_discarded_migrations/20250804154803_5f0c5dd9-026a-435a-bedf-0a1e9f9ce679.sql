-- Add 6 Month VIP subscription plan
INSERT INTO public.subscription_plans (name, price, duration_months, currency, features, is_lifetime)
VALUES (
  '6 Month VIP',
  250,
  6,
  'USD',
  ARRAY['Priority signals', 'VIP chat access', 'Daily market analysis', 'Weekly mentorship calls', 'Exclusive research reports', '20% discount'],
  false
) ON CONFLICT DO NOTHING;