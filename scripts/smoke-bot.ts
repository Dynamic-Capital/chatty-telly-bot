// scripts/smoke-bot.ts
/**
 * Basic smoke checks for the telegram-bot function.
 *
 * Env:
 *   FUNCTIONS_BASE  Base URL for your Supabase functions (e.g. https://xyz.functions.supabase.co)
 *
 * Usage:
 *   FUNCTIONS_BASE=https://xyz.functions.supabase.co deno run -A scripts/smoke-bot.ts
 *
 * Performs simple HTTP requests and prints the status codes.
 */

const base = Deno.env.get("FUNCTIONS_BASE");
if (!base) {
  console.error("Set FUNCTIONS_BASE to your functions base URL.");
  Deno.exit(1);
}

async function check(path: string, init?: RequestInit) {
  try {
    const res = await fetch(`${base}${path}`, init);
    console.log(`${init?.method ?? "GET"} ${path} ->`, res.status);
  } catch (err) {
    console.error(`${init?.method ?? "GET"} ${path} -> error`, err);
  }
}

await check("/telegram-bot/version");
await check("/telegram-bot");
await check("/telegram-bot", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: "{}",
});
