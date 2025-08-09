#!/usr/bin/env bash
set -euo pipefail
mkdir -p .audit
: "${SUPABASE_URL:?SUPABASE_URL required}"
: "${SUPABASE_ANON_KEY:=}"
: "${SUPABASE_SERVICE_ROLE_KEY:=}"

export NODE_NO_WARNINGS=1
export A_SUPABASE_URL="$SUPABASE_URL"
export A_SUPABASE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-$SUPABASE_ANON_KEY}"

node scripts/audit/scan_code.mjs
node scripts/audit/read_meta.mjs
node scripts/audit/report.mjs

echo "Report:"
echo " - .audit/audit_report.json"
echo " - .audit/audit_report.md"

