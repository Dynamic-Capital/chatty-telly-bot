BEGIN;

-- Helper: check if a view exists
CREATE OR REPLACE FUNCTION _view_exists(_schema text, _name text)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = _schema
      AND c.relname = _name
      AND c.relkind IN ('v','m')
  );
$$;

-- Issue 1: finalize_completed_payment(payment_id)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'finalize_completed_payment') THEN
    CREATE FUNCTION finalize_completed_payment(p_payment_id uuid)
    RETURNS void
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $fn$
    DECLARE
      p RECORD;
      months int;
      sub_end timestamptz;
      _telegram_id text;
      _bot_user_id uuid;
    BEGIN
      SELECT * INTO p FROM payments WHERE id = p_payment_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment % not found', p_payment_id;
      END IF;

      IF p.status <> 'completed' THEN
        RETURN; -- no-op for non-completed (idempotent)
      END IF;

      SELECT duration_months INTO months
      FROM subscription_plans WHERE id = p.plan_id;

      SELECT telegram_id, id INTO _telegram_id, _bot_user_id
      FROM bot_users WHERE id = p.user_id;

      -- extend from latest end date or now
      SELECT COALESCE(MAX(subscription_end_date), now())
        INTO sub_end
      FROM user_subscriptions
      WHERE bot_user_id = _bot_user_id;

      sub_end := sub_end + make_interval(months => COALESCE(months, 0));

      INSERT INTO user_subscriptions (
        bot_user_id, telegram_user_id, plan_id, payment_method, payment_status,
        is_active, subscription_start_date, subscription_end_date, created_at, updated_at
      )
      VALUES (
        _bot_user_id, _telegram_id, p.plan_id, p.payment_method::text, 'completed',
        true, now(), sub_end, now(), now()
      );

      UPDATE bot_users
      SET subscription_expires_at = sub_end, is_vip = true, updated_at = now()
      WHERE id = _bot_user_id;

      INSERT INTO admin_logs(admin_telegram_id, action_type, action_description,
                             affected_table, affected_record_id, new_values)
      VALUES (
        'system', 'payment_completed',
        'Auto-activate subscription from finalize_completed_payment',
        'user_subscriptions', p_payment_id, to_jsonb(p)
      );
    END;
    $fn$;
  END IF;
END$$;

-- Issue 2: daily analytics rollup
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'rollup_daily_analytics') THEN
    CREATE FUNCTION rollup_daily_analytics(target_date date)
    RETURNS void
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $fn$
    DECLARE
      d date := target_date;
      _revenue numeric;
      _users int;
      _new_users int;
    BEGIN
      SELECT COALESCE(sum(amount),0) INTO _revenue
      FROM payments
      WHERE status='completed' AND created_at::date = d;

      SELECT count(*) INTO _users FROM bot_users;

      SELECT count(*) INTO _new_users
      FROM bot_users WHERE created_at::date = d;

      INSERT INTO daily_analytics(date, revenue, total_users, new_users, updated_at)
      VALUES (d, _revenue, _users, _new_users, now())
      ON CONFLICT (date)
      DO UPDATE SET revenue = EXCLUDED.revenue,
                    total_users = EXCLUDED.total_users,
                    new_users = EXCLUDED.new_users,
                    updated_at = now();
    END;
    $fn$;

    CREATE OR REPLACE FUNCTION rollup_last_30_days()
    RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
    DECLARE d date;
    BEGIN
      FOR d IN SELECT (current_date - i) FROM generate_series(0,29) AS t(i)
      LOOP
        PERFORM rollup_daily_analytics(d);
      END LOOP;
    END$$;
  END IF;
END$$;

