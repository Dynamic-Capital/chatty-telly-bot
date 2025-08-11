# Service Role Key — Usage & Safety

- Use only in Supabase Edge Functions via Deno.env at runtime.
- Never use in client code, tests, or GitHub Actions.
- Prefer anon key for public reads; elevate via RPC where possible.

## Rotation (recommended quarterly or after suspected exposure)
npx supabase login
npx supabase link --project-ref <PROJECT_REF>

Generate a new key in Supabase dashboard (Settings → API), then update Edge Secrets:
npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<NEW_VALUE>

Redeploy affected functions
npx supabase functions deploy telegram-bot
