-- payments / intents
create table if not exists payment_intents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  method text not null check (method in ('bank','crypto')),
  expected_amount numeric(18,2) not null,
  currency text not null default 'USD',
  pay_code text,
  status text not null default 'pending' check (status in ('pending','approved','manual_review','rejected')),
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  notes text
);

create index on payment_intents (user_id, status, created_at desc);
create index on payment_intents (pay_code);

-- receipts
create table if not exists receipts (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references payment_intents(id) on delete cascade,
  user_id uuid not null,
  file_url text not null,
  image_sha256 text not null,
  ocr_text text,
  ocr_amount numeric(18,2),
  ocr_currency text,
  ocr_timestamp timestamptz,
  ocr_beneficiary text,
  ocr_pay_code text,
  verdict text not null default 'manual_review' check (verdict in ('approved','manual_review','rejected')),
  reason text,
  created_at timestamptz not null default now()
);

create unique index on receipts (image_sha256);
