# Linkage Checklist — Telegram Bot ⇄ Mini App (Same Edge Functions)

This kit checks that:
- The bot webhook URL equals `https://<PROJECT_REF>.functions.supabase.co/telegram-bot`
- `MINI_APP_URL` is set and its **host** aligns with the same project (or your trusted domain)
- All Edge function calls in the repo use the same Supabase Functions host
- Edge runtime sees the required envs (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `MINI_APP_URL`, `SUPABASE_URL/ANON_KEY/PROJECT_ID`)

## How to run
Outside runtime (CI/local)
deno run -A scripts/audit-edge-hosts.ts
deno run -A scripts/check-linkage.ts

Inside runtime (Edge)
Deploy linkage-audit and visit:
https://<PROJECT_REF>.functions.supabase.co/linkage-audit

Fixes:
- If webhook host differs: re-run setWebhook with the right URL/secret.
- If MINI_APP_URL missing in Edge: set it via `supabase secrets set` and redeploy `telegram-bot`.
- If mismatched hosts found: replace hard-coded URLs by importing `_shared/edge.ts` → `functionUrl("name")`.
