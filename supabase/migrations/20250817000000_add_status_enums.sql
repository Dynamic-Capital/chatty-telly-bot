-- Add enums for trigger types and various status fields

-- Rename existing trigger_type_enum to auto_reply_trigger_type if present
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'trigger_type_enum') THEN
    ALTER TYPE trigger_type_enum RENAME TO auto_reply_trigger_type;
  END IF;
END $$;

-- Ensure auto_reply_trigger_type enum exists
DO $$ BEGIN
  CREATE TYPE auto_reply_trigger_type AS ENUM ('keyword', 'regex', 'command');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Alter auto_reply_templates.trigger_type to use enum
ALTER TABLE auto_reply_templates
  ALTER COLUMN trigger_type TYPE auto_reply_trigger_type USING trigger_type::auto_reply_trigger_type;

-- Payment status enum shared by multiple tables
DO $$ BEGIN
  CREATE TYPE payment_status_enum AS ENUM ('pending', 'completed', 'failed', 'refunded');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE payments
  DROP CONSTRAINT IF EXISTS payments_status_check,
  ALTER COLUMN status TYPE payment_status_enum USING status::payment_status_enum,
  ALTER COLUMN status SET DEFAULT 'pending';

ALTER TABLE education_enrollments
  ALTER COLUMN payment_status TYPE payment_status_enum USING payment_status::payment_status_enum,
  ALTER COLUMN payment_status SET DEFAULT 'pending';

ALTER TABLE user_subscriptions
  ALTER COLUMN payment_status TYPE payment_status_enum USING payment_status::payment_status_enum,
  ALTER COLUMN payment_status SET DEFAULT 'pending';

-- Enrollment status enum for education enrollments
DO $$ BEGIN
  CREATE TYPE enrollment_status_enum AS ENUM ('pending', 'active', 'completed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE education_enrollments
  ALTER COLUMN enrollment_status TYPE enrollment_status_enum USING enrollment_status::enrollment_status_enum,
  ALTER COLUMN enrollment_status SET DEFAULT 'pending';

-- Broadcast delivery status
DO $$ BEGIN
  CREATE TYPE broadcast_status_enum AS ENUM ('draft', 'scheduled', 'sending', 'completed', 'failed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE broadcast_messages
  ALTER COLUMN delivery_status TYPE broadcast_status_enum USING delivery_status::broadcast_status_enum,
  ALTER COLUMN delivery_status SET DEFAULT 'draft';

-- Payment intent status and receipt verdict enums
DO $$ BEGIN
  CREATE TYPE payment_intent_status_enum AS ENUM ('pending', 'approved', 'manual_review', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE payment_intents
  ALTER COLUMN status TYPE payment_intent_status_enum USING status::payment_intent_status_enum,
  ALTER COLUMN status SET DEFAULT 'pending';

DO $$ BEGIN
  CREATE TYPE receipt_verdict_enum AS ENUM ('approved', 'manual_review', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE receipts
  ALTER COLUMN verdict TYPE receipt_verdict_enum USING verdict::receipt_verdict_enum,
  ALTER COLUMN verdict SET DEFAULT 'manual_review';
