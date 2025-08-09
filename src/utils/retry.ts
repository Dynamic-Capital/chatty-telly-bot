export async function withRetry<T>(fn: () => Promise<T>, tries = 5) {
  let err: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      err = e;
      const base = 250 * (2 ** i);
      const jitter = Math.floor(Math.random() * 100);
      await new Promise((r) => setTimeout(r, base + jitter));
    }
  }
  throw err;
}
