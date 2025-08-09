# >>> DC BLOCK: changed-fns-core (start)
#!/usr/bin/env bash
set -euo pipefail

OUT_DIR=".out"
mkdir -p "$OUT_DIR"
OUT="$OUT_DIR/functions.txt"
: > "$OUT"

# If DEPLOY_ALL=1, list all functions with index.ts
if [ "${DEPLOY_ALL:-0}" = "1" ]; then
  if [ -d supabase/functions ]; then
    for d in supabase/functions/*; do
      [ -d "$d" ] && [ -f "$d/index.ts" ] && basename "$d" >> "$OUT"
    done
  fi
  cat "$OUT"; exit 0
fi

# Figure out diff range (GH Actions or local)
BASE="${GITHUB_BASE_REF:-}"
HEAD="${GITHUB_SHA:-}"
if [ -n "$BASE" ] && [ -n "$HEAD" ]; then
  MERGE_BASE=$(git merge-base "origin/$BASE" "$HEAD" || echo "")
  RANGE="${MERGE_BASE}..${HEAD}"
else
  RANGE="${RANGE:-HEAD~1..HEAD}"
fi

# Collect changed function dirs that actually have index.ts
git diff --name-only "$RANGE" \
  | grep -E '^supabase/functions/[^/]+/' \
  | cut -d/ -f3 \
  | sort -u \
  | while read -r fn; do
      [ -f "supabase/functions/$fn/index.ts" ] && echo "$fn"
    done >> "$OUT" || true

# If none detected, allow [deploy] commit message to force all
MSG="$(git log -1 --pretty=%B || echo "")"
if [ ! -s "$OUT" ] && echo "$MSG" | grep -qi '\[deploy\]'; then
  export DEPLOY_ALL=1
  exec "$0"
fi

cat "$OUT"
# <<< DC BLOCK: changed-fns-core (end)
