// Utilities for accessing feature flag configuration via secure edge function

type FlagSnapshot = { ts: number; data: Record<string, boolean> };

const SUPABASE_URL =
  (typeof Deno !== "undefined"
    ? Deno.env.get("SUPABASE_URL")
    : typeof process !== "undefined"
    ? process.env.SUPABASE_URL
    : import.meta.env?.VITE_SUPABASE_URL) || "";
const SUPABASE_KEY =
  (typeof Deno !== "undefined"
    ? Deno.env.get("SUPABASE_ANON_KEY")
    : typeof process !== "undefined"
    ? process.env.SUPABASE_ANON_KEY
    : import.meta.env?.VITE_SUPABASE_KEY) || "";

async function call<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error("Missing Supabase configuration");
  }
  const res = await fetch(`${SUPABASE_URL}/functions/v1/config`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
    body: JSON.stringify({ action, ...payload }),
  });
  if (!res.ok) {
    throw new Error(`Config edge function error: ${await res.text()}`);
  }
  return (await res.json()) as T;
}

const configClient = {
  async getFlag(name: string, def = false): Promise<boolean> {
    const data = await call<{ data: boolean }>("getFlag", { name, def });
    return data?.data ?? def;
  },

  async setFlag(name: string, value: boolean): Promise<void> {
    await call("setFlag", { name, value });
  },

  async preview(): Promise<FlagSnapshot> {
    return await call<FlagSnapshot>("preview");
  },

  async publish(adminId?: string): Promise<void> {
    await call("publish", { adminId });
  },

  async rollback(adminId?: string): Promise<void> {
    await call("rollback", { adminId });
  },
};

export const { getFlag, setFlag, preview, publish, rollback } = configClient;
export { configClient };
