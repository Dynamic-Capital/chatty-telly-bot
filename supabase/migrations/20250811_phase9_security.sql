-- Enable RLS on sensitive tables (no client policies: Edge-only writes)
alter table public.payments enable row level security;
alter table public.user_subscriptions enable row level security;
alter table public.bot_users enable row level security;
alter table public.admin_logs enable row level security;

-- Deny-all policies (Edge/service role bypasses)
drop policy if exists deny_all_payments on public.payments;
create policy deny_all_payments on public.payments for all using (false);

drop policy if exists deny_all_usersubs on public.user_subscriptions;
create policy deny_all_usersubs on public.user_subscriptions for all using (false);

drop policy if exists deny_all_botusers on public.bot_users;
create policy deny_all_botusers on public.bot_users for all using (false);

drop policy if exists deny_all_adminlogs on public.admin_logs;
create policy deny_all_adminlogs on public.admin_logs for all using (false);

-- Storage bucket already private; ensure index for interactions cleanup
create index if not exists idx_user_interactions_created_at on public.user_interactions(created_at);
create index if not exists idx_user_sessions_last_activity on public.user_sessions(last_activity);

-- Ban list
create table if not exists public.abuse_bans (
  id uuid primary key default gen_random_uuid(),
  telegram_id text not null,
  reason text,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  created_by text
);
create index if not exists idx_abuse_bans_tg on public.abuse_bans(telegram_id);
