#!/usr/bin/env bash
set -euo pipefail
APP_DIR="apps/miniapp-react"
OUT_DIR="$APP_DIR/dist"
EDGE_DIR="supabase/functions/miniapp/static"
if [ ! -d "$APP_DIR" ]; then
  echo "React app not found at $APP_DIR"; exit 0
fi
pushd "$APP_DIR" >/dev/null
npm i
npm run build
popd >/dev/null
rm -rf "$EDGE_DIR"
mkdir -p "$EDGE_DIR"
cp -R "$OUT_DIR"/* "$EDGE_DIR/"
if [ ! -s "$EDGE_DIR/index.html" ]; then
  echo "Error: $EDGE_DIR/index.html is missing or empty" >&2
  exit 1
fi
echo "Copied build to $EDGE_DIR"
