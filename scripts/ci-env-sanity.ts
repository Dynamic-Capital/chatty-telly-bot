// scripts/ci-env-sanity.ts
// Purpose: Print presence (not values) of key env vars; never fails CI.
const keys = [
  "SUPABASE_PROJECT_ID",
  "SUPABASE_ACCESS_TOKEN",
  "SUPABASE_DB_PASSWORD",
  "MINI_APP_URL",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_WEBHOOK_SECRET"
];
for (const k of keys) {
  const present = Deno.env.get(k) ? "present" : "missing";
  console.log(`[env] ${k}: ${present}`);
}
// Intentionally always exit 0
Deno.exit(0);
