-- Create payment_intents and crypto_deposits tables

create table if not exists payment_intents (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  subscription_id uuid references user_subscriptions(id) on delete cascade,
  method text not null,
  network text,
  expected_amount numeric(36,18) not null,
  currency text not null default 'USDT',
  deposit_address text,
  min_confirmations int not null default 20,
  status text not null default 'pending',
  txid text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payment_intents_user_status_idx on payment_intents(user_id, status);
create index if not exists payment_intents_subscription_idx on payment_intents(subscription_id);

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
