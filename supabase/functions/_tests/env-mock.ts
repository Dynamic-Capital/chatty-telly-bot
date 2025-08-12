// supabase/functions/_tests/env-mock.ts
import { EnvKey } from "../_shared/env.ts";

interface TestEnvGlobal {
  __TEST_ENV__?: Partial<Record<EnvKey, string>>;
}

export function setTestEnv(values: Partial<Record<EnvKey, string>>) {
  (globalThis as TestEnvGlobal).__TEST_ENV__ = { ...values };
}

export function clearTestEnv() {
  delete (globalThis as TestEnvGlobal).__TEST_ENV__;
}
