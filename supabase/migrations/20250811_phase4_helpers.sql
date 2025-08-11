-- Optional RPC to find users expiring between two timestamps
create or replace function public.get_users_expiring_between(start_ts timestamptz, end_ts timestamptz)
returns table (id uuid, telegram_id text, subscription_expires_at timestamptz)
language sql
as $$
  select id, telegram_id, subscription_expires_at
  from public.bot_users
  where subscription_expires_at is not null
    and subscription_expires_at between start_ts and end_ts
$$;
