# >>> DC BLOCK: deploy-core (start)
#!/usr/bin/env bash
set -euo pipefail

: "${SUPABASE_PROJECT_REF:?SUPABASE_PROJECT_REF required}"
: "${SUPABASE_ACCESS_TOKEN:?SUPABASE_ACCESS_TOKEN required}"

LIST_FILE="${1:-.out/functions.txt}"
if [ ! -s "$LIST_FILE" ]; then
  echo "No functions to deploy. Exiting."
  exit 0
fi

echo "== Supabase CLI =="
npx supabase --version

echo "== Link project =="
npx supabase link --project-ref "$SUPABASE_PROJECT_REF" || true

BASE="https://${SUPABASE_PROJECT_REF}.supabase.co/functions/v1"
FAILED=0

# Deploy only functions that actually exist locally
while IFS= read -r fn; do
  [ -z "$fn" ] && continue
  if [ ! -f "supabase/functions/$fn/index.ts" ]; then
    echo "Skip $fn (missing supabase/functions/$fn/index.ts)"
    continue
  fi
  echo "---- Deploying $fn ----"
  npx supabase functions deploy "$fn" --project-ref "$SUPABASE_PROJECT_REF"

  # Probe GET/POST with tolerant codes
  G=$(curl -sS -o /dev/null -w "%{http_code}" "$BASE/$fn" || echo 000)
  P=$(curl -sS -o /dev/null -w "%{http_code}" -X POST -H "content-type: application/json" -d '{"ping":"ok"}' "$BASE/$fn" || echo 000)
  echo "Probe: $fn GET=$G POST=$P"
  case "$G$P" in
    *200*|*204*|*401*|*403*) echo "OK";;
    *) echo "Probe failed for $fn"; FAILED=$((FAILED+1));;
  esac
done < "$LIST_FILE"

if [ "$FAILED" -gt 0 ]; then
  echo "Deployment probe failed for $FAILED function(s)."
  exit 1
fi

echo "All deployments probed OK."
# <<< DC BLOCK: deploy-core (end)
