ALTER TABLE public.user_subscriptions
  ADD CONSTRAINT user_subscriptions_telegram_user_id_key UNIQUE (telegram_user_id);
