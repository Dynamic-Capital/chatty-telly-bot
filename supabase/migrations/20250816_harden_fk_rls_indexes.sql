-- Harden referential integrity, RLS, triggers, and indexes
-- Safe / idempotent: uses IF NOT EXISTS or NOT VALID where applicable.

-- 1) FOREIGN KEYS (NOT VALID) tying telegram_user_id → bot_users(telegram_id)
--    We use NOT VALID to avoid blocking deploy; validate later during a maintenance window.
--    Choose ON DELETE behavior: sessions/interactions cascade; analytics optional; subscriptions restrict.

DO $$
BEGIN
  -- user_sessions → bot_users
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_user_sessions_bot_users_telegram'
  ) THEN
    ALTER TABLE public.user_sessions
      ADD CONSTRAINT fk_user_sessions_bot_users_telegram
      FOREIGN KEY (telegram_user_id) REFERENCES public.bot_users(telegram_id)
      ON DELETE CASCADE NOT VALID;
  END IF;

  -- user_interactions → bot_users
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_user_interactions_bot_users_telegram'
  ) THEN
    ALTER TABLE public.user_interactions
      ADD CONSTRAINT fk_user_interactions_bot_users_telegram
      FOREIGN KEY (telegram_user_id) REFERENCES public.bot_users(telegram_id)
      ON DELETE CASCADE NOT VALID;
  END IF;

  -- conversion_tracking → bot_users
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_conversion_tracking_bot_users_telegram'
  ) THEN
    ALTER TABLE public.conversion_tracking
      ADD CONSTRAINT fk_conversion_tracking_bot_users_telegram
      FOREIGN KEY (telegram_user_id) REFERENCES public.bot_users(telegram_id)
      ON DELETE SET NULL NOT VALID;
  END IF;

  -- promo_analytics → bot_users
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_promo_analytics_bot_users_telegram'
  ) THEN
    ALTER TABLE public.promo_analytics
      ADD CONSTRAINT fk_promo_analytics_bot_users_telegram
      FOREIGN KEY (telegram_user_id) REFERENCES public.bot_users(telegram_id)
      ON DELETE SET NULL NOT VALID;
  END IF;

  -- user_subscriptions → bot_users (unique per user)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_user_subscriptions_bot_users_telegram'
  ) THEN
    ALTER TABLE public.user_subscriptions
      ADD CONSTRAINT fk_user_subscriptions_bot_users_telegram
      FOREIGN KEY (telegram_user_id) REFERENCES public.bot_users(telegram_id)
      ON DELETE RESTRICT NOT VALID;
  END IF;

  -- channel_memberships.telegram_user_id → bot_users
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_channel_memberships_bot_users_telegram'
  ) THEN
    ALTER TABLE public.channel_memberships
      ADD CONSTRAINT fk_channel_memberships_bot_users_telegram
      FOREIGN KEY (telegram_user_id) REFERENCES public.bot_users(telegram_id)
      ON DELETE SET NULL NOT VALID;
  END IF;

  -- education_enrollments.student_telegram_id → bot_users (optional)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_education_enrollments_bot_users_telegram'
  ) THEN
    ALTER TABLE public.education_enrollments
      ADD CONSTRAINT fk_education_enrollments_bot_users_telegram
      FOREIGN KEY (student_telegram_id) REFERENCES public.bot_users(telegram_id)
      ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

-- 2) INDEXES for performance (IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_user_sessions_tg ON public.user_sessions (telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_last_activity ON public.user_sessions (last_activity);
CREATE INDEX IF NOT EXISTS idx_user_interactions_tg_created ON public.user_interactions (telegram_user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_conversion_tracking_tg ON public.conversion_tracking (telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_promo_analytics_tg ON public.promo_analytics (telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_channel_memberships_tg ON public.channel_memberships (telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created ON public.admin_logs (created_at);
CREATE INDEX IF NOT EXISTS idx_payments_status_created ON public.payments (status, created_at);
CREATE INDEX IF NOT EXISTS idx_bot_users_telegram_id ON public.bot_users (telegram_id);

-- 3) Generic updated_at trigger for tables that have an updated_at column
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

-- Attach trigger where updated_at exists
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname='public'
      AND tablename IN (
        'bot_content','bot_settings','bot_users','broadcast_messages',
        'channel_memberships','contact_links','daily_analytics','education_categories',
        'education_enrollments','education_packages','media_files','payments',
        'promo_analytics','promotions','subscription_plans','user_package_assignments',
        'user_sessions','user_subscriptions','user_surveys'
      )
  LOOP
    EXECUTE format('
      DO $inner$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = %L AND table_name = %L AND column_name = %L
        ) THEN
          -- table has no updated_at, skip
          RETURN;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM pg_trigger
          WHERE tgname = %L
        ) THEN
          EXECUTE %L;
        END IF;
      END
      $inner$;',
      'public', r.tablename, 'updated_at',
      'tr_'||r.tablename||'_updated_at',
      format(
        'CREATE TRIGGER %I BEFORE UPDATE ON public.%I
           FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();',
        'tr_'||r.tablename||'_updated_at', r.tablename
      )
    );
  END LOOP;
END $$;

-- 4) RLS: enable & “service role only” default policies for sensitive tables
-- Service role bypasses RLS in Supabase, but we still add explicit policies for clarity.
-- If you use admin JWT role, allow it via auth.role() = 'admin'.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'bot_content','bot_settings','bot_users','broadcast_messages',
    'channel_memberships','contact_links','conversion_tracking','daily_analytics',
    'education_categories','education_enrollments','education_packages','media_files',
    'payments','promo_analytics','promotions','subscription_plans',
    'user_interactions','user_package_assignments','user_sessions',
    'user_subscriptions','user_surveys','admin_logs'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);

    -- Deny-all by default (no permissive catch-alls)
    -- Create a single policy allowing only service role or admin role if present
    EXECUTE format($sql$
      DO $p$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=%L AND policyname='allow_service_or_admin_all'
        ) THEN
          CREATE POLICY allow_service_or_admin_all ON public.%I
            FOR ALL
            USING ( auth.role() IN ('service_role','admin') )
            WITH CHECK ( auth.role() IN ('service_role','admin') );
        END IF;
      END
      $p$;
    $sql$, t, t);
  END LOOP;
END $$;

-- 5) Payments.status guard (optional tightening; only create if not present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payments_status_valid'
  ) THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT payments_status_valid
      CHECK (status IN ('pending','completed','failed','refunded','cancelled'));
  END IF;
END $$;

-- Notes for operators:
-- After deploy, validate FKs during low-traffic window:
--   ALTER TABLE public.user_sessions           VALIDATE CONSTRAINT fk_user_sessions_bot_users_telegram;
--   ALTER TABLE public.user_interactions       VALIDATE CONSTRAINT fk_user_interactions_bot_users_telegram;
--   ALTER TABLE public.conversion_tracking     VALIDATE CONSTRAINT fk_conversion_tracking_bot_users_telegram;
--   ALTER TABLE public.promo_analytics        VALIDATE CONSTRAINT fk_promo_analytics_bot_users_telegram;
--   ALTER TABLE public.user_subscriptions     VALIDATE CONSTRAINT fk_user_subscriptions_bot_users_telegram;
--   ALTER TABLE public.channel_memberships    VALIDATE CONSTRAINT fk_channel_memberships_bot_users_telegram;
--   ALTER TABLE public.education_enrollments  VALIDATE CONSTRAINT fk_education_enrollments_bot_users_telegram;

COMMENT ON SCHEMA public IS 'Hardened: FKs (NOT VALID), indexes, updated_at triggers, RLS policies.';
