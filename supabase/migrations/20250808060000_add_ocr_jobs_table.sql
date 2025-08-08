create table if not exists ocr_jobs (
  id bigserial primary key,
  status text not null default 'pending',
  attempts int not null default 0,
  next_run_at timestamptz not null default now(),
  payload jsonb not null,
  sha256 text unique
);

create index if not exists ocr_jobs_status_next_run_idx on ocr_jobs (status, next_run_at);

create table if not exists ocr_jobs_dead (
  id bigserial primary key,
  payload jsonb not null,
  sha256 text,
  attempts int default 0,
  error text,
  created_at timestamptz default now()
);
