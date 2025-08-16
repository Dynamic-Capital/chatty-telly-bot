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
    -- create temporary columns to safely migrate data
    ALTER TABLE public.education_packages
      ADD COLUMN features_tmp text[] DEFAULT ARRAY[]::text[],
      ADD COLUMN requirements_tmp text[] DEFAULT ARRAY[]::text[],
      ADD COLUMN learning_outcomes_tmp text[] DEFAULT ARRAY[]::text[];

    -- migrate data while preserving NULL entries
    UPDATE public.education_packages
    SET
      features_tmp = CASE
        WHEN features IS NULL THEN NULL
        ELSE ARRAY(SELECT jsonb_array_elements_text(features))
      END,
      requirements_tmp = CASE
        WHEN requirements IS NULL THEN NULL
        ELSE ARRAY(SELECT jsonb_array_elements_text(requirements))
      END,
      learning_outcomes_tmp = CASE
        WHEN learning_outcomes IS NULL THEN NULL
        ELSE ARRAY(SELECT jsonb_array_elements_text(learning_outcomes))
      END;

    -- swap columns and remove temporary ones
    ALTER TABLE public.education_packages
      DROP COLUMN features,
      DROP COLUMN requirements,
      DROP COLUMN learning_outcomes,
      RENAME COLUMN features_tmp TO features,
      RENAME COLUMN requirements_tmp TO requirements,
      RENAME COLUMN learning_outcomes_tmp TO learning_outcomes;
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
    -- create temporary column for safe migration
    ALTER TABLE public.user_package_assignments
      ADD COLUMN telegram_channels_tmp text[] DEFAULT ARRAY[]::text[];

    -- migrate existing values
    UPDATE public.user_package_assignments
    SET telegram_channels_tmp = CASE
      WHEN telegram_channels IS NULL THEN NULL
      ELSE ARRAY(SELECT jsonb_array_elements_text(telegram_channels))
    END;

    -- swap columns
    ALTER TABLE public.user_package_assignments
      DROP COLUMN telegram_channels,
      RENAME COLUMN telegram_channels_tmp TO telegram_channels;
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
    -- create temporary column and migrate data
    ALTER TABLE public.subscription_plans
      ADD COLUMN features_tmp text[] DEFAULT ARRAY[]::text[];

    UPDATE public.subscription_plans
    SET features_tmp = CASE
      WHEN features IS NULL THEN NULL
      ELSE ARRAY(SELECT jsonb_array_elements_text(features))
    END;

    ALTER TABLE public.subscription_plans
      DROP COLUMN features,
      RENAME COLUMN features_tmp TO features;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;
