# Telegram Mini App Deployment Guide

## Quick Deploy

To build the mini app and deploy it along with the deposit endpoint in one command:

```bash
bash scripts/build-deploy-miniapp.sh
```

This will:
1. Build the front-end in `miniapp/`
2. Sync static files to `supabase/functions/miniapp/static/`
3. Deploy both `miniapp` and `miniapp-deposit` edge functions to Supabase

## Manual Steps

If you prefer to run steps individually:

```bash
# 1. Build the miniapp front-end
cd miniapp
npm install
npm run build
cd ..
node scripts/sync-miniapp-static.mjs

# 2. Deploy functions
npx supabase functions deploy miniapp miniapp-deposit
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