#!/usr/bin/env bash
set -euo pipefail
. scripts/verify/utils.sh
ensure_out
R=".out/static_checks.txt"
: > "$R"

say "A) Static Code Checks"

# Find webhook handler
WEBHOOK_FILE=$(git ls-files | grep -E '^supabase/functions/telegram-webhook/.+\.(ts|tsx)$' || true)
if [ -z "$WEBHOOK_FILE" ]; then
  WEBHOOK_FILE=$(git ls-files | xargs -I{} bash -lc 'grep -l "x-telegram-bot-api-secret-token" "{}" || true' | head -1 || true)
fi

if [ -n "$WEBHOOK_FILE" ]; then
  echo "webhook_file=$WEBHOOK_FILE" >> "$R"
else
  echo "webhook_file=UNKNOWN" >> "$R"
fi

# Check for serve(), POST handler, safe parsing, /start, error logging, optional secret validation
check_flag() {
  local name="$1" patt="$2" file="$3"
  if [ -n "$file" ] && grep -Eq "$patt" "$file"; then echo "$name=PASS" >> "$R"; else echo "$name=FAIL" >> "$R"; fi
}
check_flag "has_serve" "serve\\(" "${WEBHOOK_FILE:-}"
check_flag "handles_post" "req\\.method\\s*!==\\s*\"POST\"|req\\.method\\s*===\\s*\"POST\"" "${WEBHOOK_FILE:-}"
check_flag "parses_update" "await\\s+req\\.json\\(|update\\.message|edited_message|callback_query" "${WEBHOOK_FILE:-}"
check_flag "handles_start" "\\/start" "${WEBHOOK_FILE:-}"
check_flag "error_logging" "console\\.error\\(|!res\\.ok" "${WEBHOOK_FILE:-}"
check_flag "secret_header" "x-telegram-bot-api-secret-token" "${WEBHOOK_FILE:-}"

# DB-driven (soft-coded) indicators
check_flag "uses_rest_bot_commands" "bot_commands\\?|rest\\/v1\\/bot_commands" "${WEBHOOK_FILE:-}"
check_flag "uses_rest_templates" "bot_message_templates\\?|rest\\/v1\\/bot_message_templates" "${WEBHOOK_FILE:-}"
check_flag "uses_rest_settings" "bot_settings\\?|rest\\/v1\\/bot_settings" "${WEBHOOK_FILE:-}"

# Mini app presence
MINI_DIR=$( [ -d supabase/functions/miniapp/src ] && echo "supabase/functions/miniapp/src" || echo "" )
if [ -n "$MINI_DIR" ]; then
  echo "miniapp_dir=$MINI_DIR" >> "$R"
  # Telegram SDK present?
  if grep -q "telegram-web-app.js" supabase/functions/miniapp/static/index.html 2>/dev/null; then echo "miniapp_sdk=PASS" >> "$R"; else echo "miniapp_sdk=FAIL" >> "$R"; fi
else
  echo "miniapp_dir=UNKNOWN" >> "$R"
fi

say "Static code scan complete."
