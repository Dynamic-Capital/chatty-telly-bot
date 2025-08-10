#!/usr/bin/env bash
set -euo pipefail
. scripts/cleanup/utils.sh
. scripts/cleanup/supabase_verify.sh  # loads SB and helper

ensure_out
IN_ORPHANS=".out/orphans.txt"
IN_DUPES=".out/dupe_remove_candidates.txt"
OUT_FILTERED=".out/removal_candidates_supabase_checked.txt"
: > "$OUT_FILTERED"

say "Cross-checking candidates against Supabase content…"

emit_checked() {
  local f="$1"
  local base="$(basename "$f")"
  # if filename appears anywhere in DB content, skip removal
  if db_refs_file "$base"; then
    echo "# kept (referenced in DB): $f" >> "$OUT_FILTERED"
  else
    echo "$f" >> "$OUT_FILTERED"
  fi
}

# Orphans
if [ -s "$IN_ORPHANS" ]; then
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    emit_checked "$f"
  done < "$IN_ORPHANS"
fi

# Duplicates (non-keepers)
if [ -s "$IN_DUPES" ]; then
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    emit_checked "$f"
  done < "$IN_DUPES"
fi

sort -u "$OUT_FILTERED" -o "$OUT_FILTERED"
echo "Supabase-filtered removal list: $OUT_FILTERED"
