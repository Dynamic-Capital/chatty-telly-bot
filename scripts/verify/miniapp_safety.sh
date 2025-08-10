#!/usr/bin/env bash
set -euo pipefail
. scripts/verify/utils.sh
ensure_out
R=".out/miniapp_safety.txt"
: > "$R"

say "D) Mini App Safety"

if [ ! -d "miniapp" ]; then
  echo "miniapp_present=UNKNOWN" >> "$R"
  echo "client_token_leak=UNKNOWN" >> "$R"
  echo "initdata_verify_usage=UNKNOWN" >> "$R"
  exit 0
fi

echo "miniapp_present=PASS" >> "$R"

# 1) Ensure no bot token or service keys are present in client code
leaks=$(git ls-files 'miniapp/**' | xargs -I{} bash -lc 'grep -nE "TELEGRAM_BOT_TOKEN|SUPABASE_SERVICE_ROLE_KEY" "{}" || true' | wc -l)
if [ "$leaks" -eq 0 ]; then
  echo "client_token_leak=PASS" >> "$R"
else
  echo "client_token_leak=FAIL" >> "$R"
fi

# 2) Check use of initData verification endpoint (tg-verify-init)
if git ls-files 'miniapp/**' | xargs -I{} bash -lc 'grep -q "tg-verify-init" "{}" && echo hit || true' | grep -q hit; then
  echo "initdata_verify_usage=PASS" >> "$R"
else
  echo "initdata_verify_usage=FAIL" >> "$R"
fi

say "Mini app safety scan complete."
