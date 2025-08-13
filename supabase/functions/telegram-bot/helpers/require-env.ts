import { EnvKey, optionalEnv } from "../../_shared/env.ts";

export function requireEnv(
  keys: readonly string[],
): { ok: boolean; missing: string[] } {
  const missing = keys.filter((k) => !optionalEnv(k as EnvKey));
  return { ok: missing.length === 0, missing };
}
