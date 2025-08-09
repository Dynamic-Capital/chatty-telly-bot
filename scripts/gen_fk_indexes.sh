#!/usr/bin/env bash
set -euo pipefail

in=".out/splinter_report.csv"
outdir="supabase/migrations"
ts="$(date +%Y%m%d%H%M%S)"
outfile="$outdir/${ts}_add_fk_indexes.sql"

[ -f "$in" ] || { echo "Missing $in. Run scripts/splinter_run.sh first." ; exit 1; }
mkdir -p "$outdir"

# Filter rows where title mentions "unindexed foreign key" (case-insensitive).
# Expect metadata to contain table/column (format varies; handle common patterns).
# We’ll parse using awk and fall back to heuristics from description/detail.
awk -F',' 'BEGIN{IGNORECASE=1}
  /unindexed foreign key/ {
    print $0
  }' "$in" > .out/unindexed_fk_rows.csv || true

if [ ! -s .out/unindexed_fk_rows.csv ]; then
  echo "No unindexed foreign key findings. Nothing to do."
  exit 0
fi

echo "-- Auto-generated indexes for unindexed foreign keys" > "$outfile"
echo "-- Generated: $(date -u +"%Y-%m-%dT%H:%M:%SZ")" >> "$outfile"
echo >> "$outfile"

# Try to extract table & column from metadata (last column) or detail/description.
# Common patterns: metadata like {"table":"public.investments","column":"investor_id"}
# Fallback regex grabs table.column from free text.
while IFS= read -r line; do
  meta=$(echo "$line" | awk -F',' '{print $NF}')
  tbl=""
  col=""
  if echo "$meta" | grep -q '"table"'; then
    tbl=$(echo "$meta" | sed -n 's/.*"table":"\([^"\]*\)".*/\1/p')
    col=$(echo "$meta" | sed -n 's/.*"column":"\([^"\]*\)".*/\1/p')
  fi
  if [ -z "$tbl" ] || [ -z "$col" ]; then
    # fallback: scan whole line for schema.table(column)
    guess=$(echo "$line" | sed -n 's/.*\b\([a-zA-Z0-9_]\+\.[a-zA-Z0-9_]\+\)\.\([a-zA-Z0-9_]\+\).*/\1 \2/p' | head -1)
    tbl=$(echo "$guess" | awk '{print $1}')
    col=$(echo "$guess" | awk '{print $2}')
  fi
  if [ -z "$tbl" ] || [ -z "$col" ]; then
    echo "-- WARN: could not parse table/column from: $line" >> "$outfile"
    continue
  fi
  # normalize name parts
  schema=$(echo "$tbl" | awk -F'.' '{print $1}')
  table=$(echo "$tbl" | awk -F'.' '{print $2}')
  idx="idx_${table}_${col}"
  echo "CREATE INDEX IF NOT EXISTS ${idx} ON ${schema}.${table} (${col});" >> "$outfile"
done < .out/unindexed_fk_rows.csv

echo "Wrote $outfile"
echo "$outfile" > .out/fk_indexes_file.txt
