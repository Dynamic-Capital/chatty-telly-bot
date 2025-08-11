// scripts/assert-miniapp-config.ts
// Prints whether required Mini App envs are present at runtime (non-fatal).
// Use locally or in CI to catch why the bot says "Mini app not configured yet".
const MUST = ["MINI_APP_URL", "TELEGRAM_BOT_TOKEN", "TELEGRAM_WEBHOOK_SECRET"];
const NICE = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_PROJECT_ID"];

function mark(k: string) {
  const present = !!Deno.env.get(k);
  console.log(`[preflight] ${k}: ${present ? "present" : "MISSING"}`);
}

console.log("=== Mini App Preflight ===");
for (const k of MUST) mark(k);
for (const k of NICE) mark(k);
console.log(
  "Tip: set MINI_APP_URL in Supabase Edge secrets, then redeploy the telegram-bot function.",
);
// Never fail CI: exit 0.
Deno.exit(0);
