# Flow Overview

## A) Request Flow (Telegram → Edge → DB → Telegram)
```mermaid
flowchart LR
  TG[User • Telegram] -->|update| WH[Edge Function: telegram-webhook]
  WH --> SB[(Supabase Postgres)]
  SB --> VW[current_vip view]
  WH --> TG2[Telegram API]
```

## B) Payments/Activation
```mermaid
sequenceDiagram
  participant User
  participant Bot
  participant Edge as Edge Function: binance-pay-webhook
  participant DB as Supabase (DB)
  User->>Bot: Pay + Provide receipt
  Bot->>Edge: /verify (admin) or webhook
  Edge->>DB: payments.status=completed
  DB-->>DB: trigger/logic updates user_subscriptions
  Edge->>Bot: Invite link / access granted
```
