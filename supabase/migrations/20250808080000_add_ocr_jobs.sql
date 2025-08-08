-- optional ocr_jobs table for background OCR processing
create table if not exists ocr_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  file_id text not null,
  file_url text,
  created_at timestamptz not null default now(),
  status text not null default 'pending'
);
