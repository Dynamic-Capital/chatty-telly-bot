#!/usr/bin/env bash
set -euo pipefail
. scripts/cleanup/utils.sh
. scripts/cleanup/guard_rules.sh
ensure_out
REF=".out/ref_map.txt"
REPORT=".out/orphans.txt"; : > "$REPORT"

say "Scanning for orphan assets (with safeguards)"
CANDS=$(git ls-files | grep -E '^(public|miniapp/static|miniapp/assets|assets|static|docs|\.github)/' || true)

awk '{print $0}' "$REF" 2>/dev/null | sed 's#^\./##' | sort -u > .out/_refs_all.txt || true
awk -F/ '{print $NF}' .out/_refs_all.txt 2>/dev/null | sort -u > .out/_refs_names.txt || true

for f in $CANDS; do
  [ -f "$f" ] || continue
  is_protected "$f" && continue
  is_denied "$f" && continue

  # path or basename referenced?
  if grep -qx "$f" .out/_refs_all.txt 2>/dev/null; then continue; fi
  base=$(basename "$f")
  if grep -qx "$base" .out/_refs_names.txt 2>/dev/null; then continue; fi

  echo "$f" >> "$REPORT"
done

echo "Orphan candidates (pre-DB-check): $REPORT"
