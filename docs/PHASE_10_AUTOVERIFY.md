# Phase 10: Auto-Verify Payments

## Edge Functions

- **/receipt-ocr** — input `{ payment_id }`, analyzes the stored receipt image
  with OpenAI and writes results to `payments.webhook_data.ocr`.
- **/payments-auto-review** — scans recent pending payments and auto-approves
  when rules pass; logs `admin_logs` and reuses Phase 4 approver endpoint.
- **/binancepay-webhook** — stubbed Binance Pay webhook (disabled by default)
  until signature verification is implemented.

## Verification Rules

Defaults stored in `bot_settings`:

- `AMOUNT_TOLERANCE`: 0.05 (5% difference allowed)
- `WINDOW_SECONDS`: 7200 (2‑hour receipt time window)

A payment is approved when:

1. OCR confidence ≥ 0.7
2. Amount within tolerance
3. Currency matches
4. Receipt date within time window

Enable Binance hooks by setting `BINANCE_ENABLED=true` after implementing
signature checks.
