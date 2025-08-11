#!/usr/bin/env bash
set -euo pipefail
. scripts/cleanup/guard_rules.sh

: "${SUPABASE_URL:?Set SUPABASE_URL}"
: "${SUPABASE_KEY:?Set SUPABASE_KEY}"

SB="${SUPABASE_URL%/}"
HDR=(-H "apikey: ${SUPABASE_KEY}" -H "Authorization: Bearer ${SUPABASE_KEY}")

# Fetch text-bearing columns we care about; expand easily later.
fetch_table_col() {
  local table="$1" sel="$2" out="$3"
  curl -fsS "${HDR[@]}" "$SB/rest/v1/$table?select=$sel&limit=100000" > "$out" || echo "[]" > "$out"
}

ensure_out(){ mkdir -p .out; }

ensure_out
fetch_table_col "bot_message_templates" "template_key,message_text,keyboard_layout" ".out/_db_templates.json"
fetch_table_col "bot_settings" "setting_key,setting_value" ".out/_db_settings.json"
# add more if needed:
# fetch_table_col "bot_notifications" "title,message" ".out/_db_notifications.json"

# Return 0 if filename appears in any DB text/json
db_refs_file() {
  local fname="$1"
  jq -e --arg f "$fname" '
    (.. | strings? | select(test($f; "i"))) as $hit
  ' .out/_db_templates.json .out/_db_settings.json >/dev/null 2>&1
}
