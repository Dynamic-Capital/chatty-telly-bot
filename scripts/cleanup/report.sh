#!/usr/bin/env bash
set -euo pipefail
. scripts/cleanup/utils.sh

ensure_out
OUT=".out/assets_audit_report.md"; : > "$OUT"

say "Running asset cleanup scan (dry-run)"

bash scripts/cleanup/find_dupes.sh
bash scripts/cleanup/find_orphans.sh

echo "# Assets Audit" >> "$OUT"

# Duplicates section
echo "## Duplicate Files" >> "$OUT"
if [ -s .out/dupe_remove_candidates.txt ]; then
  echo "" >> "$OUT"
  printf '```\n' >> "$OUT"
  cat .out/dupe_remove_candidates.txt >> "$OUT"
  printf '```\n' >> "$OUT"
else
  echo "- No duplicate removal candidates" >> "$OUT"
fi

# Orphans section
echo "## Orphan Files" >> "$OUT"
if [ -s .out/orphans.txt ]; then
  echo "" >> "$OUT"
  printf '```\n' >> "$OUT"
  cat .out/orphans.txt >> "$OUT"
  printf '```\n' >> "$OUT"
else
  echo "- No orphan candidates" >> "$OUT"
fi

# --- Supabase cross-check & final plan ---
bash scripts/cleanup/gate_supabase.sh

echo "## Removal Plan (after Supabase cross-check)" >> "$OUT"
if grep -vq "^#" .out/removal_candidates_supabase_checked.txt 2>/dev/null; then
  echo "" >> "$OUT"
  printf '```\n' >> "$OUT"
  grep -v "^#" .out/removal_candidates_supabase_checked.txt >> "$OUT"
  printf '```\n' >> "$OUT"
else
  echo "- No files eligible for removal after Supabase cross-check ✅" >> "$OUT"
fi

say "Report written to $OUT"
