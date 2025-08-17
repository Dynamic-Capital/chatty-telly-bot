# Telegram Mini App Deployment Guide

## Quick Deploy

To build and deploy the telegram mini app in one command:

```bash
deno task miniapp:deploy
```

This will:
1. Build the React miniapp in `supabase/functions/miniapp/`
2. Generate static files in `supabase/functions/miniapp/static/`
3. Verify the build quality
4. Deploy the miniapp edge function to Supabase

## Manual Steps

If you prefer to run steps individually:

```bash
# 1. Build the miniapp
cd supabase/functions/miniapp
npm install
npm run build
cd ../../..

# 2. Verify build
deno run -A scripts/assert-miniapp-bundle.ts

# 3. Deploy function
npx supabase functions deploy miniapp
```

## Accessing Your Mini App

After deployment, your mini app will be available at:
- `https://YOUR_PROJECT_REF.functions.supabase.co/miniapp/`

## Setting Up Telegram Integration

1. Set the mini app URL in your Supabase secrets:
```bash
npx supabase secrets set MINI_APP_URL=https://YOUR_PROJECT_REF.functions.supabase.co/miniapp/
```

2. Update the telegram bot to use the new mini app:
```bash
npx supabase functions deploy telegram-bot
```

3. Set the Telegram chat menu button:
```bash
deno run -A scripts/set-chat-menu-button.ts
```

## Troubleshooting

### "static/index.html missing from bundle"
This error means the React build didn't complete successfully. Run:
```bash
cd supabase/functions/miniapp
npm run build
```

Check that `supabase/functions/miniapp/static/index.html` exists and has content.

### Build fails
Ensure you have Node.js installed and run:
```bash
cd supabase/functions/miniapp
npm install
```

### Function deployment fails
Make sure you're logged into Supabase:
```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
```