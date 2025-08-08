export function requireEnv(keys: string[]): { ok: boolean; missing: string[] } {
  const missing = keys.filter((k) => !Deno.env.get(k));
  return { ok: missing.length === 0, missing };
}
