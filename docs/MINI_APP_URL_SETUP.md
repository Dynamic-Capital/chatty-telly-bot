# MINI_APP_URL setup (Supabase Edge)

## Why you see “Mini app not configured yet”

The bot didn’t find `MINI_APP_URL` (or your function wasn’t redeployed after
setting it).

## Steps (prod)

1. Set secrets in Supabase Edge: npx supabase login npx supabase link
   --project-ref <PROJECT_REF> npx supabase secrets set
   MINI_APP_URL=https://mini.dynamic.capital/

ensure these are set as well: npx supabase secrets set
TELEGRAM_WEBHOOK_SECRET=<same value used in setWebhook> npx supabase secrets set
TELEGRAM_BOT_TOKEN=<token>

2. Redeploy the bot function so it reads new env: npx supabase functions deploy
   telegram-bot

3. (One-time) set Telegram chat menu button: export TELEGRAM_BOT_TOKEN=<token>
   export MINI_APP_URL=https://mini.dynamic.capital/ deno run -A
   scripts/set-chat-menu-button.ts

4. Sanity: deno run -A scripts/assert-miniapp-config.ts

Notes:

- Use a trailing slash in `MINI_APP_URL` to avoid redirects in Telegram.
- Keep all runtime secrets in **Supabase Edge**. CI can have `MINI_APP_URL` too
  if your workflows read it, but the bot reads Edge values.
