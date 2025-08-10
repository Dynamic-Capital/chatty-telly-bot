-- Connect tables to bot_users, add backfills, FKs, indexes, and current_vip view
-- Safe/idempotent; designed for production on Supabase (Postgres 15)

BEGIN;

-- 0) Helper: ensure_bot_user() for future use / backfills (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'ensure_bot_user'
  ) THEN
    CREATE OR REPLACE FUNCTION ensure_bot_user(_telegram_id text,
                                               _username text DEFAULT NULL,
                                               _first text DEFAULT NULL,
                                               _last text DEFAULT NULL)
    RETURNS uuid AS $fn$
    DECLARE uid uuid;
    BEGIN
      SELECT id INTO uid FROM public.bot_users WHERE telegram_id = _telegram_id;
      IF uid IS NULL THEN
        INSERT INTO public.bot_users(telegram_id, username, first_name, last_name)
        VALUES(_telegram_id, _username, _first, _last)
        RETURNING id INTO uid;
      END IF;
      RETURN uid;
    END
    $fn$ LANGUAGE plpgsql;
  END IF;
END$$;

-- 1) Add bot_user_id columns where missing (idempotent)
ALTER TABLE public.user_subscriptions   ADD COLUMN IF NOT EXISTS bot_user_id uuid;
ALTER TABLE public.conversion_tracking  ADD COLUMN IF NOT EXISTS bot_user_id uuid;
ALTER TABLE public.promo_analytics      ADD COLUMN IF NOT EXISTS bot_user_id uuid;
ALTER TABLE public.promotion_usage      ADD COLUMN IF NOT EXISTS bot_user_id uuid;
ALTER TABLE public.user_interactions    ADD COLUMN IF NOT EXISTS bot_user_id uuid;
ALTER TABLE public.user_sessions        ADD COLUMN IF NOT EXISTS bot_user_id uuid;
ALTER TABLE public.channel_memberships  ADD COLUMN IF NOT EXISTS bot_user_id uuid;
ALTER TABLE public.education_enrollments ADD COLUMN IF NOT EXISTS student_bot_user_id uuid;
ALTER TABLE public.user_surveys         ADD COLUMN IF NOT EXISTS bot_user_id uuid;

-- 2) Backfill from telegram_user_id to bot_user_id (safe re-run)
UPDATE public.user_subscriptions us
SET bot_user_id = bu.id
FROM public.bot_users bu
WHERE us.bot_user_id IS NULL AND bu.telegram_id = us.telegram_user_id;

UPDATE public.conversion_tracking ct
SET bot_user_id = bu.id
FROM public.bot_users bu
WHERE ct.bot_user_id IS NULL AND bu.telegram_id = ct.telegram_user_id;

UPDATE public.promo_analytics pa
SET bot_user_id = bu.id
FROM public.bot_users bu
WHERE pa.bot_user_id IS NULL AND bu.telegram_id = pa.telegram_user_id;

-- promotion_usage has no telegram_user_id; only set by app going forward

UPDATE public.user_interactions ui
SET bot_user_id = bu.id
FROM public.bot_users bu
WHERE ui.bot_user_id IS NULL AND bu.telegram_id = ui.telegram_user_id;

UPDATE public.user_sessions usn
SET bot_user_id = bu.id
FROM public.bot_users bu
WHERE usn.bot_user_id IS NULL AND bu.telegram_id = usn.telegram_user_id;

UPDATE public.channel_memberships cm
SET bot_user_id = bu.id
FROM public.bot_users bu
WHERE cm.bot_user_id IS NULL AND bu.telegram_id = cm.telegram_user_id;

UPDATE public.education_enrollments ee
SET student_bot_user_id = bu.id
FROM public.bot_users bu
WHERE ee.student_bot_user_id IS NULL AND bu.telegram_id = ee.student_telegram_id;

UPDATE public.user_surveys sv
SET bot_user_id = bu.id
FROM public.bot_users bu
WHERE sv.bot_user_id IS NULL AND bu.telegram_id = sv.telegram_user_id;

-- 3) Add missing plan FKs (idempotent)
DO $$ BEGIN
  ALTER TABLE public.promo_analytics
    ADD CONSTRAINT promo_analytics_plan_id_fkey
    FOREIGN KEY (plan_id) REFERENCES public.subscription_plans(id) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.user_surveys
    ADD CONSTRAINT user_surveys_recommended_plan_id_fkey
    FOREIGN KEY (recommended_plan_id) REFERENCES public.subscription_plans(id) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4) Add FKs to bot_users (use NOT VALID, then VALIDATE after backfill)
