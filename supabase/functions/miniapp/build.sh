#!/bin/bash
set -e

echo "Building miniapp..."
cd "$(dirname "$0")"

# Install dependencies
echo "Installing dependencies..."
npm install

# Build the application
echo "Running build..."
npm run build

# Verify static directory was created
if [ ! -d "static" ]; then
    echo "Error: static directory not created"
    exit 1
fi

# Verify index.html exists
if [ ! -f "static/index.html" ]; then
    echo "Error: static/index.html not found"
    exit 1
fi

echo "Build completed successfully!"
echo "Files in static directory:"
ls -la static/

# Change the root div id to match what main.tsx expects
sed -i 's/id="app"/id="root"/g' static/index.html
echo "Updated index.html to use root div id"