#!/usr/bin/env bash
set -euo pipefail
. scripts/cleanup/utils.sh
. scripts/cleanup/guard_rules.sh
ensure_out
REPORT=".out/duplicates.txt"; : > "$REPORT"
KEEPERS=".out/dupe_keepers.txt"; : > "$KEEPERS"
REMOVALS=".out/dupe_remove_candidates.txt"; : > "$REMOVALS"

say "Scanning for duplicate files by SHA-256 (with safeguards)"
FILES=$(git ls-files | grep -E '^(public|miniapp/static|miniapp/assets|assets|static|docs)/' || true)

: > .out/_hash_map.txt
for f in $FILES; do
  [ -f "$f" ] || continue
  is_protected "$f" && continue
  h=$(sha256sum "$f" | awk '{print $1}')
  echo "$h $f" >> .out/_hash_map.txt
done

# hash -> file list
awk '{count[$1]++; files[$1]=files[$1]" "$2} END{ for(h in count){ if(count[h]>1){ print h":"files[h] }}}' .out/_hash_map.txt \
  | sort -u > "$REPORT" || true

# choose keeper & removal candidates
while IFS= read -r line; do
  [ -z "$line" ] && continue
  hash=$(echo "$line" | cut -d: -f1)
  files=$(echo "$line" | cut -d: -f2-)
  # pick canonical keeper
  keeper=""
  for f in $files; do
    [ -z "$keeper" ] && keeper="$f" && continue
    if prefer_over "$f" "$keeper"; then keeper="$f"; fi
  done
  echo "$hash $keeper" >> "$KEEPERS"

  # propose others for removal unless denied
  for f in $files; do
    [ "$f" = "$keeper" ] && continue
    is_denied "$f" && continue
    echo "$f" >> "$REMOVALS"
  done
 done < "$REPORT"

sort -u "$REMOVALS" -o "$REMOVALS"
echo "Duplicates map: $REPORT"
echo "Proposed duplicate removals (pre-DB-check): $REMOVALS"
