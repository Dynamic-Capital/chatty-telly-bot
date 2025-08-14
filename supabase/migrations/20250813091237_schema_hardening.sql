-- SCHEMA HARDENING — Dynamic-Chatty-Bot
-- Safe & idempotent where possible

-- 1) Extension required by gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2) Ensure array columns use text[]
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='education_packages' AND column_name='features'
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
EXCEPTION WHEN others THEN NULL;
END$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='user_package_assignments' AND column_name='telegram_channels'
  ) THEN
    ALTER TABLE public.user_package_assignments
      ALTER COLUMN telegram_channels TYPE text[] USING
        CASE
          WHEN telegram_channels IS NULL THEN ARRAY[]::text[]
          WHEN pg_typeof(telegram_channels)::text = 'jsonb' THEN ARRAY(SELECT jsonb_array_elements_text(telegram_channels))
          ELSE string_to_array(telegram_channels::text, ',')
        END;
  END IF;
EXCEPTION WHEN others THEN NULL;
END$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='subscription_plans' AND column_name='features'
  ) THEN
    ALTER TABLE public.subscription_plans
      ALTER COLUMN features TYPE text[] USING
        CASE
          WHEN features IS NULL THEN ARRAY[]::text[]
          WHEN pg_typeof(features)::text = 'jsonb' THEN ARRAY(SELECT jsonb_array_elements_text(features))
          ELSE string_to_array(features::text, ',')
        END;
  END IF;
EXCEPTION WHEN others THEN NULL;
END$$;

-- 3) Canonical user anchor: bot_users
-- 3a) channel_memberships: add bot_user_id, backfill via telegram id or profiles link
ALTER TABLE public.channel_memberships
  ADD COLUMN IF NOT EXISTS bot_user_id uuid;

-- Backfill using direct telegram_user_id
UPDATE public.channel_memberships cm
SET bot_user_id = bu.id
FROM public.bot_users bu
WHERE cm.bot_user_id IS NULL
  AND cm.telegram_user_id IS NOT NULL
  AND bu.telegram_id = cm.telegram_user_id;

-- Backfill via profiles(user_id -> profiles.id -> profiles.telegram_id)
UPDATE public.channel_memberships cm
SET bot_user_id = bu.id
FROM public.profiles p
JOIN public.bot_users bu ON bu.telegram_id = p.telegram_id
WHERE cm.bot_user_id IS NULL
  AND cm.user_id = p.id;

-- Add FK (nullable for now)
DO $$
BEGIN
  ALTER TABLE public.channel_memberships
    DROP CONSTRAINT IF EXISTS channel_memberships_bot_user_id_fkey,
    ADD  CONSTRAINT channel_memberships_bot_user_id_fkey
      FOREIGN KEY (bot_user_id) REFERENCES public.bot_users(id) ON DELETE CASCADE;
EXCEPTION WHEN others THEN NULL;
END$$;

-- 3b) user_package_assignments: add bot_user_id, backfill via profiles
ALTER TABLE public.user_package_assignments
  ADD COLUMN IF NOT EXISTS bot_user_id uuid;

UPDATE public.user_package_assignments upa
SET bot_user_id = bu.id
FROM public.profiles p
JOIN public.bot_users bu ON bu.telegram_id = p.telegram_id
WHERE upa.bot_user_id IS NULL
  AND upa.user_id = p.id;

DO $$
BEGIN
  ALTER TABLE public.user_package_assignments
    DROP CONSTRAINT IF EXISTS user_package_assignments_bot_user_id_fkey,
    ADD  CONSTRAINT user_package_assignments_bot_user_id_fkey
      FOREIGN KEY (bot_user_id) REFERENCES public.bot_users(id) ON DELETE CASCADE;
EXCEPTION WHEN others THEN NULL;
END$$;

-- 4) ON DELETE rules
DO $$
BEGIN
  ALTER TABLE public.payments
    DROP CONSTRAINT IF EXISTS payments_user_id_fkey,
    ADD  CONSTRAINT payments_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.bot_users(id) ON DELETE SET NULL;
EXCEPTION WHEN others THEN NULL;
END$$;

DO $$
BEGIN
  ALTER TABLE public.payments
    DROP CONSTRAINT IF EXISTS payments_plan_id_fkey,
    ADD  CONSTRAINT payments_plan_id_fkey
    FOREIGN KEY (plan_id) REFERENCES public.subscription_plans(id) ON DELETE SET NULL;
EXCEPTION WHEN others THEN NULL;
END$$;

