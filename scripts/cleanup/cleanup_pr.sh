#!/usr/bin/env bash
set -euo pipefail
. scripts/cleanup/utils.sh

APPLY=0
[ "${1:-}" = "--apply" ] && APPLY=1

ensure_out
PLAN=".out/removal_candidates_supabase_checked.txt"

if [ ! -s "$PLAN" ]; then
  echo "No removal plan found. Run scripts/cleanup/report.sh first."
  exit 0
fi

# CI safety: require PR label or env APPROVE_CLEANUP=1
if [ $APPLY -ne 1 ]; then
  echo "This is a dry-run. To actually delete, run: bash scripts/cleanup/cleanup_pr.sh --apply"
  exit 0
fi

if [ -n "${GITHUB_EVENT_PATH:-}" ]; then
  # In CI: require label safe-cleanup
  if command -v jq >/dev/null 2>&1; then
    LABEL_OK=$(jq -r '.pull_request.labels[].name // empty' "$GITHUB_EVENT_PATH" | grep -q '^safe-cleanup$' && echo yes || echo no)
    if [ "$LABEL_OK" != "yes" ]; then
      echo "Missing required PR label: safe-cleanup"
      exit 1
    fi
  fi
else
  # Local: require explicit approval flag or env
  if [ "${APPROVE_CLEANUP:-0}" != "1" ]; then
    echo "Set APPROVE_CLEANUP=1 to allow removals locally."
    exit 1
  fi
fi

# Build removal list (ignore comments)
REM_LIST=$(mktemp)
grep -v "^#" "$PLAN" > "$REM_LIST"

if [ ! -s "$REM_LIST" ]; then
  echo "Nothing to remove."
  exit 0
fi

BR="chore/cleanup-static-$(date +%Y%m%d%H%M%S)"
git checkout -b "$BR"
xargs -a "$REM_LIST" -I{} git rm -f "{}" || true

if git diff --cached --quiet; then
  echo "No changes staged."
  exit 0
fi

git commit -m "chore: remove orphan/duplicate static assets (Supabase-verified)"
git push -u origin "$BR" || true
if command -v gh >/dev/null 2>&1; then
  gh pr create --fill --title "Cleanup: Supabase-verified static removals" --body "Automated removal using content hash + reference scan + Supabase DB cross-check. Review required."
fi
