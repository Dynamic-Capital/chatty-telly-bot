#!/usr/bin/env bash
set -euo pipefail

# Fetch remote deps (esm.sh, std libs) for reproducible type checks
if command -v bash >/dev/null 2>&1; then
  shopt -s globstar || true
fi
deno --version
# Prefetch all function entrypoints
if compgen -G "supabase/functions/*/index.ts" > /dev/null; then
  deno cache --reload supabase/functions/*/index.ts
fi
# Prefetch common local modules (optional)
if [ -d src ]; then
  find src -name "*.ts" -maxdepth 3 -print0 | xargs -0 -n1 deno cache || true
fi

echo "== Type-check Edge Functions =="
if compgen -G "supabase/functions/*/index.ts" > /dev/null; then
  for f in supabase/functions/*/index.ts; do
    echo "deno check --remote $f"
    deno check --remote "$f"
  done
else
  echo "No Edge Function entrypoints found."
fi

echo "== Type-check local src/*.ts (optional) =="
if [ -d src ]; then
  # check each file to surface exact errors per module
  find src -name "*.ts" -print0 | xargs -0 -n1 deno check --remote
else
  echo "No src/ directory."
fi

echo "TypeScript check completed."
