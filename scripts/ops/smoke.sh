#!/usr/bin/env bash
set -euo pipefail

: "${SUPABASE_PROJECT_REF:?SUPABASE_PROJECT_REF is required}"

BASE="https://${SUPABASE_PROJECT_REF}.functions.supabase.co"

check() {
  local method=$1
  local path=$2
  local expected=$3
  local data=${4-}
  local code
  if [[ "$method" == HEAD ]]; then
    code=$(curl -s -o /dev/null -w '%{http_code}' -I "$BASE$path")
  else
    if [[ -n "$data" ]]; then
      code=$(curl -s -o /dev/null -w '%{http_code}' -X "$method" "$BASE$path" -d "$data")
    else
      code=$(curl -s -o /dev/null -w '%{http_code}' -X "$method" "$BASE$path")
    fi
  fi
  if [[ "$code" != "$expected" ]]; then
    echo "[!] $method $path expected $expected got $code" >&2
    exit 1
  else
    echo "[OK] $method $path -> $code"
  fi
}

check GET /telegram-bot/version 200
check GET /telegram-bot 405
check POST /telegram-bot 401
check GET /miniapp/version 200
check HEAD /miniapp 200
check GET /miniapp/foo 404
