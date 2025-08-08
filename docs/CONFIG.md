# Configuration

The project relies on a shared set of environment keys. Set them in your local `.env`, Supabase function secrets, and GitHub Actions secrets as indicated below.

| Key | Codex project settings (dev) | Supabase function secrets (prod) | GitHub Actions secrets (CI) |
| --- | --- | --- | --- |
| SUPABASE_URL | ✅ | ✅ | ❌ |
| SUPABASE_ANON_KEY | ✅ | ✅ | ❌ |
| SUPABASE_SERVICE_ROLE_KEY | ✅ | ✅ | ❌ |
| SUPABASE_PROJECT_ID | ✅ | ✅ | ✅ |
| SUPABASE_ACCESS_TOKEN | ✅ | ✅ | ✅ |
| SUPABASE_DB_PASSWORD | ✅ | ✅ | ✅ |
| TELEGRAM_BOT_TOKEN | ✅ | ✅ | ❌ |
| TELEGRAM_WEBHOOK_SECRET | ✅ | ✅ | ❌ |
| BENEFICIARY_TABLE | ✅ | ✅ | ❌ |
| OPENAI_API_KEY | ✅ | ✅ | ❌ |
| OPENAI_ENABLED | ✅ | ✅ | ❌ |
| FAQ_ENABLED | ✅ | ✅ | ❌ |
| WINDOW_SECONDS | ✅ | ✅ | ❌ |
| AMOUNT_TOLERANCE | ✅ | ✅ | ❌ |

`✅` indicates where each key should be set.
