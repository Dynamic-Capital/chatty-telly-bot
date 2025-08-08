export type Fetcher<T> = () => Promise<T>;

interface CacheEntry<T> {
  value: T;
  expiry: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

function getStorage() {
  try {
    if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis) {
      return (globalThis as { localStorage: Storage }).localStorage;
    }
  } catch {
    // accessing localStorage can throw in some environments
  }
  return undefined;
}

const storage = getStorage();

export async function getCached<T>(key: string, ttlMs: number, fetcher: Fetcher<T>): Promise<T> {
  const now = Date.now();

  // memory cache check
  const existing = cache.get(key);
  if (existing && existing.expiry > now) {
    return existing.value as T;
  }

  // localStorage cache check
  if (storage) {
    try {
      const raw = storage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as CacheEntry<T>;
        if (parsed.expiry > now) {
          cache.set(key, parsed);
          return parsed.value;
        }
      }
    } catch {
      // ignore JSON errors
    }
  }

  const value = await fetcher();
  const entry: CacheEntry<T> = { value, expiry: now + ttlMs };
  cache.set(key, entry);
  try {
    storage?.setItem(key, JSON.stringify(entry));
  } catch {
    // ignore storage write errors
  }
  return value;
}

export function clearCache(key?: string) {
  if (key) {
    cache.delete(key);
    try {
      storage?.removeItem(key);
    } catch {
      // ignore storage remove errors
    }
  } else {
    cache.clear();
    try {
      storage?.clear();
    } catch {
      // ignore storage clear errors
    }
  }
}

export function cacheStats() {
  return {
    size: cache.size,
    keys: Array.from(cache.keys()),
  };
}
