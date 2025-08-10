#!/usr/bin/env bash
set -euo pipefail
. scripts/verify/utils.sh
ensure_out
R=".out/deployed_checks.txt"
: > "$R"

say "B) Deployed Function Checks"

if [ -z "${SUPABASE_URL:-}" ]; then
  echo "supabase_url=UNKNOWN" >> "$R"
  echo "webhook_url=UNKNOWN" >> "$R"
  echo "reachable=UNKNOWN" >> "$R"
  exit 0
fi

# Expected webhook URL
WEBHOOK_URL="${SUPABASE_URL%/}/functions/v1/telegram-webhook"
echo "webhook_url=$WEBHOOK_URL" >> "$R"

# Reachability (no secrets): first GET/HEAD then POST with dummy payload
status=$(curl -s -o /dev/null -w "%{http_code}" -m 8 "$WEBHOOK_URL" || echo 000)
echo "head_status=$status" >> "$R"

post_status=$(curl -s -o /dev/null -w "%{http_code}" -m 8 -H "content-type: application/json" -d '{}' "$WEBHOOK_URL" || echo 000)
echo "post_status=$post_status" >> "$R"

if [ "$status" != "000" ] || [ "$post_status" != "000" ]; then
  echo "reachable=PASS" >> "$R"
else
  echo "reachable=FAIL" >> "$R"
fi

say "Deployed function reachability checked."
