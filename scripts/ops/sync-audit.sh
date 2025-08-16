#!/usr/bin/env bash
set -euo pipefail

: "${SUPABASE_ACCESS_TOKEN:?SUPABASE_ACCESS_TOKEN is required}"
: "${SUPABASE_PROJECT_REF:?SUPABASE_PROJECT_REF is required}"
: "${ADMIN_API_SECRET:?ADMIN_API_SECRET is required}"

functions=(miniapp telegram-bot sync-audit telegram-webhook-keeper)
for fn in "${functions[@]}"; do
  npx supabase functions deploy "$fn" --project-ref "$SUPABASE_PROJECT_REF"
done

version=$(date -u +"%Y%m%d%H%M%S")

curl -sS --fail -X POST \
  "https://${SUPABASE_PROJECT_REF}.functions.supabase.co/sync-audit" \
  -H "Authorization: Bearer ${ADMIN_API_SECRET}" \
  -H "Content-Type: application/json" \
  -d "{\"fix\":true,\"version\":\"${version}\"}"
