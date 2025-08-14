-- Ensure created_at and updated_at columns exist with default now()
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT table_schema, table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
  ) LOOP
    EXECUTE format('ALTER TABLE %I.%I ADD COLUMN IF NOT EXISTS created_at timestamptz;', r.table_schema, r.table_name);
    EXECUTE format('ALTER TABLE %I.%I ADD COLUMN IF NOT EXISTS updated_at timestamptz;', r.table_schema, r.table_name);
    EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN created_at SET DEFAULT now();', r.table_schema, r.table_name);
    EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN updated_at SET DEFAULT now();', r.table_schema, r.table_name);
    EXECUTE format('UPDATE %I.%I SET created_at = NOW() WHERE created_at IS NULL;', r.table_schema, r.table_name);
    EXECUTE format('UPDATE %I.%I SET updated_at = NOW() WHERE updated_at IS NULL;', r.table_schema, r.table_name);
  END LOOP;
END $$;

-- Reattach trigger to update updated_at on modifications
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT c.table_schema, c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t ON c.table_schema = t.table_schema AND c.table_name = t.table_name
    WHERE c.column_name = 'updated_at'
      AND t.table_type = 'BASE TABLE'
      AND c.table_schema = 'public'
  ) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON %I.%I;', r.table_schema, r.table_name);
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();', r.table_schema, r.table_name);
  END LOOP;
END $$;

