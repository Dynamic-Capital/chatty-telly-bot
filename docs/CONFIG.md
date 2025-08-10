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
| MINI_APP_URL              | ✅                           | ✅                               | ✅                          |

`✅` indicates where each key should be set.

`MINI_APP_URL` should point to the deployed Telegram Mini App (for example,
`https://mini.dynamic.capital/`). If set, the bot shows a Mini App button and
will automatically append a trailing slash if missing to avoid redirect issues.
