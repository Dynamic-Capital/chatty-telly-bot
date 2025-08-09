#!/usr/bin/env bash
set -euo pipefail
: "${DB_URL:?Set DB_URL to your Supabase session pooler URL}"

workdir="$(mktemp -d)"
trap 'rm -rf "$workdir"' EXIT

curl -fsSL https://raw.githubusercontent.com/supabase/splinter/main/splinter.sql -o "$workdir/splinter.sql"
# CSV: name,title,level,description,detail,remediation,metadata (no header)
psql "$DB_URL" -v ON_ERROR_STOP=1 -t -A -F',' -f "$workdir/splinter.sql" > "$workdir/splinter_report.csv"
cat "$workdir/splinter_report.csv"

# Save artifacts
mkdir -p .out
cp "$workdir/splinter_report.csv" .out/splinter_report.csv
echo "Report saved to .out/splinter_report.csv"
