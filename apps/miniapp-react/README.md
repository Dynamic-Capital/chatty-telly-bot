# Dynamic Capital — Telegram Mini App (React + Tailwind)

- Landing page (`/`): greet user and direct to dashboard.
- Dashboard (`/dashboard`): show VIP status and list active education packages.
- Uses Telegram WebApp SDK; derives Supabase Functions URLs from the same project as the bot (`functionUrl()`).
- Calls `verify-initdata` and `miniapp-health` on Supabase Edge; reads packages via Supabase REST (anon key only).
- Responsive, modern Tailwind design with dark mode.

## Development
```bash
cd apps/miniapp-react
npm i
npm run dev
# open http://localhost:5173/?sb=https://<PROJECT>.supabase.co&anon=<ANON>&pr=<PROJECT_REF>
```

## Build / Deploy
```bash
npm run build
# Upload apps/miniapp-react/dist to the domain you set in MINI_APP_URL.
```
