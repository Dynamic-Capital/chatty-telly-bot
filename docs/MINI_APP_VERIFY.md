## Health endpoint

- Deployed at: /miniapp-health (Edge)
- GET → env presence + reachability (non-fatal)
- POST → { telegram_id } or { initData } → VIP status via Supabase REST
  (read-only) Run: deno run -A scripts/miniapp-health-check.ts
