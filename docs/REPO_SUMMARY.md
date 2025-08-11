# Repository Summary — Dynamic Capital – VIP

**Generated:** Sun Aug 10 23:08:09 UTC 2025  
**Repo root:** Dynamic-Chatty-Bot  
**Add-only report (no code changes).**

## 1) High-Level Overview
- Tech stack: Deno, Supabase Edge Functions, Postgres (Supabase), Telegram Bot, Binance Pay.
- Primary domains: bot automation (Telegram), subscriptions/payments, analytics, broadcasts.

## 2) Directory Map (top-level)
```
apps/
  mini/
docs/
  CONFIG.md
  GO_LIVE_CHECKLIST.md
  agent.md
  api-documentation.md
  code-structure.md
  index-advisor.md
  supabase-audit-report.md
miniapp/
  src/
public/
  favicon.ico
scripts/
  cleanup/
  codemods/
  verify/
  splinter_fk_index_pr.sh
src/
  broadcast/
  components/
  hooks/
  integrations/
  lib/
  pages/
  queue/
  utils/
supabase/
  config.toml
  functions/
  migrations/
tests/
```

## 3) Edge Functions Inventory
| Function | Path | Entry file | Exports default? | Notes |
|---|---|---|---|---|
| ai-faq-assistant | supabase/functions/ai-faq-assistant | index.ts | no | |
| analytics-data | supabase/functions/analytics-data | index.ts | no | |
| binance-pay-checkout | supabase/functions/binance-pay-checkout | index.ts | no | |
| binance-pay-webhook | supabase/functions/binance-pay-webhook | index.ts | no | |
| cleanup-old-receipts | supabase/functions/cleanup-old-receipts | index.ts | no | |
| cleanup-old-sessions | supabase/functions/cleanup-old-sessions | index.ts | no | |
| debug-bot | supabase/functions/debug-bot | index.ts | no | |
| keep-alive | supabase/functions/keep-alive | index.ts | no | |
| reset-bot | supabase/functions/reset-bot | index.ts | no | |
| setup-telegram-webhook | supabase/functions/setup-telegram-webhook | index.ts | no | |
| setup-webhook | supabase/functions/setup-webhook | index.ts | no | |
| telegram-bot | supabase/functions/telegram-bot | index.ts | no | |
| telegram-getwebhook | supabase/functions/telegram-getwebhook | index.ts | no | |
| telegram-selftest | supabase/functions/telegram-selftest | index.ts | no | |
| telegram-setwebhook | supabase/functions/telegram-setwebhook | index.ts | no | |
| telegram-start-sim | supabase/functions/telegram-start-sim | index.ts | no | |
| telegram-webhook | supabase/functions/telegram-webhook | index.ts | no | |
| test-bot-status | supabase/functions/test-bot-status | index.ts | no | |
| test-webhook | supabase/functions/test-webhook | index.ts | no | |
| tg-verify-init | supabase/functions/tg-verify-init | index.ts | no | |
| theme-get | supabase/functions/theme-get | index.ts | no | |
| theme-save | supabase/functions/theme-save | index.ts | no | |
| trade-helper | supabase/functions/trade-helper | index.ts | no | |
| verify-telegram | supabase/functions/verify-telegram | index.ts | no | |

