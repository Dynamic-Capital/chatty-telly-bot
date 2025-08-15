#!/usr/bin/env bash
set -euo pipefail
. scripts/env/require_env.sh

ensure_out(){ mkdir -p .out; }
ensure_out

# Expected webhook URL from SUPABASE_URL
BASE="${SUPABASE_URL%/}"
EXPECTED="$BASE/functions/v1/telegram-webhook"

# A1) Static code checks: look for webhook handler and /start handling
WEBHOOK_FILE=$(git ls-files | grep -E '^supabase/functions/telegram-webhook/.+\.(ts|tsx)$' || true)
STATIC=".out/bot_static.txt"; : > "$STATIC"
if [ -n "$WEBHOOK_FILE" ]; then
  echo "webhook_file=$WEBHOOK_FILE" >> "$STATIC"
  grep -Eq "serve\\(" "$WEBHOOK_FILE" && echo "has_serve=PASS" >> "$STATIC" || echo "has_serve=FAIL" >> "$STATIC"
  grep -Eq "req\\.method\\s*===?\\s*\"POST\"|req\\.method\\s*!==\\s*\"POST\"" "$WEBHOOK_FILE" && echo "handles_post=PASS" >> "$STATIC" || echo "handles_post=FAIL" >> "$STATIC"
  grep -Eq "await\\s+req\\.json\\(|update\\.message|edited_message|callback_query" "$WEBHOOK_FILE" && echo "parses_update=PASS" >> "$STATIC" || echo "parses_update=FAIL" >> "$STATIC"
  grep -Eq "\\/start" "$WEBHOOK_FILE" && echo "handles_start=PASS" >> "$STATIC" || echo "handles_start=FAIL" >> "$STATIC"
  grep -Eq "x-telegram-bot-api-secret-token" "$WEBHOOK_FILE" && echo "secret_header=PASS" >> "$STATIC" || echo "secret_header=NA" >> "$STATIC"
else
  echo "webhook_file=UNKNOWN" >> "$STATIC"
fi

# B1) Deployed function reachability
DEPLOY=".out/bot_deploy.txt"; : > "$DEPLOY"
echo "expected=$EXPECTED" >> "$DEPLOY"
status=$(curl -s -o /dev/null -w "%{http_code}" -m 8 "$EXPECTED" || echo 000)
echo "head_status=$status" >> "$DEPLOY"
post_status=$(curl -s -o /dev/null -w "%{http_code}" -m 8 -H "content-type: application/json" -d '{}' "$EXPECTED" || echo 000)
echo "post_status=$post_status" >> "$DEPLOY"
[ "$status" != "000" -o "$post_status" != "000" ] && echo "reachable=PASS" >> "$DEPLOY" || echo "reachable=FAIL" >> "$DEPLOY"

# C1) Runtime wiring (use server-side diagnostics if available)
RUN=".out/bot_runtime.txt"; : > "$RUN"
GW="$BASE/functions/v1/telegram-getwebhook"
SS="$BASE/functions/v1/telegram-start-sim"

gw_code=$(curl -s -o .out/_gw.json -w "%{http_code}" -m 8 "$GW" || echo 000)
if [ "$gw_code" = "200" ]; then
  echo "getwebhook=PASS" >> "$RUN"
  exp=$(jq -r '.expected_url // empty' .out/_gw.json 2>/dev/null || true)
  cur=$(jq -r '.webhook_info.url // empty' .out/_gw.json 2>/dev/null || true)
  if [ -n "$exp" ] && [ -n "$cur" ] && [ "$exp" = "$cur" ]; then
    echo "webhook_match=PASS" >> "$RUN"
  else
    echo "webhook_match=FAIL" >> "$RUN"
    echo "expected_url=${exp:-unknown}" >> "$RUN"
    echo "current_url=${cur:-unknown}" >> "$RUN"
  fi
else
  echo "getwebhook=UNKNOWN" >> "$RUN"
  echo "webhook_match=UNKNOWN" >> "$RUN"
fi

# Attempt to call telegram-start-sim for completeness
ss_code=$(curl -s -o /dev/null -w "%{http_code}" -m 8 "$SS" || echo 000)
echo "start_sim_status=$ss_code" >> "$RUN"

printf "Report:\n"
printf " - Static: .out/bot_static.txt\n"
printf " - Deploy: .out/bot_deploy.txt\n"
printf " - Runtime: .out/bot_runtime.txt\n"

