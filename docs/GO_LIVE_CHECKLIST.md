# Go Live Checklist

- [ ] Webhook set & verified.
- [ ] Bank happy path (should approve).
- [ ] Bank near-miss (manual_review with reason).
- [ ] Duplicate image (blocked).
- [ ] (If crypto enabled) TXID awaiting confirmations → approve later.
- [ ] Admin commands respond.

## Local webhook smoke test

```bash
# 1) Start Supabase local stack (API on :54321)
supabase start

# 2) Serve the function in another terminal
supabase functions serve telegram-bot --no-verify-jwt

# 3) Ping it locally (replace SECRET as needed)
curl -i -X POST \
  "http://127.0.0.1:54321/functions/v1/telegram-bot?secret=$TELEGRAM_WEBHOOK_SECRET" \
  -H "content-type: application/json" \
  -d '{"test":"ping"}'
```
