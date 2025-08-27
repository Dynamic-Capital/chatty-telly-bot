import { parse } from "https://deno.land/std@0.224.0/csv/mod.ts";

const file = Deno.args[0];
if (!file) {
  console.error("Usage: deno run -A scripts/import-vip-csv.ts <file.csv>");
  Deno.exit(1);
}
const text = await Deno.readTextFile(file);
const rows = parse(text, { columns: true }) as Array<Record<string, string>>;

const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_SECRET = Deno.env.get("ADMIN_API_SECRET") || "";

for (const row of rows) {
  const telegram_id = row.telegram_id || row.id;
  if (!telegram_id) continue;
  const username = row.username || null;
  await fetch(`${SUPA_URL}/rest/v1/bot_users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify({ telegram_id, username }),
  });
  const res = await fetch(`${SUPA_URL}/functions/v1/vip-sync/one`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Secret": ADMIN_SECRET,
    },
    body: JSON.stringify({ telegram_user_id: telegram_id }),
  }).then((r) => r.json()).catch(() => null);
  console.log(telegram_id, res);
}
