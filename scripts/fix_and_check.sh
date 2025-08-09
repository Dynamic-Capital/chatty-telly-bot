#!/usr/bin/env bash
set -euo pipefail

DENO_BIN="$(bash scripts/deno_bin.sh)"
export DENO_TLS_CA_STORE="${DENO_TLS_CA_STORE:-system}"
export DENO_NO_UPDATE_CHECK=1

for i in 1 2 3 4 5; do
  echo "=== FIX PASS $i ==="
  bash scripts/fix_all.sh || true
  if $DENO_BIN fmt --check . && $DENO_BIN lint && bash scripts/typecheck.sh; then
    echo "\u2713 All checks passed on pass $i"
    exit 0
  fi
done

echo "\u2717 Still failing after 5 passes (see errors above)"
exit 1
