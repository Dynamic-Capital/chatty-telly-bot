import { functionUrl, supabaseUrl, anonKey } from '@/lib/edge';

export async function verifyInitData(initData: string): Promise<boolean> {
  const url = functionUrl('verify-initdata');
  if (!url || !initData) return false;
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ initData }) });
    return r.ok;
  } catch { return false; }
}

export async function getVipStatus(telegramId: string): Promise<boolean | null> {
  const url = functionUrl('miniapp-health');
  if (!url || !telegramId) return null;
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ telegram_id: telegramId }) });
    if (!r.ok) return null;
    const j = await r.json();
    return (j?.vip?.is_vip ?? null) as boolean | null;
  } catch { return null; }
}

export async function getPackages(): Promise<any[]> {
  const base = supabaseUrl(); const anon = anonKey();
  if (!base || !anon) return [];
  const url = `${base}/rest/v1/education_packages?select=id,name,price,currency,thumbnail_url,description,is_active&is_active=eq.true&order=created_at.desc&limit=12`;
  const r = await fetch(url, { headers: { apikey: anon, Authorization: `Bearer ${anon}` } });
  if (!r.ok) return [];
  return (await r.json()) as any[];
}
