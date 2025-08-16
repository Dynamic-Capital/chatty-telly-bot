#!/bin/bash
# Build script for miniapp deployment

set -e

echo "Building miniapp..."
cd miniapp && (npm run build || pnpm build || true)
cd ..

echo "Syncing to static folder..."
node scripts/sync-miniapp-static.mjs

echo "Asserting bundle quality..."
node scripts/assert-miniapp-bundle.mjs

echo "✅ Miniapp build complete and ready for deployment"