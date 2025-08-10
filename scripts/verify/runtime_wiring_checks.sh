#!/usr/bin/env bash
set -euo pipefail
. scripts/verify/utils.sh
ensure_out
R=".out/runtime_checks.txt"
: > "$R"

say "C) Runtime Wiring Checks"

if [ -z "${SUPABASE_URL:-}" ]; then
  echo "getwebhook=UNKNOWN" >> "$R"
  echo "startsim=UNKNOWN" >> "$R"
  exit 0
fi

BASE="${SUPABASE_URL%/}"
GETWEB="$BASE/functions/v1/telegram-getwebhook"
STARTSIM="$BASE/functions/v1/telegram-start-sim"

# telegram-getwebhook (if exists)
code_gw=$(curl -s -o .out/_gw.json -w "%{http_code}" -m 8 "$GETWEB" || echo 000)
if [ "$code_gw" = "200" ]; then
  echo "getwebhook=PASS" >> "$R"
  # try to extract and compare expected_url vs webhook_info.url
  exp=$(jq -r '.expected_url // empty' .out/_gw.json 2>/dev/null || true)
  cur=$(jq -r '.webhook_info.url // empty' .out/_gw.json 2>/dev/null || true)
  if [ -n "$exp" ] && [ -n "$cur" ] && [ "$exp" = "$cur" ]; then
    echo "webhook_match=PASS" >> "$R"
  else
    echo "webhook_match=FAIL" >> "$R"
  fi
else
  echo "getwebhook=UNKNOWN" >> "$R"
  echo "webhook_match=UNKNOWN" >> "$R"
fi

# telegram-start-sim (if exists) — use chat_id=1 as harmless probe
code_ss=$(curl -s -o .out/_ss.json -w "%{http_code}" -m 8 "$STARTSIM?chat_id=1" || echo 000)
if [ "$code_ss" = "200" ]; then
  echo "startsim=PASS" >> "$R"
else
  echo "startsim=UNKNOWN" >> "$R"
fi

say "Runtime wiring checks complete."
