-- ensure payment_intents table and columns exist
create table if not exists payment_intents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  method text not null,
  expected_amount numeric(18,2) not null,
  currency text not null default 'USD',
  pay_code text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  notes text
);

alter table payment_intents add column if not exists expected_beneficiary_name text;
alter table payment_intents add column if not exists expected_beneficiary_account_last4 text;

-- ensure receipts table and columns exist
create table if not exists receipts (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid references payment_intents(id) on delete cascade,
  user_id uuid not null,
  file_url text not null,
  image_sha256 text not null,
  bank text,
  ocr_text text,
  ocr_amount numeric(18,2),
  ocr_currency text,
  ocr_status text,
  ocr_success_word boolean,
  ocr_reference text,
  ocr_from_name text,
  ocr_to_name text,
  ocr_to_account text,
  ocr_pay_code text,
  ocr_txn_date timestamptz,
  ocr_value_date timestamptz,
  verdict text not null default 'manual_review',
  reason text,
  created_at timestamptz not null default now()
);

alter table receipts add column if not exists bank text;
alter table receipts add column if not exists ocr_currency text;
alter table receipts add column if not exists ocr_status text;
alter table receipts add column if not exists ocr_success_word boolean;
alter table receipts add column if not exists ocr_reference text;
alter table receipts add column if not exists ocr_from_name text;
alter table receipts add column if not exists ocr_to_name text;
alter table receipts add column if not exists ocr_to_account text;
alter table receipts add column if not exists ocr_txn_date timestamptz;
alter table receipts add column if not exists ocr_value_date timestamptz;
create unique index if not exists receipts_image_sha256_idx on receipts (image_sha256);
