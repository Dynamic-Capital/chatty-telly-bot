-- Add additional OCR fields for bank receipts
alter table receipts add column if not exists ocr_bank text;
alter table receipts add column if not exists ocr_status text;
alter table receipts add column if not exists ocr_reference text;
alter table receipts add column if not exists ocr_from_name text;
alter table receipts add column if not exists ocr_to_account text;
alter table receipts add column if not exists ocr_success_word boolean;
alter table receipts add column if not exists ocr_txn_date timestamptz;
alter table receipts add column if not exists ocr_value_date timestamptz;
