# VIP Sync

The Telegram bot can synchronize VIP membership data from Supabase with external services.
Currently it notifies VIP users through the Telegram Bot API, but the module is
structured so that additional integrations can be added later.

## Sync process

1. Fetch all users marked as `is_vip` from the `bot_users` table.
2. For each user, send a Telegram message confirming their VIP status.
3. Additional systems can hook into the same loop to receive VIP updates.

## Feature flag

All sync operations are wrapped with the `vip_sync_enabled` feature flag.
The flag is checked before the sync starts and during the process so the
operation can be stopped immediately. Disabling the flag halts any in-flight
syncs and prevents new ones from running.
