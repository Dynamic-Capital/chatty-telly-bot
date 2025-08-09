#!/usr/bin/env bash
set -euo pipefail

DENO_BIN="$(bash scripts/deno_bin.sh)"
export DENO_TLS_CA_STORE="${DENO_TLS_CA_STORE:-system}"
export DENO_NO_UPDATE_CHECK=1

# 1) Codemods
node scripts/codemods/wrap_ts_comments.mjs || true
node scripts/codemods/require_await_pad.mjs || true

# 2) Auto-fix + format (using deno via wrapper)
$DENO_BIN lint --fix
$DENO_BIN fmt .

echo "\u2713 Applied codemods, lint fixes, and formatting."
