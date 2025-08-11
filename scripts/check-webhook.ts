// scripts/check-webhook.ts
/**
 * Prints Telegram getWebhookInfo:
 * - current URL
 * - has_custom_certificate
 * - pending updates
 * - last error message & date
 *
 * Requires: TELEGRAM_BOT_TOKEN in env (Supabase Edge or local).
 * Never commit secrets. For local, export TELEGRAM_BOT_TOKEN before running.
 *
 * Usage:
 *   deno run -A scripts/check-webhook.ts
 */
const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
if (!token) {
  console.error("Missing TELEGRAM_BOT_TOKEN");
  Deno.exit(1);
}

const r = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
const j = await r.json();
if (!j.ok) {
  console.error("Telegram API error:", j);
  Deno.exit(1);
}

const info = j.result ?? {};
console.log("Webhook URL:", info.url || "(none)");
console.log("Has custom cert:", !!info.has_custom_certificate);
console.log("Pending updates:", info.pending_update_count ?? 0);
if (info.last_error_message) {
  const ts = info.last_error_date ? new Date(info.last_error_date * 1000).toISOString() : "";
  console.log("Last error:", info.last_error_message, ts ? `@ ${ts}` : "");
} else {
  console.log("No recent webhook errors recorded.");
}
