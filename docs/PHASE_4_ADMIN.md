# Phase 4 — Admin approvals & VIP lifecycle

## Endpoints

- POST /admin-review-payment Headers: X-Admin-Secret: $ADMIN_API_SECRET Body: {
  admin_telegram_id, payment_id, decision: "approve"|"reject", months?, message?
  }

- Scheduled: /subscriptions-cron Flip is_vip=false on expired, and send
  reminders at D-7 and D-1.

## Secrets

- ADMIN_API_SECRET (hex)
- TELEGRAM_ADMIN_IDS (comma-separated)
- TELEGRAM_BOT_TOKEN (for user notifications)

## Flows

- Approve: marks payment completed, extends expiry from current expiry or now,
  sets is_vip=true, logs to admin_logs, notifies user.
- Reject: marks payment rejected, logs, notifies user.
- Cron: reminders + auto-expire + logs.
