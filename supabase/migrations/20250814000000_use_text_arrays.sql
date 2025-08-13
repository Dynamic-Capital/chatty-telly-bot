-- Ensure array fields use text[] for education packages and user package assignments
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public'
      AND table_name='education_packages'
      AND column_name='features'
      AND data_type <> 'ARRAY'
  ) THEN
    ALTER TABLE public.education_packages
      ALTER COLUMN features TYPE text[] USING
        CASE
          WHEN features IS NULL THEN ARRAY[]::text[]
          WHEN pg_typeof(features)::text = 'jsonb' THEN ARRAY(SELECT jsonb_array_elements_text(features))
          ELSE string_to_array(features::text, ',')
        END,
      ALTER COLUMN requirements TYPE text[] USING
        CASE
          WHEN requirements IS NULL THEN ARRAY[]::text[]
          WHEN pg_typeof(requirements)::text = 'jsonb' THEN ARRAY(SELECT jsonb_array_elements_text(requirements))
          ELSE string_to_array(requirements::text, ',')
        END,
      ALTER COLUMN learning_outcomes TYPE text[] USING
        CASE
          WHEN learning_outcomes IS NULL THEN ARRAY[]::text[]
          WHEN pg_typeof(learning_outcomes)::text = 'jsonb' THEN ARRAY(SELECT jsonb_array_elements_text(learning_outcomes))
          ELSE string_to_array(learning_outcomes::text, ',')
        END;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public'
      AND table_name='user_package_assignments'
      AND column_name='telegram_channels'
      AND data_type <> 'ARRAY'
  ) THEN
    ALTER TABLE public.user_package_assignments
      ALTER COLUMN telegram_channels TYPE text[] USING
        CASE
          WHEN telegram_channels IS NULL THEN ARRAY[]::text[]
          WHEN pg_typeof(telegram_channels)::text = 'jsonb' THEN ARRAY(SELECT jsonb_array_elements_text(telegram_channels))
          ELSE string_to_array(telegram_channels::text, ',')
        END;
  END IF;
END $$;
