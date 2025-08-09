# Agent: Dynamic Capital (Telegram Bot + Mini App)

This document defines how the **Dynamic Capital** agent behaves across Telegram (webhook/commands)
and the optional Telegram **Mini App** (Web App).

---

## 1) Purpose & Scope

- Verify **bank** (BML/MIB) and **crypto** (TXID) deposits.
- Auto-approve when rules pass; otherwise flag for **manual_review**.
- Keep flows **beginner-friendly** and fast for Telegram.

---

## 2) Hard Rules (must always hold)

- **200-fast webhook:** Always return HTTP 200 quickly; run heavy work in background or a scheduled
  worker.
- **OCR only on images:** Run OCR **only** when a Telegram image or image-document is present.
- **Read body once:** Do not call `req.json()` multiple times.
- **No secrets in client:** Never expose `SUPABASE_SERVICE_ROLE_KEY` in browser/Mini App.
- **Idempotent DB changes:** Duplicate image uploads must be rejected via image `sha256`.
- **Time zone:** Maldives (UTC **+05:00**) for receipt timestamps.

---

## 3) Env Contract (names only)

Read via `Deno.env.get` (functions) and feature-flag safely (fail soft).

**Runtime (required):**

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`

**Runtime (optional / defaults):**

- `BENEFICIARY_TABLE` (default: `beneficiaries`) — **read-only**
- `AMOUNT_TOLERANCE` (default: `0.02`) — ±2%
- `WINDOW_SECONDS` (default: `180`)
- `REQUIRE_PAY_CODE` (default: `false`)
- `OPENAI_API_KEY`, `OPENAI_ENABLED` (default: `false`)
- `MINI_APP_URL` (default: unset) — shows “Open Mini App” button when present

**CI only:**

- `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_ID`, `SUPABASE_DB_PASSWORD`

If a **required** key is missing at runtime: **log** and **return 200** (do not crash).

---

## 4) Bank Auto-Approval (BML/MIB)

**Inputs:** Receipt image → OCR (Tesseract) → `parseBankSlip` (BML/MIB + `pay_code`).

**Pass conditions (all true):**

1. **Amount** within `AMOUNT_TOLERANCE` of `intent.expected_amount`
2. **Time window:** parsed (txn/value) time within `WINDOW_SECONDS` of `intent.created_at`
   (UTC+05:00)
3. **Status:** “SUCCESS/Successful”
4. **Beneficiary/account:**
   - matches intent snapshot **or**
   - matches an **approved** record in `BENEFICIARY_TABLE` (read-only)
5. **pay_code:** if `REQUIRE_PAY_CODE=true` and intent has one, parsed `pay_code` must match

**Outcomes:**

- ✅ **approve** → set `payment_intents.status='approved'`, `approved_at=now()`, notify user
- 🔎 **manual_review** with a clear **reason** (e.g., `amount_mismatch`, `time_window_failed`,
  `status_not_success`, `beneficiary_mismatch`, `missing_pay_code`, `parse_failed`)

**Duplicates:** Reject if `image_sha256` already exists for this user/intent.

---

## 5) Crypto Deposits (TXID)

- **Never** approve from screenshots.
- Require **TXID**; verify on chain (network, token, **to** address, amount, min confirmations).
- Approve when confirmations reach threshold; otherwise show “awaiting confirmations”.

---

## 6) Telegram Webhook Behavior

- **Secret check:** `?secret=` must match `TELEGRAM_WEBHOOK_SECRET`; on mismatch respond **200**
  (skip processing).
- **Ping path:** if body is `{"test":"ping"}`, return `{"pong":true}` 200.
- **OCR guard:** if no image/document, skip OCR and return 200.
- **Errors:** Wrap handler in try/catch; log, then return 200 `{ ok: true }`.

---

## 7) Admin & Health Commands

- `/ping` → `{ pong: true }`
- `/version` → short SHA/date
- `/env_status` → **present/missing** for required keys; flags state (no values)
- `/review` → list recent `manual_review`
- `/replay <receiptId>` → reprocess one
- `/webhook_info` → Telegram webhook status

> Restrict to admin chat IDs only.

---

## 8) Mini App (Web App) Notes

- **Theme:** “Dynamic Glass” (glassmorphism), **1:1 assets only**.
- **Button:** show **“Open Mini App”** only if `MINI_APP_URL` is set (read from env).
- **Auth:** Validate `initData` server-side using bot token; never expose service_role.
- **Client reads:** may use `supabase-js` (anon) with RLS for read-only; all writes via Edge
  Functions.

---

## 9) Logging & Safety

- Structured logs (single line): `event, sb_request_id, ocrMs, parserConfidence, verdict, reason`.
- Never log secrets or raw PII.
- Simple rate limit: e.g., 1 receipt upload per chat per 5s.

---

## 10) Testing & CI

- **Local:**\
  `supabase start` → `supabase functions serve telegram-bot --no-verify-jwt` →\
  `curl -X POST "http://127.0.0.1:54321/functions/v1/telegram-bot?secret=$TELEGRAM_WEBHOOK_SECRET" -H "content-type: application/json" -d '{"test":"ping"}'`
- **Typecheck:**
  `deno check supabase/functions/telegram-bot/*.ts supabase/functions/telegram-bot/**/*.ts`
- **Post-deploy smoke:** invoke ping; check `getWebhookInfo` has `?secret=` and low pending updates.

---

## 11) Change Management

- Update this doc when toggles change (`REQUIRE_PAY_CODE`, `AMOUNT_TOLERANCE`, etc.) or when new
  banks/networks are added.
- Treat `/docs/agent.md` like code—changes via PR with reviewers.
