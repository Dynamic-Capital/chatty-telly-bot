#!/usr/bin/env bash
set -euo pipefail
YELLOW='\033[1;33m'; RED='\033[0;31m'; GREEN='\033[0;32m'; BLUE='\033[0;34m'; NC='\033[0m'
say() { printf "%b%s%b\n" "$BLUE" "$*" "$NC"; }
warn() { printf "%b%s%b\n" "$YELLOW" "$*" "$NC"; }
fail() { printf "%b%s%b\n" "$RED" "$*" "$NC"; }
pass() { printf "%b%s%b\n" "$GREEN" "$*" "$NC"; }
trim() { sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//'; }
ensure_out() { mkdir -p .out; }