-- Issue 3: VIP expiry cohorts
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_vip_expiring') THEN
    CREATE FUNCTION get_vip_expiring(days_ahead int)
    RETURNS TABLE(telegram_id text, username text, subscription_end_date timestamptz)
    LANGUAGE sql STABLE AS $fn$
      WITH latest_sub AS (
        SELECT
          bu.telegram_id, bu.username,
          us.subscription_end_date,
          row_number() OVER (PARTITION BY bu.id ORDER BY us.subscription_end_date DESC NULLS LAST) AS rn
        FROM bot_users bu
        JOIN user_subscriptions us ON us.bot_user_id = bu.id
        WHERE us.is_active = true
      )
      SELECT l.telegram_id, l.username, l.subscription_end_date
      FROM latest_sub l
      WHERE l.rn = 1
        AND l.subscription_end_date::date = (current_date + make_interval(days => days_ahead))::date;
    $fn$;

    IF NOT _view_exists('public','vip_expiring_t3') THEN
      CREATE VIEW vip_expiring_t3 AS SELECT * FROM get_vip_expiring(3);
    END IF;
    IF NOT _view_exists('public','vip_expiring_t1') THEN
      CREATE VIEW vip_expiring_t1 AS SELECT * FROM get_vip_expiring(1);
    END IF;
    IF NOT _view_exists('public','vip_expiring_t0') THEN
      CREATE VIEW vip_expiring_t0 AS SELECT * FROM get_vip_expiring(0);
    END IF;
  END IF;
END$$;

-- Issue 4: Promo validation + usage logging
DO $$ BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS ix_promotion_usage_once
  ON promotion_usage (promotion_id, telegram_user_id)
  WHERE promotion_id IS NOT NULL AND telegram_user_id IS NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'validate_promo_code') THEN
    CREATE FUNCTION validate_promo_code(p_code text, p_telegram_user_id text)
    RETURNS TABLE(
      valid boolean,
      reason text,
      promotion_id uuid,
      discount_type text,
      discount_value numeric
    )
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $fn$
    DECLARE pr RECORD;
    BEGIN
      SELECT * INTO pr FROM promotions WHERE code = p_code;

      IF pr IS NULL THEN
        RETURN QUERY SELECT false, 'not_found', NULL::uuid, NULL::text, NULL::numeric; RETURN;
      END IF;

      IF pr.is_active = false THEN
        RETURN QUERY SELECT false, 'inactive', pr.id, NULL::text, NULL::numeric; RETURN;
      END IF;

      IF pr.valid_until < now() OR pr.valid_from > now() THEN
        RETURN QUERY SELECT false, 'out_of_window', pr.id, NULL::text, NULL::numeric; RETURN;
      END IF;

      IF pr.max_uses IS NOT NULL AND pr.current_uses >= pr.max_uses THEN
        RETURN QUERY SELECT false, 'maxed_out', pr.id, NULL::text, NULL::numeric; RETURN;
      END IF;

      IF EXISTS (
        SELECT 1 FROM promotion_usage
        WHERE promotion_id = pr.id AND telegram_user_id = p_telegram_user_id
      ) THEN
        RETURN QUERY SELECT false, 'already_used', pr.id, NULL::text, NULL::numeric; RETURN;
      END IF;

      RETURN QUERY SELECT true, NULL::text, pr.id, pr.discount_type, pr.discount_value;
    END;
    $fn$;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'record_promo_usage') THEN
    CREATE FUNCTION record_promo_usage(p_promotion_id uuid, p_telegram_user_id text)
    RETURNS void
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $fn$
    BEGIN
      INSERT INTO promotion_usage(promotion_id, telegram_user_id, used_at)
      VALUES (p_promotion_id, p_telegram_user_id, now())
      ON CONFLICT DO NOTHING;

      UPDATE promotions
      SET current_uses = COALESCE(current_uses,0) + 1,
          updated_at = now()
      WHERE id = p_promotion_id;
    END;
    $fn$;
  END IF;
END$$;

-- Issue 5: VIP access helper (read-only)
DO $$
BEGIN
  IF NOT _view_exists('public','vip_access_now') THEN
    IF _view_exists('public','current_vip') THEN
      EXECUTE $$CREATE VIEW vip_access_now AS
               SELECT telegram_id FROM current_vip WHERE is_vip = true$$;
    ELSE
      EXECUTE $$CREATE VIEW vip_access_now AS
               SELECT bu.telegram_id
               FROM bot_users bu
               JOIN LATERAL (
                 SELECT * FROM user_subscriptions us
                 WHERE us.bot_user_id = bu.id AND us.is_active = true
                 ORDER BY us.subscription_end_date DESC NULLS LAST
                 LIMIT 1
               ) us ON TRUE
               WHERE now() < COALESCE(us.subscription_end_date, now())$$;
    END IF;
  END IF;
END$$;

COMMIT;
