# Secrets Management

All runtime secrets for the bot and mini app live in **Supabase Edge ➜ Functions
➜ Secrets**. These values are injected at runtime by Supabase and should never
be hard-coded.

## Accessing secrets

Use the helpers from `supabase/functions/_shared/env.ts`:

- `getEnv(key)` – returns the value or throws if missing
- `requireEnv([...keys])` – fetch multiple required keys at once
- `optionalEnv(key)` – returns the value or `null` if absent

Direct `Deno.env.get()` calls are forbidden outside `env.ts`. A guard task
(`deno task guard:env`) enforces this.

## Testing

Tests can supply mock secrets without touching `Deno.env` via:

```ts
import {
  clearTestEnv,
  setTestEnv,
} from "../../supabase/functions/_tests/env-mock.ts";

setTestEnv({ TELEGRAM_BOT_TOKEN: "test-token" });
// ...run code that reads env...
clearTestEnv();
```

This injects values into `globalThis.__TEST_ENV__`, which the helpers read
before falling back to real environment variables.

## Adding new secrets

1. Add the key name to the `EnvKey` union in
   `supabase/functions/_shared/env.ts`.
2. Access it via the helpers.
3. Store the secret in Supabase Edge ➜ Functions ➜ Secrets.
4. If used in tests, provide mock values with `setTestEnv`.

Keep all secrets in Supabase; never commit them to the repository.
