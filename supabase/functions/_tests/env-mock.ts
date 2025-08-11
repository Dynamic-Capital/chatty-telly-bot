// supabase/functions/_tests/env-mock.ts
import { EnvKey } from "../_shared/env.ts";

export function setTestEnv(values: Partial<Record<EnvKey, string>>) {
  (globalThis as any).__TEST_ENV__ = { ...values };
}

export function clearTestEnv() {
  delete (globalThis as any).__TEST_ENV__;
}
