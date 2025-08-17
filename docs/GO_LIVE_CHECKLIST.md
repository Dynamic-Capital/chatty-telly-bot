# Go Live Checklist

- [ ] Webhook set & verified.
- [ ] Bank happy path (should approve).
- [ ] Bank near-miss (manual_review with reason).
- [ ] Duplicate image (blocked).
- [ ] (If crypto enabled) TXID awaiting confirmations → approve later.
- [ ] Admin commands respond.

## Local webhook smoke test

```bash
# Start local stack
supabase start

# Serve the function (new terminal)
supabase functions serve telegram-bot --no-verify-jwt

# Ping (expects 200)
  curl -X POST "http://127.0.0.1:54321/functions/v1/telegram-bot" \
    -H "content-type: application/json" \
    -H "X-Telegram-Bot-Api-Secret-Token: $TELEGRAM_WEBHOOK_SECRET" \
    -d '{"test":"ping"}'
```

### Mini App launch options

- Preferred: set `MINI_APP_SHORT_NAME` (from BotFather, e.g. `dynamic_pay`)
- Fallback: set `MINI_APP_URL` (full https URL)

### Set a persistent chat menu button (optional)

# Requires TELEGRAM_BOT_TOKEN set in your shell

curl -X POST
"https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setChatMenuButton"\
-H "content-type: application/json"\
-d '{"menu_button":{"type":"web_app","text":"Dynamic
Pay","web_app":{"short_name":"dynamic_pay"}}}'

## Telegram connect (Webhook quick cmds)

```bash
# Delete existing webhook
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/deleteWebhook"

# Set webhook with secret token (replace <PROJECT_REF>)
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -d "url=https://<PROJECT_REF>.functions.supabase.co/telegram-bot" \
  -d "secret_token=$TELEGRAM_WEBHOOK_SECRET"

# Inspect current webhook
curl -s "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo"
```

### Secret-token validation

- Telegram includes `X-Telegram-Bot-Api-Secret-Token` on each webhook request.
- The bot compares this header to `TELEGRAM_WEBHOOK_SECRET` and rejects
  mismatches with `401`.
- See [Telegram setWebhook docs](https://core.telegram.org/bots/api#setwebhook)
  for more info.

Note: /start shows Mini App button (short_name preferred, URL fallback).
