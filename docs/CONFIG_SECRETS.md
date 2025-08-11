# Config Secrets

Supabase Edge secrets are the single source of truth for configuration. Never
commit `.env` files or hard-coded secrets. When a webhook secret exists in the
database (`bot_settings.TELEGRAM_WEBHOOK_SECRET`), it overrides the
`TELEGRAM_WEBHOOK_SECRET` environment value.
