export type Fetcher<T> = () => Promise<T>;

interface CacheEntry<T> {
  value: T;
  expiry: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

export async function getCached<T>(key: string, ttlMs: number, fetcher: Fetcher<T>): Promise<T> {
  const now = Date.now();
  const existing = cache.get(key);
  if (existing && existing.expiry > now) {
    return existing.value as T;
  }
  const value = await fetcher();
  cache.set(key, { value, expiry: now + ttlMs });
  return value;
}

export function clearCache(key?: string) {
  if (key) {
    cache.delete(key);
  } else {
    cache.clear();
  }
}

export function cacheStats() {
  return {
    size: cache.size,
    keys: Array.from(cache.keys()),
  };
}
