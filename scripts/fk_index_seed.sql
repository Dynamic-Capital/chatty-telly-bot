-- Safe seed for obvious FKs (only runs if Splinter misses them)
CREATE INDEX IF NOT EXISTS idx_investments_investor_id ON public.investments (investor_id);
CREATE INDEX IF NOT EXISTS idx_profit_distributions_investor_id ON public.profit_distributions (investor_id);
CREATE INDEX IF NOT EXISTS idx_profit_distributions_fund_cycle_id ON public.profit_distributions (fund_cycle_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_investor_id ON public.withdrawal_requests (investor_id);
