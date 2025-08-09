export const getEnv = (k: string) => Deno.env.get(k) ?? null;

export function requireEnv(keys: string[]) {
  const missing: string[] = [];
  for (const k of keys) if (!Deno.env.get(k)) missing.push(k);
  return { ok: missing.length === 0, missing };
}

// Named accessors (add as needed)
export const ENV = {
  SUPABASE_URL: () => getEnv("SUPABASE_URL"),
  SUPABASE_SERVICE_ROLE_KEY: () => getEnv("SUPABASE_SERVICE_ROLE_KEY"),
  TELEGRAM_BOT_TOKEN: () => getEnv("TELEGRAM_BOT_TOKEN"),
  TELEGRAM_WEBHOOK_SECRET: () => getEnv("TELEGRAM_WEBHOOK_SECRET"),
  MINI_APP_URL: () => getEnv("MINI_APP_URL"),
  MINI_APP_SHORT_NAME: () => getEnv("MINI_APP_SHORT_NAME"),
};
