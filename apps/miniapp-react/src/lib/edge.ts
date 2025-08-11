export function getProjectRef(): string | null {
  const pr = (import.meta as any).env?.VITE_SUPABASE_PROJECT_ID as string | undefined;
  if (pr) return pr;
  const sb = (import.meta as any).env?.VITE_SUPABASE_URL as string | undefined;
  if (sb) { try { return new URL(sb).hostname.split('.')[0]; } catch {} }
  return new URLSearchParams(location.search).get('pr');
}
export function functionUrl(name: string): string | null {
  const ref = getProjectRef();
  return ref ? `https://${ref}.functions.supabase.co/${name}` : null;
}
export function supabaseUrl(): string | null {
  return (import.meta as any).env?.VITE_SUPABASE_URL || new URLSearchParams(location.search).get('sb');
}
export function anonKey(): string | null {
  return (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || new URLSearchParams(location.search).get('anon');
}
