-- Storage bucket for receipts (private)
select storage.create_bucket('receipts', public := false);

-- Indexes for faster lookups
create index if not exists idx_bot_users_telegram_id on public.bot_users(telegram_id);
create index if not exists idx_payments_user_plan on public.payments(user_id, plan_id);
create index if not exists idx_subscription_plans_created on public.subscription_plans(created_at);

-- Public read of active education packages via REST (client-side)
alter table public.education_packages enable row level security;
drop policy if exists ep_public_active_read on public.education_packages;
create policy ep_public_active_read
  on public.education_packages
  for select
  using (is_active = true);

-- (Optional) Public read of featured subscription plans (no secrets). If you keep all plans public, allow select:
alter table public.subscription_plans enable row level security;
drop policy if exists sp_public_read on public.subscription_plans;
create policy sp_public_read
  on public.subscription_plans
  for select
  using (true);

-- NOTE: Writes remain via Edge (service role). No client write policies are added.