## 4) Environment Variables (usages in code)
- Keys referenced via `Deno.env.get(...)`:
  - src/utils/config.ts:L11 SUPABASE_URL
  - supabase/functions/theme-get/index.ts:L23 SUPABASE_URL
  - supabase/functions/theme-get/index.ts:L25 SUPABASE_ANON_KEY
  - supabase/functions/test-bot-status/index.ts:L15 TELEGRAM_BOT_TOKEN
  - supabase/functions/telegram-getwebhook/index.ts:L3 TELEGRAM_BOT_TOKEN
  - supabase/functions/telegram-getwebhook/index.ts:L4 TELEGRAM_WEBHOOK_SECRET
  - supabase/functions/telegram-getwebhook/index.ts:L5 SUPABASE_URL
  - supabase/functions/reset-bot/index.ts:L23 TELEGRAM_BOT_TOKEN
  - supabase/functions/reset-bot/index.ts:L30 SUPABASE_URL
  - supabase/functions/binance-pay-checkout/index.ts:L12 BINANCE_API_KEY
  - supabase/functions/binance-pay-checkout/index.ts:L13 BINANCE_SECRET_KEY
  - supabase/functions/binance-pay-checkout/index.ts:L78 BINANCE_API_KEY
  - supabase/functions/binance-pay-checkout/index.ts:L79 BINANCE_SECRET_KEY
  - supabase/functions/binance-pay-checkout/index.ts:L93 SUPABASE_URL
  - supabase/functions/trade-helper/index.ts:L4 OPENAI_API_KEY
  - supabase/functions/keep-alive/index.ts:L36 TELEGRAM_BOT_TOKEN
  - supabase/functions/analytics-data/index.ts:L24 SUPABASE_URL
  - supabase/functions/verify-telegram/index.ts:L36 TELEGRAM_BOT_TOKEN
  - supabase/functions/ai-faq-assistant/index.ts:L4 OPENAI_API_KEY
  - supabase/functions/telegram-setwebhook/index.ts:L3 TELEGRAM_BOT_TOKEN
  - supabase/functions/telegram-setwebhook/index.ts:L4 TELEGRAM_WEBHOOK_SECRET
  - supabase/functions/telegram-setwebhook/index.ts:L5 SUPABASE_URL
  - supabase/functions/binance-pay-webhook/index.ts:L57 BINANCE_SECRET_KEY
  - supabase/functions/binance-pay-webhook/index.ts:L78 SUPABASE_URL
  - supabase/functions/binance-pay-webhook/index.ts:L181 TELEGRAM_BOT_TOKEN
  - supabase/functions/setup-webhook/index.ts:L15 TELEGRAM_BOT_TOKEN
  - supabase/functions/setup-webhook/index.ts:L22 SUPABASE_URL
  - supabase/functions/test-webhook/index.ts:L3 TELEGRAM_BOT_TOKEN
  - supabase/functions/theme-save/index.ts:L28 SUPABASE_URL
  - supabase/functions/theme-save/index.ts:L30 SUPABASE_ANON_KEY
  - supabase/functions/telegram-start-sim/index.ts:L34 SUPABASE_URL
  - supabase/functions/telegram-start-sim/index.ts:L58 TELEGRAM_WEBHOOK_SECRET
  - supabase/functions/setup-telegram-webhook/index.ts:L3 TELEGRAM_BOT_TOKEN
  - supabase/functions/setup-telegram-webhook/index.ts:L4 SUPABASE_URL
  - supabase/functions/debug-bot/index.ts:L3 TELEGRAM_BOT_TOKEN
  - supabase/functions/debug-bot/index.ts:L59 SUPABASE_URL
  - supabase/functions/telegram-bot/admin-handlers.ts:L4 SUPABASE_URL
  - supabase/functions/telegram-bot/admin-handlers.ts:L25 TELEGRAM_BOT_TOKEN
  - supabase/functions/telegram-bot/admin-handlers.ts:L1491 BOT_VERSION
  - supabase/functions/telegram-bot/database-utils.ts:L4 SUPABASE_URL
  - supabase/functions/telegram-bot/index.ts:L46 SUPABASE_URL
  - supabase/functions/telegram-bot/index.ts:L49 TELEGRAM_BOT_TOKEN
  - supabase/functions/telegram-bot/index.ts:L50 TELEGRAM_WEBHOOK_SECRET
  - supabase/functions/telegram-bot/index.ts:L53 MINI_APP_URL
  - supabase/functions/telegram-bot/index.ts:L57 MINI_APP_SHORT_NAME
  - supabase/functions/telegram-bot/index.ts:L60 OPENAI_ENABLED
  - supabase/functions/telegram-bot/index.ts:L61 FAQ_ENABLED
  - supabase/functions/telegram-bot/index.ts:L62 WINDOW_SECONDS
  - supabase/functions/telegram-bot/index.ts:L63 AMOUNT_TOLERANCE
  - supabase/functions/telegram-bot/index.ts:L64 REQUIRE_PAY_CODE
  - supabase/functions/telegram-bot/index.ts:L154 SB_REQUEST_ID
  - supabase/functions/cleanup-old-receipts/index.ts:L26 SUPABASE_URL
  - supabase/functions/telegram-selftest/index.ts:L3 TELEGRAM_BOT_TOKEN
  - supabase/functions/telegram-selftest/index.ts:L4 TELEGRAM_WEBHOOK_SECRET
  - supabase/functions/telegram-selftest/index.ts:L5 SUPABASE_URL
  - supabase/functions/telegram-bot/helpers/beneficiary.ts:L3 BENEFICIARY_TABLE
  - supabase/functions/cleanup-old-sessions/index.ts:L4 SUPABASE_URL
  - supabase/functions/cleanup-old-sessions/index.ts:L6 TELEGRAM_BOT_TOKEN
  - supabase/functions/tg-verify-init/index.ts:L5 TELEGRAM_BOT_TOKEN
  - supabase/functions/tg-verify-init/index.ts:L6 TELEGRAM_WEBHOOK_SECRET
