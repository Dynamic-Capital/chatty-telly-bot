interface ViteMeta {
  env?: Record<string, string | undefined>;
}

const meta = import.meta as ImportMeta & ViteMeta;

export function getProjectRef(): string | null {
  const pr = meta.env?.VITE_SUPABASE_PROJECT_ID;
  if (pr) return pr;
  const sb = meta.env?.VITE_SUPABASE_URL;
  if (sb) {
    try {
      return new URL(sb).hostname.split('.')[0];
    } catch {
      // ignore parsing errors
    }
  }
  return new URLSearchParams(location.search).get('pr');
}
export function functionUrl(name: string): string | null {
  const ref = getProjectRef();
  return ref ? `https://${ref}.functions.supabase.co/${name}` : null;
}
export function supabaseUrl(): string | null {
  return meta.env?.VITE_SUPABASE_URL || new URLSearchParams(location.search).get('sb');
}
export function anonKey(): string | null {
  return meta.env?.VITE_SUPABASE_ANON_KEY || new URLSearchParams(location.search).get('anon');
}
