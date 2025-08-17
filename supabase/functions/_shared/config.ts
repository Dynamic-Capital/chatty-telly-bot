import { createClient } from "./client.ts";

// In-memory fallback map when kv_config table is unavailable
const memStore = new Map<string, unknown>();

// Internal service-role client (no session persistence via createClient)
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

// Simple in-memory cache with TTL (60s)
const TTL_MS = 60 * 1000;
const cache = new Map<string, { value: unknown; exp: number }>();

function getCached<T>(key: string): T | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.exp) {
    cache.delete(key);
    return null;
  }
  return hit.value as T;
}

function setCached<T>(key: string, value: T): void {
  cache.set(key, { value, exp: Date.now() + TTL_MS });
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

// === Bot settings & content helpers ===

export let getSetting = async <T = unknown>(key: string): Promise<T | null> => {
  const cached = getCached<T>(`s:${key}`);
  if (cached !== null) return cached;
  const client = getClient();
  if (!client) return null;
  try {
    const { data, error } = await client.from("bot_settings").select(
      "setting_value",
    ).eq("setting_key", key).eq("is_active", true).maybeSingle();
    if (!error && data && typeof data.setting_value !== "undefined") {
      const val = data.setting_value as T;
      setCached(`s:${key}`, val);
      return val;
    }
  } catch (e) {
    console.error("Error getting setting:", e);
  }
  return null;
};

// Test helper to override getSetting
export function __setGetSetting(fn: typeof getSetting) {
  getSetting = fn;
}

async function requireSetting<T = unknown>(key: string): Promise<T> {
  const val = await getSetting<T>(key);
  if (val == null) throw new Error(`Missing setting: ${key}`);
  return val;
}

async function envOrSetting<T = string>(
  envKey: string,
  settingKey = envKey,
): Promise<T | null> {
  const envVal = Deno.env.get(envKey);
  if (envVal != null) return envVal as unknown as T;
  return await getSetting<T>(settingKey);
}

async function getContent<T = string>(
  key: string,
): Promise<T | null> {
  const cached = getCached<T>(`c:${key}`);
  if (cached !== null) return cached;
  const client = getClient();
  if (!client) return null;
  try {
    const { data, error } = await client.from("bot_content").select(
      "content_value",
    ).eq("content_key", key).eq("is_active", true).maybeSingle();
    if (!error && data && typeof data.content_value !== "undefined") {
      const val = data.content_value as T;
      setCached(`c:${key}`, val);
      return val;
    }
  } catch (e) {
    console.error("Error getting content:", e);
  }
  return null;
}

export {
  getConfig,
  setConfig,
  requireSetting,
  envOrSetting,
  getContent,
};