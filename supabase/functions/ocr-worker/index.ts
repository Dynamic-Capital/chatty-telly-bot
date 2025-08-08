// TODO: Scheduled worker to process OCR jobs.
// This worker should run every 1-2 minutes and process entries from the
// `ocr_jobs` table by downloading files, performing OCR, parsing slips,
// and updating related database records. It should also send Telegram
// updates to users upon completion.
// If the table already exists it should be reused; otherwise create it
// idempotently in migrations.

export const placeholder = true;
