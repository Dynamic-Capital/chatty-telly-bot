-- Update 3 Month VIP plan price to $150
UPDATE subscription_plans 
SET price = 150.00, updated_at = now()
WHERE name = '3 Month VIP' AND duration_months = 3;