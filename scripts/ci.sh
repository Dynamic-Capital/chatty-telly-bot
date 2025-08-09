# >>> DC BLOCK: ci-core (start)
#!/usr/bin/env bash
set -euo pipefail

export DENO_TLS_CA_STORE="${DENO_TLS_CA_STORE:-system}"
export DENO_NO_UPDATE_CHECK=1

echo "== deno fmt =="
deno fmt --check .

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
