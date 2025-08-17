import { createClient } from "./client.ts";

// In-memory fallback map when kv_config table is unavailable
const memStore = new Map<string, unknown>();

let supabase: ReturnType<typeof createClient> | null | undefined = undefined;

function getClient() {
  if (supabase !== undefined) return supabase;

  try {
    supabase = createClient();
    return supabase;
  } catch (e) {
    console.error("Failed to create Supabase client:", e);
    supabase = null;
    return null;
  }
}

async function getConfig<T = unknown>(key: string, def?: T): Promise<T> {
  const client = getClient();
  if (client) {
    try {
      const { data, error } = await client.from("kv_config").select("value").eq(
        "key",
        key,
      ).maybeSingle();
      if (!error && data && typeof data.value !== "undefined") {
        return data.value;
      }
    } catch (e) {
      console.error("Error getting config:", e);
      // fall back to memory store
    }
  }
  return (memStore.has(key) ? memStore.get(key) : def) as T;
}

async function setConfig(key: string, val: unknown): Promise<void> {
  const client = getClient();
  if (client) {
    try {
      const { error } = await client.from("kv_config").upsert({
        key,
        value: val,
      });
      if (!error) {
        memStore.set(key, val);
        return;
      }
    } catch (e) {
      console.error("Error setting config:", e);
      // ignore and fall back
    }
  }
  memStore.set(key, val);
}

export async function getFlag(name: string, def = false): Promise<boolean> {
  const snap = await getConfig<{ data: Record<string, boolean> }>(
    "features:published",
    { data: {} },
  );
  return snap.data[name] ?? def;
}

export async function setFlag(name: string, val: boolean): Promise<void> {
  const snap = await getConfig<{ ts: number; data: Record<string, boolean> }>(
    "features:draft",
    { ts: Date.now(), data: {} },
  );
  snap.data[name] = val;
  snap.ts = Date.now();
  await setConfig("features:draft", snap);
}

export {
  getConfig,
  setConfig,
};