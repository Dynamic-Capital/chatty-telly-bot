create index if not exists idx_user_sessions_tg on public.user_sessions(telegram_user_id);
create index if not exists idx_user_interactions_tg on public.user_interactions(telegram_user_id);
