export function requireEnv(keys: string[]): { ok: boolean; missing: string[] } {
  const missing = keys.filter((k) => !Deno.env.get(k));
  return { ok: missing.length === 0, missing };
}

export function getEnvBool(name: string, fallback = false): boolean {
  const v = Deno.env.get(name);
  if (v === undefined) return fallback;
  return v === "true" || v === "1";
}

export function getEnvNum(name: string, fallback: number): number {
  const v = Deno.env.get(name);
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

export const config = {
  SUPABASE_URL: Deno.env.get("SUPABASE_URL"),
  SUPABASE_SERVICE_ROLE_KEY: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
  TELEGRAM_BOT_TOKEN: Deno.env.get("TELEGRAM_BOT_TOKEN"),
  TELEGRAM_WEBHOOK_SECRET: Deno.env.get("TELEGRAM_WEBHOOK_SECRET"),
  BENEFICIARY_TABLE: Deno.env.get("BENEFICIARY_TABLE"),
  WINDOW_SECONDS: getEnvNum("WINDOW_SECONDS", 180),
  AMOUNT_TOLERANCE: getEnvNum("AMOUNT_TOLERANCE", 0.02),
  OPENAI_API_KEY: Deno.env.get("OPENAI_API_KEY"),
  OPENAI_ENABLED: getEnvBool("OPENAI_ENABLED"),
  MINI_APP_URL: Deno.env.get("MINI_APP_URL"),
};
