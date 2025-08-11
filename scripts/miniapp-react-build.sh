#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../apps/miniapp-react" || exit 1
npm run build
