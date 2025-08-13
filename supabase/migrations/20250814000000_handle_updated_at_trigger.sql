-- Create a shared trigger function for automatic updated_at maintenance
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers that use the old update_updated_at_column function
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT trigger_name, event_object_schema, event_object_table
    FROM information_schema.triggers
    WHERE action_statement LIKE '%update_updated_at_column%'
  ) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I.%I;', r.trigger_name, r.event_object_schema, r.event_object_table);
  END LOOP;
END $$;

-- Attach the shared trigger to all tables that have an updated_at column
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
    EXECUTE format('DROP TRIGGER IF EXISTS handle_updated_at ON %I.%I;', r.table_schema, r.table_name);
    EXECUTE format('CREATE TRIGGER handle_updated_at BEFORE UPDATE ON %I.%I FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();', r.table_schema, r.table_name);
  END LOOP;
END $$;

-- Remove the old trigger function if it exists
DROP FUNCTION IF EXISTS public.update_updated_at_column();
