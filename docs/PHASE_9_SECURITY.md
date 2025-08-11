- RLS deny-all on sensitive tables (Edge-only access).
- Banlist usage & Admin endpoint (/admin-bans with initData auth).
- Retention cron (RETENTION_DAYS, defaults 90).
- Mini App CSP headers and why frame-ancestors * is required for Telegram
  WebView.
- Secret rotation endpoint (/rotate-webhook-secret using X-Admin-Secret), and
  note that bot prefers DB secret.
