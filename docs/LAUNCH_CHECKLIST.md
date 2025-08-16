# Launch Checklist

## Required Secrets

| Name | Purpose |
| --- | --- |
| SUPABASE_URL | Supabase project URL |
| SUPABASE_SERVICE_ROLE_KEY | Service role key for full access |
| TELEGRAM_BOT_TOKEN | Bot token from BotFather |
| TELEGRAM_WEBHOOK_SECRET | Secret for webhook validation |
| MINI_APP_URL | Full URL to hosted Mini App (fallback) |
| MINI_APP_SHORT_NAME | BotFather short name launching the Mini App |
| ADMIN_API_SECRET | Header secret for admin-only endpoints |
| SUPABASE_ANON_KEY | Public anon key for client access |
| SUPABASE_PROJECT_ID | Supabase project reference |
| SUPABASE_ACCESS_TOKEN | Personal access token for CLI tasks |
| SUPABASE_DB_PASSWORD | Database password used by migrations |

Set each value in **Supabase Edge → Functions → Secrets** before deploying.

## Audit and Keeper

### Run linkage audit

Use the `sync-audit` function to verify secrets and Telegram linkage. Passing `fix:true` attempts to repair drift:

```bash
curl -s https://<PROJECT_REF>.functions.supabase.co/sync-audit \
  -H "content-type: application/json" \
  -H "x-admin-secret: $ADMIN_API_SECRET" \
  -d '{"fix":true}' | jq .
```

### Schedule the webhook keeper

Deploy and schedule the keeper so the webhook and menu button stay correct:

```bash
npx supabase functions deploy telegram-webhook-keeper
npx supabase functions schedule create "*/15 * * * *" telegram-webhook-keeper
```

The keeper re-applies the expected webhook and menu URL if Telegram resets them.

## BotFather vs `MINI_APP_URL`

- `MINI_APP_SHORT_NAME` comes from BotFather and produces `https://t.me/<bot>/<short_name>`; this is the preferred launch path.
- `MINI_APP_URL` is a full URL fallback used when the short name is missing or during migrations.

### Safe roll-forward

1. Set `MINI_APP_URL` to the new location and redeploy the bot.
2. Run `sync-audit` with `fix:true` to push the menu and webhook updates.
3. Configure `MINI_APP_SHORT_NAME` in BotFather pointing to the new Mini App.
4. After verifying, remove `MINI_APP_URL` so the short name becomes authoritative.

This sequence avoids downtime while transitioning between URL and BotFather configurations.
