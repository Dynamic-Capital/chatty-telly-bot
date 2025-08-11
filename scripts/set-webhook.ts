// scripts/set-webhook.ts
/**
 * Registers/updates the Telegram webhook with a secret and clears pending updates.
 *
 * Notes:
 * - Your current handler validates a `?secret=` query parameter. To be compatible,
 *   this script appends `?secret=...` to the webhook URL automatically.
 * - Telegram will also send the secret in header X-Telegram-Bot-Api-Secret-Token.
 *
 * Env (required):
 *   TELEGRAM_BOT_TOKEN
 *   TELEGRAM_WEBHOOK_URL  (base URL to your deployed function, without query params)
 *   TELEGRAM_WEBHOOK_SECRET
 *
 * Usage:
 *   deno run -A scripts/set-webhook.ts
 */
const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
const baseUrl = Deno.env.get("TELEGRAM_WEBHOOK_URL");
const secret = Deno.env.get("TELEGRAM_WEBHOOK_SECRET");

if (!token) {
  console.error("Missing TELEGRAM_BOT_TOKEN");
  Deno.exit(1);
}
if (!baseUrl) {
  console.error("Missing TELEGRAM_WEBHOOK_URL");
  Deno.exit(1);
}
if (!secret) {
  console.error("Missing TELEGRAM_WEBHOOK_SECRET");
  Deno.exit(1);
}

// Ensure the URL also carries the secret as a query parameter for handler compatibility
const urlWithSecret = baseUrl.includes("?")
  ? `${baseUrl}&secret=${encodeURIComponent(secret)}`
  : `${baseUrl}?secret=${encodeURIComponent(secret)}`;

const params = new URLSearchParams();
params.set("url", urlWithSecret);
params.set("secret_token", secret);
params.set("drop_pending_updates", "true");

const setRes = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: params,
});
const setJson = await setRes.json();
console.log("setWebhook status:", setRes.status);
console.log("setWebhook response:", JSON.stringify({ ok: setJson.ok, description: setJson.description }, null, 2));

// Follow-up: show getWebhookInfo summary
const infoRes = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
const infoJson = await infoRes.json();
if (infoJson.ok) {
  const i = infoJson.result ?? {};
  console.log("Webhook URL:", i.url || "(none)");
  console.log("Has custom cert:", !!i.has_custom_certificate);
  console.log("Pending updates:", i.pending_update_count ?? 0);
  if (i.last_error_message) {
    const ts = i.last_error_date ? new Date(i.last_error_date * 1000).toISOString() : "";
    console.log("Last error:", i.last_error_message, ts ? `@ ${ts}` : "");
  }
} else {
  console.warn("Could not fetch getWebhookInfo:", infoJson);
}
