-- Convert jsonb array columns back to text[] arrays
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public'
      AND table_name='education_packages'
      AND column_name='features'
      AND data_type='jsonb'
  ) THEN
    ALTER TABLE public.education_packages
      ALTER COLUMN features TYPE text[] USING
        CASE WHEN features IS NULL THEN ARRAY[]::text[]
             ELSE ARRAY(SELECT jsonb_array_elements_text(features)) END,
      ALTER COLUMN requirements TYPE text[] USING
        CASE WHEN requirements IS NULL THEN ARRAY[]::text[]
             ELSE ARRAY(SELECT jsonb_array_elements_text(requirements)) END,
      ALTER COLUMN learning_outcomes TYPE text[] USING
        CASE WHEN learning_outcomes IS NULL THEN ARRAY[]::text[]
             ELSE ARRAY(SELECT jsonb_array_elements_text(learning_outcomes)) END;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public'
      AND table_name='user_package_assignments'
      AND column_name='telegram_channels'
      AND data_type='jsonb'
  ) THEN
    ALTER TABLE public.user_package_assignments
      ALTER COLUMN telegram_channels TYPE text[] USING
        CASE WHEN telegram_channels IS NULL THEN ARRAY[]::text[]
             ELSE ARRAY(SELECT jsonb_array_elements_text(telegram_channels)) END;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public'
      AND table_name='subscription_plans'
      AND column_name='features'
      AND data_type='jsonb'
  ) THEN
    ALTER TABLE public.subscription_plans
      ALTER COLUMN features TYPE text[] USING
        CASE WHEN features IS NULL THEN ARRAY[]::text[]
             ELSE ARRAY(SELECT jsonb_array_elements_text(features)) END;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;
