import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// TODO: If ocr_jobs already exists, re-use it; otherwise create idempotently.
// This scheduled worker should process pending OCR jobs.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

Deno.serve(async () => {
  // TODO: fetch pending jobs, run OCR + parse + decision, update DB, send Telegram updates.
  return new Response("ok");
});
