- Secret precedence: ENV -> DB -> auto-generate.
- If auto-generated, it is stored at public.bot_settings
  (key=TELEGRAM_WEBHOOK_SECRET).
- The bot validates the header against either ENV or DB value.
- For maximum resilience, you can later mirror the DB value into Edge secrets
  via CLI: npx supabase secrets set TELEGRAM_WEBHOOK_SECRET=<value>
