# Dynamic Capital Mini App

Telegram Mini App implementing a glassmorphism UI for simple deposit flows.

## Development

```
npm install
npm run dev
```

The app lives under `apps/mini`. It relies on existing Edge Function endpoints:

- `POST /api/intent` for creating bank/crypto intents
- `POST /api/receipt` for uploading deposit receipts
- `POST /api/crypto-txid` for submitting crypto transactions
- `GET /api/receipts` for recent receipts

SVG placeholders live in `apps/mini/public` for the logo, bank tiles and QR
frame; replace them with production assets as needed.

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
