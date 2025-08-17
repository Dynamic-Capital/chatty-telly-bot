- Secret precedence: ENV -> DB -> auto-generate.
- If auto-generated, it is stored at public.bot_settings
  (key=TELEGRAM_WEBHOOK_SECRET).
- For maximum resilience, you can later mirror the DB value into Edge secrets
  via CLI: npx supabase secrets set TELEGRAM_WEBHOOK_SECRET=<value>

## Secret-token validation

- When calling [setWebhook](https://core.telegram.org/bots/api#setwebhook), supply
  `secret_token` so Telegram signs requests.
- Telegram then includes `X-Telegram-Bot-Api-Secret-Token`; the keeper compares
  this header to the stored secret and replies `401` on mismatch.
