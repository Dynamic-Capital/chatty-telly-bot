# >>> DC BLOCK: typecheck-core (start)
#!/usr/bin/env bash
set -euo pipefail

DENO_BIN="$(bash scripts/deno_bin.sh)"
export DENO_TLS_CA_STORE="${DENO_TLS_CA_STORE:-system}"
export DENO_NO_UPDATE_CHECK=1

CERT_ARG=""
if [ -n "${DENO_CERT_FILE:-}" ] && [ -f "$DENO_CERT_FILE" ]; then
  CERT_ARG="--cert $DENO_CERT_FILE"
fi

$DENO_BIN --version || true

# Prefetch remotes (best-effort)
if compgen -G "supabase/functions/*/index.ts" > /dev/null; then
  $DENO_BIN cache $CERT_ARG --unstable-net --reload --no-lock supabase/functions/*/index.ts || true
fi

echo "== Type-check Edge Functions =="
if compgen -G "supabase/functions/*/index.ts" > /dev/null; then
  for f in supabase/functions/*/index.ts; do
    echo "$DENO_BIN check $CERT_ARG --unstable-net --remote --no-lock $f"
    $DENO_BIN check $CERT_ARG --unstable-net --remote --no-lock "$f"
  done
else
  echo "No Edge Function entrypoints found."
fi

echo "TypeScript check completed."
# <<< DC BLOCK: typecheck-core (end)
