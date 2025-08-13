-- Backfill existing payment statuses and enforce valid values
UPDATE public.payments
SET status = CASE
    WHEN status IN ('approved') THEN 'completed'
    WHEN status IN ('rejected', 'cancelled') THEN 'failed'
    WHEN status IS NULL OR status = '' THEN 'pending'
    ELSE status
END;

-- Default any remaining invalid statuses to 'pending'
UPDATE public.payments
SET status = 'pending'
WHERE status NOT IN ('pending','completed','failed','refunded');

-- Add CHECK constraint for allowed statuses
ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_status_check;
ALTER TABLE public.payments
  ADD CONSTRAINT payments_status_check
  CHECK (status IN ('pending','completed','failed','refunded'));
