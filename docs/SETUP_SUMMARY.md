# Setup Summary — Dynamic Capital – VIP

**Generated:** 2025-08-10 23:25:58 UTC  
**Repo root:** Dynamic-Chatty-Bot  
**Add-only summary.**

## Goal & Scope
- Keep existing Telegram bot untouched, tighten database links, make CI pass reliably, and add lightweight docs/guardrails so this doesn’t break again.

## Database (Supabase)
- Idempotent migration connects dangling tables to `bot_users(id)`, backfills `bot_user_id` from `telegram_user_id`, adds missing FKs & indexes, enforces one active subscription per user, and creates the `current_vip` view.
- Run `supabase db push` and verify with the orphan-count and VIP view queries if not already.

## CI & Testing
- Added tests that mock env and network so GitHub Actions doesn’t need secrets.
- Added Deno tasks (`typecheck`, `test`, `audit`) and a PR gate job (`test-and-pr`).
- Diff-aware guard blocks any new raw `Deno.env.get(` usages; legacy code left alone.
- Separate CI workflow keeps existing jobs untouched; goal is to get all checks green and enable auto-merge.

## Docs & Hygiene
- Updated `AGENDA.md` with the “no-overwrite” policy, how CI runs, how to use Supabase Edge secrets, and local dev commands.
- Optional repo docs (`REPO_SUMMARY.md`, `INVENTORY.csv`, `FLOW_OVERVIEW.md`) keep a live picture of functions, migrations, CI, and tests.
- Prevents accidental secret leaks and environment misuse.

## Why This Matters
- Clean joins and analytics via `bot_user_id`.
- Reliable VIP access checks through `current_vip`.
- CI no longer depends on GitHub secrets; tests stay offline.
- Future contributors have a clear checklist.

## What’s Left
- If not already: `npx supabase login && supabase link && supabase db push`.
- Open/refresh the PR with the add-only files; ensure checks (`typecheck`, `test`, `audit`, `test-and-pr`) pass.
- Enable auto-merge and add branch protection (mark those checks as required).
- Quick production sanity: `/start`, `/plans`, approve a test payment → confirm `current_vip.is_vip = true`.

---
*Add-only document; no handlers were modified.*
