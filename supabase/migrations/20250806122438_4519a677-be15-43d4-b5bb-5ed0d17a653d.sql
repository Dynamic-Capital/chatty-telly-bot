-- Remove Stripe-related payment methods from the payments table
-- Update payment_method column to only support non-Stripe methods

-- Remove any Stripe-specific data from payments table if needed
UPDATE public.payments 
SET payment_method = 'crypto' 
WHERE payment_method = 'stripe';

-- Update any payment provider references
UPDATE public.payments 
SET payment_provider_id = NULL,
    webhook_data = NULL
WHERE payment_method = 'stripe' OR payment_provider_id LIKE 'cs_%';

-- Add a comment documenting supported payment methods
COMMENT ON COLUMN public.payments.payment_method IS 'Supported methods: crypto, binance_pay, bank_transfer (Stripe removed)';

-- Clean up any Stripe webhook data
UPDATE public.payments 
SET webhook_data = NULL 
WHERE webhook_data::text LIKE '%stripe%';

-- Ensure payment methods are consistent
UPDATE public.payments 
SET payment_method = 'binance_pay' 
WHERE payment_method = 'binance';

-- Add constraint to prevent Stripe from being added back
ALTER TABLE public.payments 
DROP CONSTRAINT IF EXISTS check_payment_method;

ALTER TABLE public.payments 
ADD CONSTRAINT check_payment_method 
CHECK (payment_method IN ('crypto', 'binance_pay', 'bank_transfer', 'manual'));

-- Document the change
COMMENT ON TABLE public.payments IS 'Payment processing table - Stripe integration removed, supports crypto, Binance Pay, bank transfers, and manual payments only';