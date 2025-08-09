# >>> DC BLOCK: ci-core (start)
#!/usr/bin/env bash
set -euo pipefail

export DENO_TLS_CA_STORE="${DENO_TLS_CA_STORE:-system}"
export DENO_NO_UPDATE_CHECK=1

echo "== deno fmt (check) =="
if ! deno fmt --check supabase/functions src; then
  if [ "${AUTO_FMT:-0}" = "1" ]; then
    echo "Formatting differences found — applying fixes (AUTO_FMT=1)..."
    deno fmt supabase/functions src
  else
    echo "Formatting differences found. Run: deno fmt supabase/functions src"
    exit 1
  fi
fi

echo "== deno lint =="
deno lint

echo "== typecheck =="
bash scripts/typecheck.sh

# Optional tests
if ls test 1>/dev/null 2>&1 || ls **/*_test.ts 1>/dev/null 2>&1; then
  echo "== deno test =="
  deno test -A
else
  echo "No tests found, skipping."
fi

echo "CI checks passed."
# <<< DC BLOCK: ci-core (end)
