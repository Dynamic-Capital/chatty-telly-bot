// scripts/assert-miniapp-config.ts
// Prints whether required Mini App envs are present at runtime (non-fatal).
// Use locally or in CI to catch why the bot says "Mini app not configured yet".
import { functionUrl } from "../supabase/functions/_shared/edge.ts";

const MUST = ["TELEGRAM_BOT_TOKEN", "TELEGRAM_WEBHOOK_SECRET"];
const EITHER = ["MINI_APP_URL", "MINI_APP_SHORT_NAME"];
const NICE = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_PROJECT_ID"];

function mark(k: string) {
  const present = !!Deno.env.get(k);
  console.log(`[preflight] ${k}: ${present ? "present" : "MISSING"}`);
}

console.log("=== Mini App Preflight ===");
for (const k of MUST) mark(k);
console.log(
  `[preflight] MINI_APP_URL || MINI_APP_SHORT_NAME: ${
    EITHER.some((k) => Deno.env.get(k)) ? "present" : "MISSING"
  }`,
);
for (const k of NICE) mark(k);

const secret = Deno.env.get("TELEGRAM_WEBHOOK_SECRET");
const fnUrl = functionUrl("telegram-bot");
if (secret && fnUrl) {
  try {
    const res = await fetch(`${fnUrl}?miniapp-config=1&secret=${secret}`);
    const cfg = await res.json();
    console.log(
      `[edge] MINI_APP_URL: ${cfg.mini_app_url ?? "MISSING"}`,
    );
    console.log(
      `[edge] MINI_APP_SHORT_NAME: ${cfg.mini_app_short_name ?? "MISSING"}`,
    );
  } catch (e) {
    console.log(`[edge] fetch error ${(e as Error).message}`);
  }
}

console.log(
  "Tip: set MINI_APP_URL or MINI_APP_SHORT_NAME in Supabase Edge secrets, then redeploy the telegram-bot function.",
);
// Never fail CI: exit 0.
Deno.exit(0);
