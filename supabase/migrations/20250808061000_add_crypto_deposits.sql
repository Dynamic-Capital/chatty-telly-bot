create table if not exists payment_intents (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  method text not null,
  network text,
  expected_amount numeric(36,18),
  currency text,
  deposit_address text,
  min_confirmations int default 0,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  failure_reason text,
  metadata jsonb
);
create index if not exists payment_intents_user_id_idx on payment_intents(user_id);

create table if not exists crypto_deposits (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references payment_intents(id) on delete cascade,
  network text not null,
  token_contract text not null,
  txid text not null,
  from_address text,
  to_address text not null,
  amount numeric(36,18) not null,
  decimals int not null default 6,
  confirmations int not null default 0,
  status text not null default 'seen',
  raw jsonb,
  created_at timestamptz not null default now()
);
create unique index if not exists crypto_deposits_txid_key on crypto_deposits (txid);
