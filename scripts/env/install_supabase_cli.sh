#!/usr/bin/env bash
set -euo pipefail
# Install Supabase CLI if missing (Linux/macOS). Skip if already present.
if command -v supabase >/dev/null 2>&1; then
  supabase --version
  exit 0
fi

# Try official install script
curl -fsSL https://github.com/supabase/cli/releases/latest/download/supabase_linux_amd64.tar.gz -o /tmp/supabase.tgz || true
if [ -s /tmp/supabase.tgz ]; then
  tar -xzf /tmp/supabase.tgz -C /usr/local/bin || sudo tar -xzf /tmp/supabase.tgz -C /usr/local/bin
  chmod +x /usr/local/bin/supabase || true
fi

if ! command -v supabase >/dev/null 2>&1; then
  echo "Supabase CLI not found after install attempt. Install manually: https://supabase.com/docs/reference/cli/usage"
  exit 1
fi
supabase --version
