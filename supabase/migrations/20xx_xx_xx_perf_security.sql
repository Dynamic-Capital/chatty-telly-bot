-- Performance and security enhancements

-- Composite indexes for common lookups
create index if not exists idx_user_interactions_chat_created_at
  on public.user_interactions(chat_id, created_at);

create index if not exists idx_user_sessions_user_last_activity
  on public.user_sessions(user_id, last_activity);

-- Storage for rate limiting state
create table if not exists public.rl_counters (
  tg text primary key,
  count int not null default 0,
  expires_at timestamptz not null default now()
);

create index if not exists idx_rl_counters_expires_at
  on public.rl_counters(expires_at);

-- Atomic rate limiting touch function
create or replace function public.rl_touch(_tg text, _limit int)
returns void
language plpgsql
as $$
declare
  v_count int;
begin
  loop
    update public.rl_counters
    set
      count = case when now() > expires_at then 1 else count + 1 end,
      expires_at = case when now() > expires_at then now() + interval '1 minute' else expires_at end
    where tg = _tg
    returning count into v_count;

    if found then
      if v_count > _limit then
        raise exception 'rate_limited' using message = 'rate_limited', detail = 'rate_limited';
      end if;
      return;
    end if;

    begin
      insert into public.rl_counters (tg, count, expires_at)
      values (_tg, 1, now() + interval '1 minute');
      return;
    exception when unique_violation then
      -- concurrent insert, retry
    end;
  end loop;
end;
$$;
