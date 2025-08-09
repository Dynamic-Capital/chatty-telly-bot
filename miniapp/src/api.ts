/* >>> DC BLOCK: api-core (start) */
const base = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/,'') || window.location.origin;

function getInitData(): string { return window.Telegram?.WebApp?.initData || ''; }

export async function verify() {
  const res = await fetch(`${base}/functions/v1/tg-verify-init`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ initData: getInitData() }),
  });
  const json = await res.json();
  if (!res.ok || !json?.ok) throw new Error(json?.error || 'verify failed');
  return json as { ok:boolean; user_id:number; username?:string; session_token:string };
}

export async function getTheme(session_token: string) {
  const r = await fetch(`${base}/functions/v1/theme-get`, {
    headers: { Authorization: `Bearer ${session_token}` }
  });
  return (await r.json()) as { mode: 'auto'|'light'|'dark' };
}

export async function saveTheme(session_token: string, mode: 'auto'|'light'|'dark') {
  const r = await fetch(`${base}/functions/v1/theme-save`, {
    method: 'POST',
    headers: { 'content-type':'application/json', Authorization: `Bearer ${session_token}` },
    body: JSON.stringify({ mode })
  });
  return await r.json();
}
/* <<< DC BLOCK: api-core (end) */
