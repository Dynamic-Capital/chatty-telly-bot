-- Create a shared trigger function for automatic updated_at maintenance
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach the trigger to all tables that have an updated_at column
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
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON %I.%I;', r.table_schema, r.table_name);
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();', r.table_schema, r.table_name);
  END LOOP;
END $$;

-- Remove legacy trigger functions
DROP FUNCTION IF EXISTS public.handle_updated_at();
DROP FUNCTION IF EXISTS public.update_updated_at_column();

-- Redefine functions without manual updated_at handling
CREATE OR REPLACE FUNCTION finalize_completed_payment(p_payment_id uuid)
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
    is_active, subscription_start_date, subscription_end_date
  )
  VALUES (
    _bot_user_id, _telegram_id, p.plan_id, p.payment_method::text, 'completed',
    true, now(), sub_end
  );

  UPDATE bot_users
  SET subscription_expires_at = sub_end, is_vip = true
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

CREATE OR REPLACE FUNCTION rollup_daily_analytics(target_date date)
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

  INSERT INTO daily_analytics(date, revenue, total_users, new_users)
  VALUES (d, _revenue, _users, _new_users)
  ON CONFLICT (date)
  DO UPDATE SET revenue = EXCLUDED.revenue,
                total_users = EXCLUDED.total_users,
                new_users = EXCLUDED.new_users;
END;
$fn$;

CREATE OR REPLACE FUNCTION record_promo_usage(p_promotion_id uuid, p_telegram_user_id text)
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
  SET current_uses = COALESCE(current_uses,0) + 1
  WHERE id = p_promotion_id;
END;
$fn$;
