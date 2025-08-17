#!/bin/bash
set -e

echo "🚀 Building and deploying Dynamic Capital Mini App..."

echo "📦 Building miniapp..."
cd supabase/functions/miniapp
NODE_TLS_REJECT_UNAUTHORIZED=0 npm_config_strict_ssl=false npm install
NODE_TLS_REJECT_UNAUTHORIZED=0 npm_config_strict_ssl=false npm run build
cd ../../..

if [ ! -f "supabase/functions/miniapp/static/index.html" ]; then
    echo "❌ Build failed - index.html not found in static directory"
    exit 1
fi

echo "✅ Build successful!"

echo "🔍 Checking bundle quality..."
NODE_TLS_REJECT_UNAUTHORIZED=0 $(bash scripts/deno_bin.sh) run --no-config --unsafely-ignore-certificate-errors=registry.npmjs.org,deno.land -A scripts/assert-miniapp-bundle.ts

echo "🚀 Deploying miniapp function..."
if [ -z "$SUPABASE_PROJECT_REF" ]; then
    echo "❌ SUPABASE_PROJECT_REF not set"
    exit 1
fi
npx --yes supabase functions deploy miniapp --project-ref "$SUPABASE_PROJECT_REF"

echo "✅ Miniapp deployed successfully!"
echo "📱 Access your miniapp at: https://$SUPABASE_PROJECT_REF.functions.supabase.co/miniapp/"
