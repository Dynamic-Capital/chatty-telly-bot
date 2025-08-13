# Deployment & Troubleshooting

## Environment variables

Essential settings for the bot and Edge Functions. See [env.md](env.md) for a
full list and usage notes.

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `TELEGRAM_ADMIN_IDS` (optional)
- `MINI_APP_URL` or `MINI_APP_SHORT_NAME` (optional)

## Test commands

Run basic checks before deploying:

```bash
deno check supabase/functions/telegram-bot/*.ts supabase/functions/telegram-bot/**/*.ts
deno test -A
```

## Deployment steps

1. Deploy the function:

```bash
supabase functions deploy telegram-bot --project-ref <PROJECT_REF>
```

2. Set the Telegram webhook with the secret token:

```bash
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -d "url=https://<PROJECT_REF>.functions.supabase.co/telegram-bot" \
  -d "secret_token=$TELEGRAM_WEBHOOK_SECRET"
```

## Troubleshooting

### Resetting bot token

1. Regenerate the token via BotFather (`/token`).
2. Update the secret used by Edge Functions:

```bash
supabase secrets set TELEGRAM_BOT_TOKEN=<new token>
```

3. Confirm the value:

```bash
supabase secrets get TELEGRAM_BOT_TOKEN
```

4. Redeploy the function so it picks up the new token (see below).

### Redeploying Edge Functions

If updates or new secrets are not reflected, redeploy:

```bash
supabase functions deploy telegram-bot --project-ref <PROJECT_REF>
```

Ensure the webhook still points to the current deployment and rerun tests after
redeploying.
