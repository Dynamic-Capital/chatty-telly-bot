# Config Secrets

Supabase Edge secrets are the single source of truth for configuration. Never
commit `.env` files or hard-coded secrets. When a webhook secret exists in the
database (`bot_settings.TELEGRAM_WEBHOOK_SECRET`), it overrides the
`TELEGRAM_WEBHOOK_SECRET` environment value.

## Required secrets

The following secrets must be present so edge functions can run:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `MINI_APP_URL`

You can set them with the Supabase CLI or run
`scripts/setup-telegram-webhook.sh` which reads the values from your local
environment and uploads them:

```bash
SUPABASE_URL=... \
SUPABASE_SERVICE_ROLE_KEY=... \
TELEGRAM_BOT_TOKEN=... \
TELEGRAM_WEBHOOK_SECRET=... \
MINI_APP_URL=... \
scripts/setup-telegram-webhook.sh
```
