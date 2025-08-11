/** List all secrets used by the bot + mini app. Add here when new ones arise. */
export type EnvKey =
  | "SUPABASE_URL"
  | "SUPABASE_ANON_KEY"
  | "SUPABASE_SERVICE_ROLE_KEY"
  | "SUPABASE_DB_URL"
  | "SUPABASE_PROJECT_ID"
  | "TELEGRAM_BOT_TOKEN"
  | "TELEGRAM_WEBHOOK_SECRET"
  | "TELEGRAM_BOT_USERNAME"
  | "BINANCE_API_KEY"
  | "BINANCE_SECRET_KEY"
  | "OPENAI_API_KEY"
  | "OPENAI_ENABLED"
  | "FAQ_ENABLED"
  | "SERVICE_ROLE_KEY"
  | "PROJECT_ID"
  | "PROJECT_URL"
  | "DATABASE_PASSWORD"
  | "MINI_APP_URL"
  | "MINI_APP_SHORT_NAME"
  | "BOT_VERSION"
  | "WINDOW_SECONDS"
  | "AMOUNT_TOLERANCE"
  | "REQUIRE_PAY_CODE"
  | "SB_REQUEST_ID"
  | "BENEFICIARY_TABLE";

/** Test-only env injection type */
type TestEnv = Partial<Record<EnvKey, string>>;

/** Get a single env value (production via Deno.env, tests via __TEST_ENV__). */
export function getEnv<K extends EnvKey>(key: K): string {
  const testEnv =
    (globalThis as unknown as { __TEST_ENV__?: TestEnv }).__TEST_ENV__;
  const v = Deno.env.get(key) ?? testEnv?.[key];
  if (!v) throw new Error(`Missing required env: ${key}`);
  return v;
}

/** Get a group of envs at once; will throw if any is missing. */
export function requireEnv<K extends readonly EnvKey[]>(
  keys: K,
): Record<K[number], string> {
  const out: Record<string, string> = {};
  for (const key of keys as readonly EnvKey[]) {
    out[key] = getEnv(key);
  }
  return out as Record<K[number], string>;
}

/** Optionally get an env (returns null if absent). */
export function optionalEnv<K extends EnvKey>(key: K): string | null {
  const testEnv =
    (globalThis as unknown as { __TEST_ENV__?: TestEnv }).__TEST_ENV__;
  return Deno.env.get(key) ?? testEnv?.[key] ?? null;
}

export function need(k: string): string {
  const v = Deno.env.get(k);
  if (!v) throw new Error(`Missing env: ${k}`);
  return v;
}

export const maybe = (k: string) => Deno.env.get(k) ?? null;
