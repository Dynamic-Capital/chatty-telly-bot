# MINI_APP_URL setup (Supabase Edge)

## Why you see “Mini app not configured yet” or no button

The bot didn’t find `MINI_APP_URL` or `MINI_APP_SHORT_NAME`, or your function
wasn’t redeployed after setting them. When missing, `/start` logs a warning and
skips the **Open Mini App** button.

## Steps (prod)

1. Set secrets in Supabase Edge:

   ```bash
   npx supabase login
 npx supabase link --project-ref <PROJECT_REF>
  # Provide either a full URL or a short name
  npx supabase secrets set MINI_APP_URL=https://qeejuomcapbdlhnjqjcc.functions.supabase.co/miniapp/
  # or
  # npx supabase secrets set MINI_APP_SHORT_NAME=<short_name>
   npx supabase secrets set TELEGRAM_WEBHOOK_SECRET=<same value used in setWebhook>
   npx supabase secrets set TELEGRAM_BOT_TOKEN=<token>
   ```

2. Redeploy the bot function so it reads new env:

   ```bash
   npx supabase functions deploy telegram-bot
   ```

3. (One-time) set Telegram chat menu button:

   ```bash
   export TELEGRAM_BOT_TOKEN=<token>
   # Either MINI_APP_URL or MINI_APP_SHORT_NAME
   export MINI_APP_URL=https://qeejuomcapbdlhnjqjcc.functions.supabase.co/miniapp/
   # export MINI_APP_SHORT_NAME=<short_name>
   deno run -A scripts/set-chat-menu-button.ts
   ```

4. Sanity:

   ```bash
 deno run -A scripts/assert-miniapp-config.ts
  ```

Notes:

- Use a trailing slash in `MINI_APP_URL` to avoid redirects in Telegram.
- If `/start` still lacks the button, confirm the secret is set and the
  function redeployed; check Supabase logs for the warning above.
- Keep all runtime secrets in **Supabase Edge**. CI can have `MINI_APP_URL` too
  if your workflows read it, but the bot reads Edge values.
