# Configuration

The project relies on a shared set of environment keys. Set them in your local
`.env`, Supabase function secrets, and GitHub Actions secrets as indicated
below.

| Key                       | Codex project settings (dev) | Supabase function secrets (prod) | GitHub Actions secrets (CI) |
| ------------------------- | ---------------------------- | -------------------------------- | --------------------------- |
| SUPABASE_URL              | ✅                           | ✅                               | ❌                          |
| SUPABASE_ANON_KEY         | ✅                           | ✅                               | ❌                          |
| SUPABASE_SERVICE_ROLE_KEY | ✅                           | ✅                               | ❌                          |
| SUPABASE_PROJECT_ID       | ✅                           | ✅                               | ✅                          |
| SUPABASE_ACCESS_TOKEN     | ✅                           | ✅                               | ✅                          |
| SUPABASE_DB_PASSWORD      | ✅                           | ✅                               | ✅                          |
| TELEGRAM_BOT_TOKEN        | ✅                           | ✅                               | ❌                          |
| TELEGRAM_WEBHOOK_SECRET   | ✅                           | ✅                               | ❌                          |
| BENEFICIARY_TABLE         | ✅                           | ✅                               | ❌                          |
| OPENAI_API_KEY            | ✅                           | ✅                               | ❌                          |
| OPENAI_ENABLED            | ✅                           | ✅                               | ❌                          |
| FAQ_ENABLED               | ✅                           | ✅                               | ❌                          |
| WINDOW_SECONDS            | ✅                           | ✅                               | ❌                          |
| AMOUNT_TOLERANCE          | ✅                           | ✅                               | ❌                          |
| SESSION_TIMEOUT_MINUTES   | ✅                           | ✅                               | ❌                          |
| FOLLOW_UP_DELAY_MINUTES   | ✅                           | ✅                               | ❌                          |
| MAX_FOLLOW_UPS            | ✅                           | ✅                               | ❌                          |
| MINI_APP_URL              | ✅                           | ✅                               | ✅                          |
| MINI_APP_SHORT_NAME       | ✅                           | ✅                               | ✅                          |
| LOGTAIL_SOURCE_TOKEN      | ✅                           | ❌                               | ❌                          |

`✅` indicates where each key should be set.

Either `MINI_APP_URL` or `MINI_APP_SHORT_NAME` must be set for the `/start`
command to show an **Open Mini App** button. If neither is configured, the bot
logs a warning and omits the button. `MINI_APP_URL` should point to the deployed
Telegram Mini App (for example,
`https://qeejuomcapbdlhnjqjcc.functions.supabase.co/miniapp/`) and will
automatically append a trailing slash if missing to avoid redirect issues.
