-- Helpful indexes
create index if not exists idx_payments_status_method on public.payments(status, payment_method);
create index if not exists idx_payments_updated_at on public.payments(updated_at);

-- Store app-wide verification tolerances in bot_settings (if not present)
insert into public.bot_settings (content_key, content_value, content_type)
select 'AMOUNT_TOLERANCE', '0.05', 'text'
where not exists (select 1 from public.bot_settings where content_key='AMOUNT_TOLERANCE');

insert into public.bot_settings (content_key, content_value, content_type)
select 'WINDOW_SECONDS', '7200', 'text'  -- 2h receipt time window
where not exists (select 1 from public.bot_settings where content_key='WINDOW_SECONDS');