DO $$
BEGIN
  ALTER TABLE public.bot_users
    DROP CONSTRAINT IF EXISTS bot_users_current_plan_id_fkey,
    ADD  CONSTRAINT bot_users_current_plan_id_fkey
    FOREIGN KEY (current_plan_id) REFERENCES public.subscription_plans(id) ON DELETE SET NULL;
EXCEPTION WHEN others THEN NULL;
END$$;

DO $$
BEGIN
  ALTER TABLE public.channel_memberships
    DROP CONSTRAINT IF EXISTS channel_memberships_package_id_fkey,
    ADD  CONSTRAINT channel_memberships_package_id_fkey
    FOREIGN KEY (package_id) REFERENCES public.subscription_plans(id) ON DELETE SET NULL;
EXCEPTION WHEN others THEN NULL;
END$$;

DO $$
BEGIN
  ALTER TABLE public.channel_memberships
    DROP CONSTRAINT IF EXISTS channel_memberships_user_id_fkey,
    ADD  CONSTRAINT channel_memberships_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
EXCEPTION WHEN others THEN NULL;
END$$;

-- 5) Enable RLS (deny-all) on sensitive tables
-- Service role (edge functions) bypasses RLS, so app continues to work.
DO $$
BEGIN
  PERFORM 1 FROM pg_class WHERE relname='bot_users';
  IF FOUND THEN EXECUTE 'ALTER TABLE public.bot_users ENABLE ROW LEVEL SECURITY'; END IF;

  PERFORM 1 FROM pg_class WHERE relname='payments';
  IF FOUND THEN EXECUTE 'ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY'; END IF;

  PERFORM 1 FROM pg_class WHERE relname='user_subscriptions';
  IF FOUND THEN EXECUTE 'ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY'; END IF;

  PERFORM 1 FROM pg_class WHERE relname='user_sessions';
  IF FOUND THEN EXECUTE 'ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY'; END IF;

  PERFORM 1 FROM pg_class WHERE relname='user_interactions';
  IF FOUND THEN EXECUTE 'ALTER TABLE public.user_interactions ENABLE ROW LEVEL SECURITY'; END IF;

  PERFORM 1 FROM pg_class WHERE relname='admin_logs';
  IF FOUND THEN EXECUTE 'ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY'; END IF;

  PERFORM 1 FROM pg_class WHERE relname='promo_analytics';
  IF FOUND THEN EXECUTE 'ALTER TABLE public.promo_analytics ENABLE ROW LEVEL SECURITY'; END IF;

  PERFORM 1 FROM pg_class WHERE relname='promotion_usage';
  IF FOUND THEN EXECUTE 'ALTER TABLE public.promotion_usage ENABLE ROW LEVEL SECURITY'; END IF;

  PERFORM 1 FROM pg_class WHERE relname='channel_memberships';
  IF FOUND THEN EXECUTE 'ALTER TABLE public.channel_memberships ENABLE ROW LEVEL SECURITY'; END IF;

  PERFORM 1 FROM pg_class WHERE relname='media_files';
  IF FOUND THEN EXECUTE 'ALTER TABLE public.media_files ENABLE ROW LEVEL SECURITY'; END IF;

  PERFORM 1 FROM pg_class WHERE relname='education_enrollments';
  IF FOUND THEN EXECUTE 'ALTER TABLE public.education_enrollments ENABLE ROW LEVEL SECURITY'; END IF;
END$$;

-- 6) Indexes on hot paths
CREATE INDEX IF NOT EXISTS idx_bot_users_telegram       ON public.bot_users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_telegram   ON public.user_sessions(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_conv_track_telegram      ON public.conversion_tracking(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_user_subs_telegram       ON public.user_subscriptions(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_payments_user            ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_plan            ON public.payments(plan_id);
CREATE INDEX IF NOT EXISTS idx_chanmem_bot_user         ON public.channel_memberships(bot_user_id);
CREATE INDEX IF NOT EXISTS idx_chanmem_telegram         ON public.channel_memberships(telegram_user_id);

-- 7) OPTIONAL: allow subscription history (one active at a time)
-- Comment out if you want to keep a single row per user forever.
DO $$
BEGIN
  -- drop hard unique, if present
  ALTER TABLE public.user_subscriptions
    DROP CONSTRAINT IF EXISTS user_subscriptions_telegram_user_id_key;
EXCEPTION WHEN others THEN NULL;
END$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_active_sub_per_user
ON public.user_subscriptions(telegram_user_id)
WHERE is_active = true;

-- 8) Post-migration verification (as plain SELECTs users can run manually)
-- (Info statements only; not executed automatically here)
-- See runbook below.

