# Variables and Links Checklist

Use this checklist to verify the project is configured for production rather than a test environment.

## Environment variables and handles

- [ ] Confirm all required secrets are set in Supabase Edge functions (e.g., `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).
- [ ] Ensure each secret corresponds to the live project, not staging values.
- [ ] Verify any bot handles or usernames referenced in code match the production bot.
- [ ] Remove or replace any placeholder tokens or test identifiers in `.env` files and scripts.
- [ ] Publish the Telegram bot via BotFather and disable any test bots.
- [ ] Confirm the Mini App is deployed and published at its production URL or short name.

## Links and endpoints

- [ ] Check that `MINI_APP_URL` points to the production domain.
- [ ] Search the codebase for `localhost`, `test`, or staging URLs and replace them with production hosts.
- [ ] Run `deno run -A scripts/audit-edge-hosts.ts` and `deno run -A scripts/check-linkage.ts` to confirm all function calls use the expected Supabase host.
- [ ] Verify any external links in the Mini App UI lead to live services.
- [ ] Remove or disable any feature flags or debug endpoints meant only for testing.

Run through this list before deploying to ensure the bot and Mini App reference only production resources.
