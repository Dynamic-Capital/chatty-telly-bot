#!/usr/bin/env bash
set -euo pipefail
: "${SUPABASE_URL:?SUPABASE_URL required}"
: "${SUPABASE_SERVICE_ROLE_KEY:=}"
: "${SUPABASE_ANON_KEY:=}"

node scripts/audit/gen_fk_indexes.mjs
echo "== Done. See .audit/generated_fk_indexes.sql (and sql/generated_fk_indexes.sql) =="

# Make executable
! chmod +x scripts/audit/run_fk_index_gen.sh 2>/dev/null || true
