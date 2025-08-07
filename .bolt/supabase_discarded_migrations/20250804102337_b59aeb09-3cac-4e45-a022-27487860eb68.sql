-- Update Monthly Plan (1 Month VIP) price to $49.00
UPDATE subscription_plans 
SET price = 49.00, updated_at = now()
WHERE name = '1 Month VIP' AND duration_months = 1;

-- Transform 6-Month Plan to 12-Month Plan
UPDATE subscription_plans 
SET 
  name = '12 Month VIP',
  duration_months = 12,
  price = 480.00,
  features = ARRAY['Priority signals', 'VIP chat access', 'Daily market analysis', 'Best value - 35% discount'],
  updated_at = now()
WHERE name = '6 Month VIP' AND duration_months = 6;

-- Update Lifetime Plan price to $999.00 and enhance features
UPDATE subscription_plans 
SET 
  price = 999.00,
  features = ARRAY['Priority signals', 'VIP chat access', 'Daily market analysis', 'Lifetime access', 'All future programs access', 'Exclusive content'],
  updated_at = now()
WHERE name = 'Lifetime VIP' AND is_lifetime = true;