import { createClient } from "npm:@supabase/supabase-js@2";
import { safeSend } from "../_shared/security/safe-send.ts";
import { log } from "../_shared/logging.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

Deno.serve(async (req: Request) => {
  const payload = await req.json();
  const record = payload.record;
  const table = payload.table ?? "receipts";
  if (!record || record.already_notified) return new Response("OK", { status: 200 });
  try {
    await safeSend(BOT_TOKEN, record.user_id, "✅ Payment approved");
    await client.from(table).update({ already_notified: true }).eq("id", record.id);
    log("notified", { table, id: record.id });
  } catch (err) {
    log("notify_fail", { error: (err as Error).message });
  }
  return new Response("OK", { status: 200 });
});
