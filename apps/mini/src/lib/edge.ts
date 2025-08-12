interface ViteMeta {
  env?: Record<string, string | undefined>;
}

export function functionUrl(name: string): string | null {
  const meta = import.meta as ImportMeta & ViteMeta;
  const ref =
    meta.env?.VITE_SUPABASE_PROJECT_ID ||
    (() => {
      try {
        const url = meta.env?.VITE_SUPABASE_URL;
        return url ? new URL(url).hostname.split('.')[0] : null;
      } catch {
        return null;
      }
    })() ||
    new URLSearchParams(globalThis.location?.search || '').get('pr');
  return ref ? `https://${ref}.functions.supabase.co/${name}` : null;
}
