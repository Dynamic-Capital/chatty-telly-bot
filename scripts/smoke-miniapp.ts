// scripts/smoke-miniapp.ts
/**
 * Basic smoke checks for the deployed Mini App.
 *
 * Env:
 *   FUNCTIONS_BASE  Base URL for your Supabase functions (e.g. https://xyz.functions.supabase.co)
 *
 * Usage:
 *   FUNCTIONS_BASE=https://xyz.functions.supabase.co deno run -A scripts/smoke-miniapp.ts
 *
 * Performs simple HTTP requests and prints the status codes.
 *
 * Expected output (all status codes 200):
 *   HEAD /miniapp/ -> 200
 *   GET /miniapp/version -> 200
 *   HEAD /functions/v1/miniapp/ -> 200
 *   GET /functions/v1/miniapp/version -> 200
 */

const base = Deno.env.get("FUNCTIONS_BASE");
if (!base) {
  console.error("Set FUNCTIONS_BASE to your functions base URL.");
  Deno.exit(1);
}

let failed = false;

async function check(path: string, init?: RequestInit, failOnError = false) {
  try {
    const res = await fetch(`${base}${path}`, init);
    const msg = `${init?.method ?? "GET"} ${path} -> ${res.status}`;
    if (res.status !== 200 && failOnError) {
      failed = true;
      console.error(msg, "(expected 200)");
    } else {
      console.log(msg);
    }
  } catch (err) {
    if (failOnError) failed = true;
    console.error(`${init?.method ?? "GET"} ${path} -> error`, err);
  }
}

await check("/miniapp/", { method: "HEAD" });
await check("/miniapp/version");
await check("/functions/v1/miniapp/", { method: "HEAD" }, true);
await check("/functions/v1/miniapp/version", undefined, true);

if (failed) {
  console.error("One or more checks failed.");
  Deno.exit(1);
}
