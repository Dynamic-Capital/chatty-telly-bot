#!/usr/bin/env bash
set -euo pipefail

# Use system certificate store to avoid TLS verification issues in sandboxed CI
export DENO_TLS_CA_STORE=system
export DENO_NO_CHECK=remote

# Fetch remote deps (esm.sh, std libs) for reproducible type checks
if command -v bash >/dev/null 2>&1; then
  shopt -s globstar || true
fi
deno --version
# Prefetch all function entrypoints
if compgen -G "supabase/functions/*/index.ts" > /dev/null; then
  deno cache --reload supabase/functions/*/index.ts
fi

echo "== Type-check Edge Functions =="
if compgen -G "supabase/functions/*/index.ts" > /dev/null; then
  for f in supabase/functions/*/index.ts; do
    echo "deno check $f"
    deno check "$f"
  done
else
  echo "No Edge Function entrypoints found."
fi

echo "TypeScript check completed."
