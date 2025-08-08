-- Seed bank account details
INSERT INTO bank_accounts (bank_name, account_name, account_number, currency, is_active, display_order)
VALUES
  ('BML', 'ABDL.M.I.AFLHAL', '7730000133061', 'MVR', true, 1),
  ('MIB', 'Abdul M. I. A', '90103101672241000', 'MVR', true, 2),
  ('MIB', 'Abdul M. I. A', '90103101672242000', 'USD', true, 3)
ON CONFLICT (account_number) DO UPDATE SET
  bank_name = EXCLUDED.bank_name,
  account_name = EXCLUDED.account_name,
  currency = EXCLUDED.currency,
  is_active = EXCLUDED.is_active,
  display_order = EXCLUDED.display_order;
