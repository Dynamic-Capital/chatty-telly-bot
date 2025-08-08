-- Add columns for LLM audit information if they don't exist
alter table receipts add column if not exists llm_fields_json jsonb;
alter table receipts add column if not exists judge_score numeric;
alter table receipts add column if not exists judge_reasons text;
alter table receipts add column if not exists parser_confidence numeric;
