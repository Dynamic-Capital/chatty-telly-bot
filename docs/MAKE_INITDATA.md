# make-initdata

Generate signed Telegram WebApp `initData` strings for local testing.

## Usage

```bash
# Export bot token from Supabase Edge secrets
export TELEGRAM_BOT_TOKEN=<your_bot_token>

# Default one-line initData
deno task make:initdata

# Custom user and extras (JSON output)
deno task make:initdata --id=225513686 --username=DynamicCapital_Support \
  --first-name="The Wandering Trader" --query-id=QA1 --extra=start_param=ref_abc --json
```

## Optional verification

If `/verify-initdata` is deployed:

```bash
curl -s https://qeejuomcapbdlhnjqjcc.functions.supabase.co/verify-initdata \
  -H 'content-type: application/json' \
  -d "{\"initData\":\"$(deno task make:initdata)\"}"
# → {"ok":true,...}
```
