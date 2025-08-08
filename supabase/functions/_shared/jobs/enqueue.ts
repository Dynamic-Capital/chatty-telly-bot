import { createClient } from "npm:@supabase/supabase-js@2";
import { log } from "../logging.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface Payload {
  user_id: string;
  payment_id?: string | null;
  storage_path: string;
  sha256: string;
}

export async function enqueueOCR(payload: Payload) {
  try {
    await client.rpc("pgmq_send", { queue_name: "ocr", message: payload });
    log("pgmq_enqueue", { sha: payload.sha256 });
  } catch (err) {
    // Fallback to table
    await client.from("ocr_jobs").insert({
      status: "pending",
      attempts: 0,
      next_run_at: new Date().toISOString(),
      payload,
      sha256: payload.sha256,
    }).onConflict("sha256").ignore();
    log("table_enqueue", { sha: payload.sha256, error: err.message });
  }
}
