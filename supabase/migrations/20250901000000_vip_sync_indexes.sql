-- Add indexes to support VIP sync
CREATE INDEX IF NOT EXISTS idx_channel_memberships_user ON public.channel_memberships(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_channel_memberships_user_channel ON public.channel_memberships(telegram_user_id, channel_id);
CREATE INDEX IF NOT EXISTS idx_bot_users_telegram_id ON public.bot_users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user ON public.user_subscriptions(telegram_user_id);
