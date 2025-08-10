-- Online-safe FK indexes (CONCURRENTLY). Run in Supabase SQL Editor.
-- If your runner blocks CONCURRENTLY, switch to the NON-concurrent block at bottom.

-- investments.investor_id -> investors.id
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_investments_investor_id
  ON public.investments (investor_id);

-- profit_distributions.investor_id -> investors.id
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profit_distributions_investor_id
  ON public.profit_distributions (investor_id);

-- profit_distributions.fund_cycle_id -> fund_pool.id
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profit_distributions_fund_cycle_id
  ON public.profit_distributions (fund_cycle_id);

-- withdrawal_requests.investor_id -> investors.id
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_withdrawal_requests_investor_id
  ON public.withdrawal_requests (investor_id);

-- bot_commands.created_by -> auth.users.id
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bot_commands_created_by
  ON public.bot_commands (created_by);

-- bot_notifications.created_by -> auth.users.id
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bot_notifications_created_by
  ON public.bot_notifications (created_by);

-- Optional helpful indexes (commented): join/filter hot paths
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payment_records_user_id ON public.payment_records (user_id);
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_user_id ON public.messages (user_id);
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payment_status_created ON public.payment_records (status, created_at);

---- NON-CONCURRENT FALLBACK (use ONE block only)
-- CREATE INDEX IF NOT EXISTS idx_investments_investor_id ON public.investments (investor_id);
-- CREATE INDEX IF NOT EXISTS idx_profit_distributions_investor_id ON public.profit_distributions (investor_id);
-- CREATE INDEX IF NOT EXISTS idx_profit_distributions_fund_cycle_id ON public.profit_distributions (fund_cycle_id);
-- CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_investor_id ON public.withdrawal_requests (investor_id);
-- CREATE INDEX IF NOT EXISTS idx_bot_commands_created_by ON public.bot_commands (created_by);
-- CREATE INDEX IF NOT EXISTS idx_bot_notifications_created_by ON public.bot_notifications (created_by);
