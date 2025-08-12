# RUNBOOK — Missing TELEGRAM_WEBHOOK_SECRET

## 1) Set secret in Supabase Edge

npx supabase login
npx supabase link --project-ref <PROJECT_REF>

generate one if needed: openssl rand -hex 32

npx supabase secrets set TELEGRAM_WEBHOOK_SECRET=<SAME_VALUE_YOU_WILL_SET_ON_TELEGRAM>
npx supabase functions deploy telegram-bot

## 2) Register webhook with the SAME secret

export TELEGRAM_BOT_TOKEN=xxxxx
export TELEGRAM_WEBHOOK_SECRET=<SAME_VALUE_AS_ABOVE>
export TELEGRAM_WEBHOOK_URL="https://<PROJECT_REF>.functions.supabase.co/telegram-bot"
deno run -A scripts/set-webhook.ts

## 3) Verify + ping

deno run -A scripts/check-webhook.ts
deno run -A scripts/ping-webhook.ts

If `/start` still doesn’t reply: check Edge logs for `sendMessage` status or secret mismatch; confirm chat_id & token.

