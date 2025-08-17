#!/bin/bash
set -e

echo "🚀 Building and deploying Dynamic Capital Mini App..."

# Build the miniapp
echo "📦 Building miniapp..."
cd supabase/functions/miniapp
npm install
npm run build
cd ../../..

# Verify build output exists
if [ ! -f "supabase/functions/miniapp/static/index.html" ]; then
    echo "❌ Build failed - index.html not found in static directory"
    exit 1
fi

echo "✅ Build successful!"

# Check bundle quality
echo "🔍 Checking bundle quality..."
deno run -A scripts/assert-miniapp-bundle.ts

echo "🚀 Deploying miniapp function..."
npx supabase functions deploy miniapp

echo "✅ Miniapp deployed successfully!"
echo "📱 Access your miniapp at: https://YOUR_PROJECT_REF.functions.supabase.co/miniapp/"