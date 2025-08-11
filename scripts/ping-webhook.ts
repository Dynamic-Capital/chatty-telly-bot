// scripts/ping-webhook.ts
/**
 * Sends a synthetic /start update to your deployed Edge function.
 * - Adds X-Telegram-Bot-Api-Secret-Token header (your webhook secret)
 * - Also appends ?secret=... to URL for handlers that expect query validation
 * - Body matches Telegram update shape for a /start command.
 *
 * Env:
 *   TELEGRAM_WEBHOOK_SECRET (required)
 *   TELEGRAM_WEBHOOK_URL    (optional; if missing, derived from SUPABASE_PROJECT_ID)
 *   SUPABASE_PROJECT_ID     (used only if TELEGRAM_WEBHOOK_URL missing)
 *
 * Usage:
 *   deno run -A scripts/ping-webhook.ts
 */
const secret = Deno.env.get("TELEGRAM_WEBHOOK_SECRET");
if (!secret) {
  console.error("Missing TELEGRAM_WEBHOOK_SECRET");
  Deno.exit(1);
}
const explicitUrl = Deno.env.get("TELEGRAM_WEBHOOK_URL");
const proj = Deno.env.get("SUPABASE_PROJECT_ID");

let baseUrl =
  explicitUrl ?? (proj ? `https://${proj}.functions.supabase.co/telegram-bot` : null);

if (!baseUrl) {
  console.error("Provide TELEGRAM_WEBHOOK_URL or SUPABASE_PROJECT_ID");
  Deno.exit(1);
}

// Ensure the secret is also present as a query param for maximum compatibility
const url = baseUrl.includes("?") ? `${baseUrl}&secret=${encodeURIComponent(secret)}` : `${baseUrl}?secret=${encodeURIComponent(secret)}`;

const update = {
  update_id: 999999,
  message: {
    message_id: 1,
    date: Math.floor(Date.now() / 1000),
    chat: { id: 123456789, type: "private" },
    from: { id: 123456789, is_bot: false, first_name: "Diag" },
    text: "/start",
    entities: [{ offset: 0, length: 6, type: "bot_command" }],
  },
};

const res = await fetch(url, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "X-Telegram-Bot-Api-Secret-Token": secret,
  },
  body: JSON.stringify(update),
});

console.log("POST", url, "→", res.status);
const body = await res.text();
console.log("Response preview:", body.slice(0, 300) || "(empty)");
