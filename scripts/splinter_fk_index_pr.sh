#!/usr/bin/env bash
set -euo pipefail

: "${DB_URL:?Set DB_URL to your Supabase session pooler URL}"

bash scripts/splinter_run.sh
bash scripts/gen_fk_indexes.sh || true

file="$(cat .out/fk_indexes_file.txt 2>/dev/null || true)"
if [ -z "$file" ] || [ ! -s "$file" ]; then
  echo "No FK indexes to add. Exiting."
  exit 0
fi

branch="chore/add-fk-indexes-$(date +%Y%m%d%H%M%S)"
git checkout -b "$branch"
git add "$file" .out/splinter_report.csv
git commit -m "chore(db): add indexes for unindexed foreign keys (Splinter)"
git push -u origin "$branch" || true

# If GitHub CLI is available, open PR
if command -v gh >/dev/null 2>&1; then
  gh pr create --fill --title "Add FK indexes (Splinter)" --body "Adds indexes for FKs flagged by Supabase Splinter. Auto-generated."
fi
