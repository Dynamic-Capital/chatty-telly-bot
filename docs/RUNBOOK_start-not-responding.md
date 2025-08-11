# RUNBOOK — Telegram `/start` not responding

## Quick checks

1) Webhook status:

```
deno run -A scripts/check-webhook.ts
```

- If URL is empty or wrong, re-set webhook (per GO_LIVE_CHECKLIST).
- If last_error_message exists, fix that upstream (SSL, 4xx/5xx, timeouts).

2) Ping your deployed function with a synthetic `/start`:

```
export TELEGRAM_WEBHOOK_SECRET=... # prod secret
export TELEGRAM_WEBHOOK_URL=... # if not set, we derive from SUPABASE_PROJECT_ID
# or: export SUPABASE_PROJECT_ID=qeejuomcapbdlhnjqjcc

deno run -A scripts/ping-webhook.ts
```

- Expect 2xx. Non-2xx → check logs on Supabase Edge.

3) Offline smoke test (no secrets needed):

```
deno test -A functions/_tests/start-command.test.ts
```

- If import fails, update the path inside the test.
- If call fails, inspect thrown errors for missing env or bad parsing.

## Common causes

- Wrong webhook secret header or missing header (some handlers validate `X-Telegram-Bot-Api-Secret-Token`; others use `?secret=`).
- Webhook URL not set or points to old branch/deployment.
- Handler expecting `message.entities[type=bot_command]` but update lacks it.
- Mini-app branch: `/start` may shortcut to a menu button if `MINI_APP_URL`/`MINI_APP_SHORT_NAME` not configured.

## When it’s fixed

- Keep these scripts. They’re add-only and safe to run anytime before releases.
