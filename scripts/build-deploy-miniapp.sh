#!/bin/bash
set -e

# Build the mini app and sync static files
bash "$(dirname "$0")/build-miniapp.sh"

# Deploy miniapp and deposit function to Supabase
if [ -z "$SUPABASE_PROJECT_REF" ]; then
  echo "SUPABASE_PROJECT_REF not set" >&2
  exit 1
fi

echo "Deploying miniapp and deposit function..."
npx --yes supabase functions deploy miniapp miniapp-deposit --project-ref "$SUPABASE_PROJECT_REF"

echo "Deployment complete"
