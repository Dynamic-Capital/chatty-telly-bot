export function circuit(maxFails = 5, coolMs = 30_000) {
  let fails = 0;
  let until = 0;
  return {
    async run<T>(fn: () => Promise<T>) {
      const now = Date.now();
      if (now < until) throw new Error("circuit_open");
      try {
        const result = await fn();
        fails = 0;
        return result;
      } catch (err) {
        if (++fails >= maxFails) {
          // use current time when failure occurs rather than start time
          until = Date.now() + coolMs;
        }
        throw err;
      }
    },
  };
}
// usage: await breaker.run(() => fetch(...))
