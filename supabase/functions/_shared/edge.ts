// supabase/functions/_shared/edge.ts
// Shared utilities to compute your Supabase Functions host and build URLs consistently.
// Prefer using these helpers anywhere you call an Edge function.

export function getProjectRef(): string | null {
  const ref = Deno.env.get("SUPABASE_PROJECT_ID");
  if (ref) return ref;
  const url = Deno.env.get("SUPABASE_URL"); // e.g., https://qeejuomcapbdlhnjqjcc.supabase.co
  if (!url) return null;
  try {
    const m = new URL(url).hostname.split(".")[0];
    return m || null;
  } catch { return null; }
}

export function functionsHost(): string | null {
  const ref = getProjectRef();
  return ref ? `${ref}.functions.supabase.co` : null;
}

export function functionUrl(name: string): string | null {
  const host = functionsHost();
  return host ? `https://${host}/${name}` : null;
}
