-- First, let's add some sample subscription plans if they don't exist
INSERT INTO public.subscription_plans (name, price, duration_months, is_lifetime, currency, features) 
VALUES 
  ('1 Month VIP', 9.99, 1, false, 'USD', ARRAY['Priority Support', 'VIP Access', 'Ad-Free Experience']),
  ('3 Month VIP', 24.99, 3, false, 'USD', ARRAY['Priority Support', 'VIP Access', 'Ad-Free Experience', '3 Months Value']),
  ('6 Month VIP', 44.99, 6, false, 'USD', ARRAY['Priority Support', 'VIP Access', 'Ad-Free Experience', '6 Months Value']),
  ('Lifetime VIP', 99.99, 0, true, 'USD', ARRAY['Priority Support', 'VIP Access', 'Ad-Free Experience', 'Lifetime Access'])
ON CONFLICT (name) DO NOTHING;