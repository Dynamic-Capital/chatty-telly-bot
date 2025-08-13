# Dynamic Capital — Telegram Bot & Mini App

**Fast deposits for traders. Bank & crypto, verified.**

## What this is

Telegram-first bot with optional Mini App (Web App) for deposit workflows (bank
OCR + crypto TXID). Personal project; not accepting contributions.

## Features

- Telegram webhook (200-fast), OCR on images only
- Bank receipts (BML/MIB) auto-verification
- Crypto TXID submissions (no image approvals)
- Optional Mini App (glass theme, 1:1 assets)
- Admin commands for maintenance

## Privacy & security

No secrets in this repo; uses environment variables. Service role keys used only
in Edge Functions. Code and assets may be encrypted/obfuscated later. Logs avoid
PII; rate limits enabled.

## Environment variables

Full list and usage notes: [docs/env.md](docs/env.md).

- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- TELEGRAM_BOT_TOKEN
- TELEGRAM_WEBHOOK_SECRET
- TELEGRAM_ADMIN_IDS _(comma-separated Telegram user IDs; spaces are ignored)_
- MINI_APP_URL _(optional)_
- AMOUNT_TOLERANCE _(optional)_
- WINDOW_SECONDS _(optional)_
- OPENAI_API_KEY _(optional)_
- OPENAI_ENABLED _(optional)_
- BENEFICIARY_TABLE _(optional)_

Values are set in Supabase function secrets, GitHub Environments, or Codex
project settings. Do not commit them.

To troubleshoot `401 Unauthorized` from admin endpoints, generate a known-good
`initData` string and verify it:

```bash
deno run --no-npm -A scripts/make-initdata.ts --id=<your_telegram_id>
curl -X POST -H "Content-Type: application/json" \
  -d "{\"initData\":\"$INITDATA\"}" \
  "$SUPABASE_URL/functions/v1/verify-initdata"
```

## Quick start

```bash
# Start local stack
supabase start

# Serve the function (new terminal)
supabase functions serve telegram-bot --no-verify-jwt

# Ping (expects 200)
curl -X POST "http://127.0.0.1:54321/functions/v1/telegram-bot" \
  -H "content-type: application/json" \
  -H "X-Telegram-Bot-Api-Secret-Token: $TELEGRAM_WEBHOOK_SECRET" \
  -d '{"test":"ping"}'
```

Note: for OCR parsing, send an actual Telegram image to the bot; OCR runs only
on images.

## Mini App

- Set `MINI_APP_URL` in env (example domain only, do not hardcode).
- Launch via Web App button inside Telegram.
- All UI images should be 1:1 (square).

## CI / checks

Type check:

```bash
deno check supabase/functions/telegram-bot/*.ts supabase/functions/telegram-bot/**/*.ts
```

If tests present:

```bash
deno test -A
```

## Deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for environment vars, tests,
deployment, and troubleshooting.

Deploy function:

```bash
supabase functions deploy telegram-bot --project-ref <PROJECT_REF>
```

Set Telegram webhook (with secret): use BotFather or API; do not paste secrets
in README.

## License / contributions

Proprietary / All rights reserved. Personal project; external PRs/issues are
closed by default.

## Notes

Repo keeps source only. No caches (.cas), dist/, or node_modules/ are committed.

Future changes may encrypt code and increase env usage; see /docs/agent.md for
behavior spec (if present).
