-- Add extra OCR fields for bank slip parsing
alter table if exists receipts add column if not exists ocr_bank text;
alter table if exists receipts add column if not exists ocr_status text;
alter table if exists receipts add column if not exists ocr_reference text;
alter table if exists receipts add column if not exists ocr_from_name text;
alter table if exists receipts add column if not exists ocr_to_name text;
alter table if exists receipts add column if not exists ocr_to_account text;
alter table if exists receipts add column if not exists ocr_txn_date timestamptz;
alter table if exists receipts add column if not exists ocr_value_date timestamptz;
alter table if exists receipts add column if not exists ocr_success_word boolean;
