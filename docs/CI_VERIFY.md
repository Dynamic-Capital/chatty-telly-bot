# CI Verify (non-blocking)

This repo includes:
- `scripts/ci-verify.ts` — passes in CI without secrets; does real checks if env exists.
- `scripts/ci-env-sanity.ts` — prints whether common env keys are present (no values).

### Local use
deno run -A scripts/ci-verify.ts
deno run -A scripts/ci-env-sanity.ts

### Notes
- Secrets (Telegram/Supabase) should live in **Supabase Edge**. CI can run without them.
- If you want full verification in CI, add secrets to GitHub → Settings → Secrets and the job will perform real checks automatically.
