# Phase 4 — Admin approvals & VIP lifecycle

## Endpoints

- POST /admin-review-payment Headers: X-Admin-Secret: $ADMIN_API_SECRET Body: {
  admin_telegram_id, payment_id, decision: "approve"|"reject", months?, message?
  }

- Scheduled: /subscriptions-cron Flip is_vip=false on expired, and send
  reminders at D-7 and D-1.

## Secrets

- ADMIN_API_SECRET (hex)
- TELEGRAM_ADMIN_IDS (comma-separated; spaces are ignored)
  - Example: `TELEGRAM_ADMIN_IDS=225513686,8411280111`
  - A misformatted or missing ID results in a `401 Unauthorized`
- TELEGRAM_BOT_TOKEN (for user notifications)

To debug 401 responses from admin endpoints, generate a known-good `initData` via:

```bash
deno run --no-npm -A scripts/make-initdata.ts --id=<your_telegram_id>
```

Then pass that string to `/verify-initdata` to confirm the signature and admin check succeed.

## Flows

- Approve: marks payment completed, extends expiry from current expiry or now,
  sets is_vip=true, logs to admin_logs, notifies user.
- Reject: marks payment rejected, logs, notifies user.
- Cron: reminders + auto-expire + logs.
