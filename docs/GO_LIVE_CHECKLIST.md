# Go Live Checklist

- [ ] Webhook set & verified.
- [ ] Bank happy path (should approve).
- [ ] Bank near-miss (manual_review with reason).
- [ ] Duplicate image (blocked).
- [ ] (If crypto enabled) TXID awaiting confirmations → approve later.
- [ ] Admin commands respond.

## Local webhook smoke test

```bash
# Start local stack
supabase start

# Serve the function (new terminal)
supabase functions serve telegram-bot --no-verify-jwt

# Ping (expects 200)
curl -X POST "http://127.0.0.1:54321/functions/v1/telegram-bot?secret=$TELEGRAM_WEBHOOK_SECRET" \
  -H "content-type: application/json" -d '{"test":"ping"}'
```
