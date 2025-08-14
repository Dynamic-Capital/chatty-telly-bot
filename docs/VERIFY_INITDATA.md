# Verify initData

Capture the Telegram Mini App's `initData` and validate it against the backend.

1. **Capture `initData` in the WebView**
   ```js
   // inside the Mini App running in Telegram
   const initData = window.Telegram?.WebApp?.initData;
   console.log(initData);
   ```
2. **Send it to the verification endpoint**
   Replace `$BASE` with your Supabase Edge URL (e.g. `https://<project>.functions.supabase.co`).
   ```bash
   curl -s -X POST "$BASE/verify-initdata" \
     -H 'content-type: application/json' \
     -d '{"initData":"<copied initData>"}'
   ```
3. **Expect a success response**
   ```json
   {"ok": true}
   ```
