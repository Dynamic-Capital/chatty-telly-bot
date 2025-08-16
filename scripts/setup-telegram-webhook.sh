#!/usr/bin/env bash
# Configure Supabase secrets required by Telegram edge functions.
#
# Reads values from the current shell environment and uploads them via the
# Supabase CLI so that deployed edge functions can access them at runtime.
#
# Usage:
#   SUPABASE_URL=... \
#   SUPABASE_SERVICE_ROLE_KEY=... \
#   TELEGRAM_BOT_TOKEN=... \
#   TELEGRAM_WEBHOOK_SECRET=... \
#   MINI_APP_URL=... \
#   VITE_SUPABASE_URL=... \
#   VITE_SUPABASE_KEY=... \
#   scripts/setup-telegram-webhook.sh
#
# The Supabase CLI must be installed and authenticated. The project is derived
# from `supabase/config.toml` when run from the repo root.
set -euo pipefail

: "${SUPABASE_URL:?Missing SUPABASE_URL}"
: "${SUPABASE_SERVICE_ROLE_KEY:?Missing SUPABASE_SERVICE_ROLE_KEY}"
: "${TELEGRAM_BOT_TOKEN:?Missing TELEGRAM_BOT_TOKEN}"
: "${TELEGRAM_WEBHOOK_SECRET:?Missing TELEGRAM_WEBHOOK_SECRET}"
: "${MINI_APP_URL:?Missing MINI_APP_URL}"
: "${VITE_SUPABASE_URL:?Missing VITE_SUPABASE_URL}"
: "${VITE_SUPABASE_KEY:?Missing VITE_SUPABASE_KEY}"

supabase secrets set \
  SUPABASE_URL="$SUPABASE_URL" \
  SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
  TELEGRAM_BOT_TOKEN="$TELEGRAM_BOT_TOKEN" \
  TELEGRAM_WEBHOOK_SECRET="$TELEGRAM_WEBHOOK_SECRET" \
  MINI_APP_URL="$MINI_APP_URL" \
  VITE_SUPABASE_URL="$VITE_SUPABASE_URL" \
  VITE_SUPABASE_KEY="$VITE_SUPABASE_KEY"
