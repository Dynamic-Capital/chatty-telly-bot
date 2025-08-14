# Cleanup and Codemod Scripts

This repository includes maintenance scripts for asset hygiene and code quality. These scripts are used in CI and local development to keep the codebase tidy.

## Asset cleanup (`scripts/cleanup/`)
- **report.sh** &mdash; orchestrates the asset audit by invoking the duplicate and orphan scanners, then cross‑checks results against Supabase before writing a markdown report. This script runs in CI via the `assets_audit` workflow.
- **find_dupes.sh** &mdash; scans tracked assets, grouping files by hash to identify duplicates and propose non‑keepers for removal.
- **find_orphans.sh** &mdash; lists static files that are not referenced anywhere in the repository while respecting guard rules.
- **gate_supabase.sh** &mdash; filters duplicate and orphan candidates against content fetched from Supabase to avoid removing referenced files.
- **supabase_verify.sh** &mdash; retrieves text from relevant Supabase tables and exposes a helper to check if a filename appears in the database.
- **guard_rules.sh** &mdash; defines protected paths, preferred canonical locations, and a denylist used by the scanners.
- **utils.sh** &mdash; shared helpers for logging and managing the `.out` directory.

## Codemods (`scripts/codemods/`)
- **wrap_ts_comments.mjs** &mdash; ensures any `@ts-ignore` or `@ts-expect-error` comment is preceded by `// deno-lint-ignore ban-ts-comment`.
- **require_await_pad.mjs** &mdash; inserts a no-op `await Promise.resolve()` into async functions that lack an `await`, satisfying the `require-await` lint rule.

