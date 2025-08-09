#!/usr/bin/env bash
set -euo pipefail

FILE="${1:-supabase/.env.functions}"
if [ ! -f "$FILE" ]; then
  echo "❌ Secrets file not found: $FILE"
  echo "Copy supabase/.env.functions.example to $FILE and fill values."
  exit 1
fi

echo "🔐 Applying Supabase Function Secrets from $FILE ..."
supabase secrets set --env-file "$FILE" ${PROJECT_REF:+--project-ref "$PROJECT_REF"}
echo "✅ Secrets applied."
