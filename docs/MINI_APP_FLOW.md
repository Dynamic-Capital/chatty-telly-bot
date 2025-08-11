# Mini App Flow

- Bot `/start` → web_app URL (`MINI_APP_URL`)
- WebApp boot → initData → POST `/verify-initdata`
- App loads VIP via `/miniapp-health`
- Public packages via Supabase REST (anon)
