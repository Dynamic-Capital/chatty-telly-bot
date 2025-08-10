#!/usr/bin/env bash
set -euo pipefail
require() { : "${!1:?Missing required env: $1}"; }
require SUPABASE_URL
# Service role is needed for some server-side checks, but NEVER echo it:
if [ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
  echo "WARN: SUPABASE_SERVICE_ROLE_KEY not set; some server-side checks may be skipped."
fi