DO $$ BEGIN
  ALTER TABLE public.user_subscriptions
    ADD CONSTRAINT user_subscriptions_bot_user_id_fkey
    FOREIGN KEY (bot_user_id) REFERENCES public.bot_users(id) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.conversion_tracking
    ADD CONSTRAINT conversion_tracking_bot_user_fkey
    FOREIGN KEY (bot_user_id) REFERENCES public.bot_users(id) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.promo_analytics
    ADD CONSTRAINT promo_analytics_bot_user_fkey
    FOREIGN KEY (bot_user_id) REFERENCES public.bot_users(id) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.promotion_usage
    ADD CONSTRAINT promotion_usage_bot_user_fkey
    FOREIGN KEY (bot_user_id) REFERENCES public.bot_users(id) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.user_interactions
    ADD CONSTRAINT user_interactions_bot_user_fkey
    FOREIGN KEY (bot_user_id) REFERENCES public.bot_users(id) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.user_sessions
    ADD CONSTRAINT user_sessions_bot_user_fkey
    FOREIGN KEY (bot_user_id) REFERENCES public.bot_users(id) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.channel_memberships
    ADD CONSTRAINT channel_memberships_bot_user_fkey
    FOREIGN KEY (bot_user_id) REFERENCES public.bot_users(id) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.education_enrollments
    ADD CONSTRAINT education_enrollments_bot_user_fkey
    FOREIGN KEY (student_bot_user_id) REFERENCES public.bot_users(id) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.user_surveys
    ADD CONSTRAINT user_surveys_bot_user_fkey
    FOREIGN KEY (bot_user_id) REFERENCES public.bot_users(id) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 5) Validate new FKs (will fail if orphans remain; keep NOT VALID in that case)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT conname, conrelid::regclass AS tbl
    FROM pg_constraint
    WHERE connamespace = 'public'::regnamespace
      AND contype = 'f'
      AND convalidated = false
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE %s VALIDATE CONSTRAINT %I', r.tbl, r.conname);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skipped VALIDATE for %.% due to existing orphans', r.tbl, r.conname;
    END;
  END LOOP;
END$$;

-- 6) Constraints & indexes (idempotent)
-- Amount non-negative (payments)
DO $$ BEGIN
  ALTER TABLE public.payments
    ADD CONSTRAINT payments_amount_nonneg CHECK (amount >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- One active subscription per user (partial unique)
DO $$ BEGIN
  CREATE UNIQUE INDEX one_active_sub_per_user
    ON public.user_subscriptions (bot_user_id)
    WHERE is_active = true;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Helpful indexes
DO $$ BEGIN CREATE INDEX bot_users_telegram_id_idx ON public.bot_users(telegram_id); EXCEPTION WHEN duplicate_table THEN NULL; END $$;
DO $$ BEGIN CREATE INDEX user_subscriptions_lookup_idx ON public.user_subscriptions(bot_user_id, is_active, subscription_end_date); EXCEPTION WHEN duplicate_table THEN NULL; END $$;
DO $$ BEGIN CREATE INDEX user_subscriptions_plan_idx ON public.user_subscriptions(plan_id); EXCEPTION WHEN duplicate_table THEN NULL; END $$;
DO $$ BEGIN CREATE INDEX payments_status_created_idx ON public.payments(status, created_at); EXCEPTION WHEN duplicate_table THEN NULL; END $$;
DO $$ BEGIN CREATE INDEX payments_user_idx ON public.payments(user_id); EXCEPTION WHEN duplicate_table THEN NULL; END $$;
DO $$ BEGIN CREATE INDEX conversion_tracking_user_idx ON public.conversion_tracking(bot_user_id, created_at); EXCEPTION WHEN duplicate_table THEN NULL; END $$;
DO $$ BEGIN CREATE INDEX promo_analytics_user_idx ON public.promo_analytics(bot_user_id, created_at); EXCEPTION WHEN duplicate_table THEN NULL; END $$;
DO $$ BEGIN CREATE INDEX promotion_usage_user_idx ON public.promotion_usage(bot_user_id); EXCEPTION WHEN duplicate_table THEN NULL; END $$;
DO $$ BEGIN CREATE INDEX user_interactions_user_idx ON public.user_interactions(bot_user_id, created_at); EXCEPTION WHEN duplicate_table THEN NULL; END $$;
DO $$ BEGIN CREATE INDEX user_sessions_user_idx ON public.user_sessions(bot_user_id, is_active, last_activity); EXCEPTION WHEN duplicate_table THEN NULL; END $$;
DO $$ BEGIN CREATE INDEX channel_memberships_user_idx ON public.channel_memberships(bot_user_id, is_active); EXCEPTION WHEN duplicate_table THEN NULL; END $$;

-- 7) current_vip view (source of truth for access)
CREATE OR REPLACE VIEW public.current_vip AS
SELECT
  bu.id AS bot_user_id,
  bu.telegram_id,
  us.subscription_end_date,
  (us.is_active = true AND now() < COALESCE(us.subscription_end_date, now())) AS is_vip