- Note: secrets are provided by **Supabase Edge** at runtime; tests should mock.

## 5) Supabase & Database
- Client creation points: supabase/functions/telegram-bot/database-utils.ts, supabase/functions/telegram-bot/admin-handlers.ts, supabase/functions/telegram-bot/index.ts, supabase/functions/cleanup-old-receipts/index.ts, supabase/functions/cleanup-old-sessions/index.ts, supabase/functions/binance-pay-checkout/index.ts, supabase/functions/analytics-data/index.ts, supabase/functions/binance-pay-webhook/index.ts, src/integrations/supabase/client.ts, src/utils/config.ts.
- Migrations summary:
  - Count: 16
  - Tables touched: bot_content, subscription_plans, plan_channels, bot_settings, payment_intents, receipts, promotion_usage, conversion_tracking, promo_analytics, user_surveys, bot_users, user_subscriptions, user_sessions, user_interactions, channel_memberships, education_enrollments, payments.
  - Views: current_vip
  - Policies/RLS: "Bot can manage content", "Admins can manage subscription plans", "Public can view plan channels", "Bot can manage settings", "Bot can manage promotion usage", user/profile policies adjustments.
  - Indexes: idx_bot_content_key_active, idx_subscription_plans_management, idx_subscription_plans_admin_lookup, idx_bot_users_current_plan_id, idx_channel_memberships_added_by, idx_channel_memberships_package_id, idx_user_package_assignments_assigned_by, idx_plan_channels_plan_id_active, various payments/user_subscriptions indexes.
- Observations: extensive RLS usage with bot-managed policies; foreign key backfills linking tables to bot_users; numerous performance indexes.

## 6) CI Workflows
- Workflows:
  - assets_audit.yml — trigger: pull_request, workflow_dispatch; jobs: audit
  - audit.yml — trigger: schedule (cron), workflow_dispatch; jobs: audit
  - auto-merge.yml — trigger: workflow_run (Deno); jobs: merge
  - auto-pr.yml — trigger: push (non-main); jobs: test-and-pr
  - checks.yml — trigger: push main, pull_request main; jobs: typecheck
  - ci-deploy-dc.yml — trigger: push main, pull_request main; jobs: check
  - deno.yml — trigger: push main, pull_request main; jobs: test
  - migrations.yml — trigger: push main, workflow_dispatch; jobs: migrate
  - post_deploy_smoke.yml — trigger: workflow_dispatch; jobs: smoke
  - splinter-fk-index.yml — trigger: workflow_dispatch, schedule; jobs: splinter
  - verify.yml — trigger: pull_request, workflow_dispatch; jobs: verify

## 7) Tests & Coverage Hints
- Test files: 7 — tests/placeholder.test.ts, tests/broadcast-queue.test.ts, tests/telegram-webhook.test.ts, tests/featureflags.test.ts, tests/retry.test.ts, tests/cache.test.ts, tests/circuit.test.ts
- `Deno.test` count: 7
- Gaps/opportunities:
  - Add integration tests for payment flows and edge functions
  - Expand coverage around Supabase client utilities

## 8) Deno Tasks
- check → deno check supabase/functions/telegram-bot/*.ts supabase/functions/telegram-bot/**/*.ts
- serve → supabase functions serve
- fmt → bash -lc '$(bash scripts/deno_bin.sh) fmt --check .'
- fmt:write → bash -lc '$(bash scripts/deno_bin.sh) fmt .'
- lint → bash -lc '$(bash scripts/deno_bin.sh) lint'
- lint:fix → bash scripts/fix_all.sh
- typecheck → bash scripts/typecheck.sh
- ci → bash scripts/ci.sh
- fix:repo → bash scripts/fix_and_check.sh

## 9) Docs Present
- README.md — project overview
- docs/CONFIG.md — configuration notes
- docs/GO_LIVE_CHECKLIST.md — deployment checklist
- docs/agent.md — agent instructions
- docs/api-documentation.md — API documentation
- docs/code-structure.md — code layout
- docs/index-advisor.md — index recommendations
- docs/supabase-audit-report.md — audit report

## 10) TODO / FIXME Inventory
- None found

## 11) Action Items (prioritized)
- **High:**
  - Add default exports to edge functions for clarity
  - Implement integration tests for payment and webhook flows
  - Document environment variables and expected values
- **Medium:**
  - Consolidate duplicate Supabase client creation
  - Automate generation of repo summary docs
- **Low:**
  - Review and prune unused scripts
  - Expand README with setup instructions

---
*This file is generated add-only. No handlers were modified.*
