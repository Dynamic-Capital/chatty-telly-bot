#!/usr/bin/env bash
# Install Supabase CLI locally. Mirrors the setup used in
# `.github/workflows/supabase-cli.yml`.
set -euo pipefail

if command -v supabase >/dev/null 2>&1; then
  echo "Supabase CLI already installed: $(supabase --version)"
else
  echo "Installing Supabase CLI..."
  curl -fsSL https://cli.supabase.com/install.sh | sh
  echo "Supabase CLI installed: $(supabase --version)"
fi