FROM public.bot_users bu
LEFT JOIN LATERAL (
  SELECT *
  FROM public.user_subscriptions
  WHERE bot_user_id = bu.id
  ORDER BY subscription_end_date DESC NULLS LAST
  LIMIT 1
) us ON TRUE;

-- 8) Optional quality checks: set NOT NULL only if no orphans (each table)
DO $$
DECLARE missing_count bigint;
BEGIN
  -- user_subscriptions
  SELECT count(*) INTO missing_count
  FROM public.user_subscriptions WHERE bot_user_id IS NULL;
  IF missing_count = 0 THEN
    BEGIN
      ALTER TABLE public.user_subscriptions ALTER COLUMN bot_user_id SET NOT NULL;
    EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip NOT NULL for user_subscriptions'; END;
  END IF;

  -- conversion_tracking
  SELECT count(*) INTO missing_count
  FROM public.conversion_tracking WHERE bot_user_id IS NULL;
  IF missing_count = 0 THEN
    BEGIN
      ALTER TABLE public.conversion_tracking ALTER COLUMN bot_user_id SET NOT NULL;
    EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip NOT NULL for conversion_tracking'; END;
  END IF;

  -- promo_analytics
  SELECT count(*) INTO missing_count
  FROM public.promo_analytics WHERE bot_user_id IS NULL;
  IF missing_count = 0 THEN
    BEGIN
      ALTER TABLE public.promo_analytics ALTER COLUMN bot_user_id SET NOT NULL;
    EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip NOT NULL for promo_analytics'; END;
  END IF;

  -- user_interactions
  SELECT count(*) INTO missing_count
  FROM public.user_interactions WHERE bot_user_id IS NULL;
  IF missing_count = 0 THEN
    BEGIN
      ALTER TABLE public.user_interactions ALTER COLUMN bot_user_id SET NOT NULL;
    EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip NOT NULL for user_interactions'; END;
  END IF;

  -- user_sessions
  SELECT count(*) INTO missing_count
  FROM public.user_sessions WHERE bot_user_id IS NULL;
  IF missing_count = 0 THEN
    BEGIN
      ALTER TABLE public.user_sessions ALTER COLUMN bot_user_id SET NOT NULL;
    EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip NOT NULL for user_sessions'; END;
  END IF;

  -- channel_memberships
  SELECT count(*) INTO missing_count
  FROM public.channel_memberships WHERE bot_user_id IS NULL;
  IF missing_count = 0 THEN
    BEGIN
      ALTER TABLE public.channel_memberships ALTER COLUMN bot_user_id SET NOT NULL;
    EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip NOT NULL for channel_memberships'; END;
  END IF;

  -- education_enrollments
  SELECT count(*) INTO missing_count
  FROM public.education_enrollments WHERE student_bot_user_id IS NULL;
  IF missing_count = 0 THEN
    BEGIN
      ALTER TABLE public.education_enrollments ALTER COLUMN student_bot_user_id SET NOT NULL;
    EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip NOT NULL for education_enrollments'; END;
  END IF;

  -- user_surveys
  SELECT count(*) INTO missing_count
  FROM public.user_surveys WHERE bot_user_id IS NULL;
  IF missing_count = 0 THEN
    BEGIN
      ALTER TABLE public.user_surveys ALTER COLUMN bot_user_id SET NOT NULL;
    EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skip NOT NULL for user_surveys'; END;
  END IF;
END$$;

COMMIT;

-- Diagnostics (run manually if needed)
-- Orphans: users
-- SELECT * FROM public.user_subscriptions WHERE bot_user_id IS NULL;
-- SELECT * FROM public.conversion_tracking WHERE bot_user_id IS NULL;
-- SELECT * FROM public.promo_analytics WHERE bot_user_id IS NULL;
-- SELECT * FROM public.user_interactions WHERE bot_user_id IS NULL;
-- SELECT * FROM public.user_sessions WHERE bot_user_id IS NULL;
-- SELECT * FROM public.channel_memberships WHERE bot_user_id IS NULL;
-- SELECT * FROM public.education_enrollments WHERE student_bot_user_id IS NULL;
-- SELECT * FROM public.user_surveys WHERE bot_user_id IS NULL;

-- Validate FKs later if needed:
-- ALTER TABLE public.<table> VALIDATE CONSTRAINT <constraint_name>;

-- Quick checks:
-- SELECT * FROM public.current_vip ORDER BY is_vip DESC, subscription_end_date DESC NULLS LAST LIMIT 20;
