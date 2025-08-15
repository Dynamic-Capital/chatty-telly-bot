#!/usr/bin/env bash
set -euo pipefail

# Hard-protected (never remove)
PROTECTED_GLOBS=(
  "supabase/**"
  "supabase/functions/**"
  "supabase/migrations/**"
  "scripts/**"
  ".github/**"
  "miniapp/src/**"
)

# Preferred canonical locations when duplicates exist (keep these)
PREFERRED_CANON=(
  "miniapp/static/**"
  "public/**"
  "miniapp/assets/**"
)

# Safe remove denylist (never propose)
DENYLIST=(
  "*.svg"          # often shared icons, referenced indirectly
  "**/favicon.*"
  "**/*.ico"
  "**/*.icns"
)

is_protected() {
  local f="$1"
  for g in "${PROTECTED_GLOBS[@]}"; do
    [[ "$f" == $g ]] && return 0
  done
  return 1
}

is_denied() {
  local f="$1"
  for g in "${DENYLIST[@]}"; do
    [[ "$f" == $g ]] && return 0
  done
  return 1
}

# Return 0 if A is a better canonical path than B (shorter path + preferred folders)
prefer_over() {
  local A="$1" B="$2"
  # prefer preferred folders
  for p in "${PREFERRED_CANON[@]}"; do
    [[ "$A" == $p ]] && [[ "$B" != $p ]] && return 0
  done
  for p in "${PREFERRED_CANON[@]}"; do
    [[ "$B" == $p ]] && [[ "$A" != $p ]] && return 1
  done
  # else prefer shorter path
  [ ${#A} -le ${#B} ]
}
