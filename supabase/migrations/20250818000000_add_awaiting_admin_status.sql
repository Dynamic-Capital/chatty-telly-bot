-- Add awaiting_admin status to payment_status_enum
ALTER TYPE payment_status_enum ADD VALUE IF NOT EXISTS 'awaiting_admin';
