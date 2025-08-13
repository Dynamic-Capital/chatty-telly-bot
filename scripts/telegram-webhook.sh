#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: scripts/telegram-webhook.sh [delete|set|info]

Environment variables required:
  TELEGRAM_BOT_TOKEN          # BotFather token
  TELEGRAM_WEBHOOK_SECRET     # Secret query param appended to webhook URL (only for 'set')

Optional (one of):
  PROJECT_REF                 # Supabase project ref (e.g. qeejuomcapbdlhnjqjcc)
  SUPABASE_URL                # e.g. https://qeejuomcapbdlhnjqjcc.supabase.co

Examples:
  ./scripts/telegram-webhook.sh delete
  ./scripts/telegram-webhook.sh set
  ./scripts/telegram-webhook.sh info
EOF
}

if [[ ${1:-} == "-h" || ${1:-} == "--help" || $# -eq 0 ]]; then
  usage; exit 0
fi

: "${TELEGRAM_BOT_TOKEN:?TELEGRAM_BOT_TOKEN is required}"

# Derive PROJECT_REF from SUPABASE_URL if not given
PROJECT_REF=${PROJECT_REF:-}
if [[ -z "$PROJECT_REF" && -n "${SUPABASE_URL:-}" ]]; then
  # SUPABASE_URL format: https://<project-ref>.supabase.co
  PROJECT_REF=$(printf "%s" "$SUPABASE_URL" | sed -E 's#https?://([^.]+)\.supabase\.co.*#\1#') || true
fi

if [[ -z "$PROJECT_REF" ]]; then
  echo "[!] PROJECT_REF or SUPABASE_URL must be set to build the webhook URL" >&2
  exit 1
fi

FUNCTION_URL="https://${PROJECT_REF}.functions.supabase.co/telegram-bot"
API_BASE="https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}"

cmd=${1}
case "$cmd" in
  delete)
    echo "[-] Deleting webhook (no secret printed)..."
    curl -sS -X POST "${API_BASE}/deleteWebhook" | jq -r '.description // "ok"'
    ;;
  set)
    : "${TELEGRAM_WEBHOOK_SECRET:?TELEGRAM_WEBHOOK_SECRET is required for set}"
    echo "[+] Setting webhook (URL hidden)..."
    # Do not echo the full URL to avoid leaking secrets
    curl -sS -X POST "${API_BASE}/setWebhook" \
      -d "url=${FUNCTION_URL}?secret=${TELEGRAM_WEBHOOK_SECRET}" \
      -d "secret_token=${TELEGRAM_WEBHOOK_SECRET}" | jq -r '.description // "ok"'
    ;;
  info)
    echo "[i] Webhook info:"
    curl -sS "${API_BASE}/getWebhookInfo" | jq '.result | {url, has_custom_certificate, pending_update_count, last_error_date, last_error_message, max_connections, ip_address}'
    ;;
  *)
    usage; exit 1;;
 esac
