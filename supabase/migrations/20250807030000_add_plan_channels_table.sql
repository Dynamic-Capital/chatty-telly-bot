-- Create table for storing Telegram channel and group links per subscription plan
create table if not exists plan_channels (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references subscription_plans(id) on delete cascade,
  channel_name text not null,
  channel_type text check (channel_type in ('channel','group')) default 'channel',
  invite_link text not null,
  chat_id text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table plan_channels enable row level security;

-- Policy: anyone can view active plan channels
create policy "Public can view plan channels"
  on plan_channels for select
  to public
  using (is_active);

-- Policy: admins can manage plan channels
create policy "Admins can manage plan channels"
  on plan_channels for all
  to authenticated
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- Index for faster lookups
create index if not exists idx_plan_channels_plan_id_active
  on plan_channels(plan_id, is_active);

-- Trigger to maintain updated_at
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists update_plan_channels_updated_at on plan_channels;
create trigger update_plan_channels_updated_at
  before update on plan_channels
  for each row execute function update_updated_at_column();

