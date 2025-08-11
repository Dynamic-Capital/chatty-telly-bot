# Phase 8 – Growth

## Promo & Referral Flow
- Users can validate a promo code via `/functions/v1/promo-validate`.
  ```json
  {"code":"WELCOME","telegram_id":123,"plan_id":"plan_basic"}
  ```
  Response includes discount type/value and `final_amount`.
- Applying a code uses `/functions/v1/promo-redeem` with `payment_id` for idempotency. Usage is logged in `promotion_usage` and `promo_analytics`.
- Referral links are generated through `/functions/v1/referral-link` returning a deep link like `https://t.me/bot?startapp=ref_123`.
- When the bot receives `/start` with `ref_<id>` or `promo_<code>`, it records a row in `conversion_tracking` (step 1) and stores the data in `user_sessions.promo_data`.

## Broadcasts
- Dispatch a broadcast with `/functions/v1/broadcast-dispatch` `{ "id": "uuid" }`.
- A cron runner `/functions/v1/broadcast-cron` polls every 5 minutes for rows with `delivery_status='scheduled'` and triggers the dispatcher.
- Safety limits: `BROADCAST_RPS` (default 25 messages/sec) and exponential backoff on 429/5xx responses from Telegram.

## Funnel Tracking
- `/functions/v1/funnel-track` accepts `{ "telegram_id": 123, "step": 2, "data": {...} }` and appends a row to `conversion_tracking`.

## Mini App
- Checkout screen provides "Have a code?" field which calls `promo-validate` then `promo-redeem`.
- Profile page shows the user’s referral link.

