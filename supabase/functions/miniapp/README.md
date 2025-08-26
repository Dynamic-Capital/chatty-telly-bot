# Dynamic Capital Mini App

Telegram Mini App implementing a glassmorphism UI for simple deposit flows.

## Development

```
npm install
npm run dev
```

The app lives under `supabase/functions/miniapp`. It relies on existing Edge Function endpoints:

- `POST /api/intent` for creating bank/crypto intents
- `POST /api/receipt` for uploading deposit receipts
- `POST /api/crypto-txid` for submitting crypto transactions
- `GET /api/receipts` for recent receipts

SVG placeholders live in `supabase/functions/miniapp/static/img` for the logo, bank tiles and
QR frame; replace them with production assets as needed.

## Build

Before deploying the miniapp Edge Function, generate the static assets:

```bash
npm run build
# or
./build.sh
```

This build step creates the `static/` directory that `index.ts` expects when
serving `index.html` and related assets.

## Icons

Buttons such as `PrimaryButton`, `SecondaryButton`, `ApproveButton`, and `RejectButton` accept an optional `icon` prop. For a consistent look, import icons from the [Heroicons React](https://github.com/tailwindlabs/heroicons) package:

```bash
npm install @heroicons/react
```

```tsx
import { CheckIcon } from "@heroicons/react/24/solid";
import PrimaryButton from "./src/components/PrimaryButton";

<PrimaryButton label="Continue" icon={<CheckIcon className="h-4 w-4" />} />;
```

Any `ReactNode` can be supplied if you prefer another icon library.

## Supabase Invocation

Supabase exposes this edge function at `/functions/v1/miniapp`, while the
handler normalizes the path so the same code can serve requests addressed to
`/miniapp` during local development or testing.

### Usage

```bash
# Local Supabase CLI
curl http://127.0.0.1:54321/functions/v1/miniapp/

# Production (replace PROJECT_REF with your project ref)
curl https://PROJECT_REF.supabase.co/functions/v1/miniapp/
```

### Tests

Path handling is covered by
`tests/miniapp-edge-host-routing.test.ts` and the live reachability
check in `supabase/functions/_tests/integration_smoke_test.ts`.

## Storage Hosting

When hosting this mini app via Supabase Storage, set the object metadata explicitly:

- `index.html` → `text/html; charset=utf-8`
- `assets/app.css` → `text/css`
- `assets/app.js` → `text/javascript`

## Required Secrets

The edge function needs the following secrets:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MINIAPP_BUCKET`
- `MINIAPP_INDEX_KEY`
- `MINIAPP_ASSETS_PREFIX`
- `SERVE_FROM_STORAGE=true`
- `MINIAPP_CACHE_LIMIT` (optional, defaults to 100)

