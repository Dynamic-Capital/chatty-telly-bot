# Tests

Integration tests cover live webhook endpoints using mock external services.

## Required Environment Variables

The tests set placeholder values for required secrets, but the following
variables may be overridden when running the suite:

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL` | Base URL for the mocked Supabase client |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key for database access |
| `BINANCE_SECRET_KEY` | Secret used to verify Binance Pay signatures |
| `TELEGRAM_BOT_TOKEN` | Token for sending Telegram messages |
| `TELEGRAM_WEBHOOK_SECRET` | Secret header expected by the Telegram webhook |
| `MINI_APP_URL` | Optional base URL returned in `/start` responses |

These values are populated with dummy data inside the tests themselves, so no
real credentials are required to run `npm test`.
