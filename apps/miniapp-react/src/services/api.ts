import { anonKey, functionUrl, supabaseUrl } from "@/lib/edge";

export interface EducationPackage {
  id: string;
  name: string;
  price: number;
  currency: string;
  thumbnail_url?: string;
  description?: string;
  is_active?: boolean;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  currency: string;
  duration_months?: number | null;
  is_lifetime?: boolean;
  features?: string[] | null;
}

export interface BankAccount {
  bank_name: string;
  account_name: string;
  account_number: string;
  currency: string;
  is_active: boolean;
}

export type CheckoutInstructions =
  | { type: 'bank_transfer'; banks: BankAccount[] }
  | { type: 'binance_pay' | 'crypto'; note: string };

export interface CheckoutInitResponse {
  ok: boolean;
  payment_id: string;
  instructions: CheckoutInstructions;
}

export interface SignedUploadUrlResponse {
  ok: boolean;
  bucket: string;
  path: string;
  signed: { url: string; token: string };
}

export async function verifyInitData(initData: string): Promise<boolean> {
  const url = functionUrl("verify-initdata");
  if (!url || !initData) return false;
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ initData }),
    });
    const j = await r.json().catch(() => null);
    return r.ok && j?.ok === true;
  } catch {
    return false;
  }
}

export async function getVipStatus(
  telegramId: string,
): Promise<boolean | null> {
  const url = functionUrl("miniapp-health");
  if (!url || !telegramId) return null;
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ telegram_id: telegramId }),
    });
    if (!r.ok) return null;
    const j = await r.json();
    return (j?.vip?.is_vip ?? null) as boolean | null;
  } catch {
    return null;
  }
}

export async function getPackages(): Promise<EducationPackage[]> {
  const base = supabaseUrl();
  const anon = anonKey();
  if (!base || !anon) return [];
  const url =
    `${base}/rest/v1/education_packages?select=id,name,price,currency,thumbnail_url,description,is_active&is_active=eq.true&order=created_at.desc&limit=12`;
  const r = await fetch(url, {
    headers: { apikey: anon, Authorization: `Bearer ${anon}` },
  });
  if (!r.ok) return [];
  return (await r.json()) as EducationPackage[];
}

export async function listPlans(): Promise<SubscriptionPlan[]> {
  const url = functionUrl('plans');
  if (!url) return [];
  const r = await fetch(url);
  if (!r.ok) return [];
  const j = (await r.json()) as { plans?: SubscriptionPlan[] };
  return j.plans || [];
}

export async function checkoutInit(
  telegram_id: string,
  plan_id: string,
  method: string,
): Promise<CheckoutInitResponse> {
  const url = functionUrl('checkout-init');
  if (!url) throw new Error('no url');
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ telegram_id, plan_id, method }),
  });
  if (!r.ok) throw new Error('checkout failed');
  return r.json() as Promise<CheckoutInitResponse>;
}

export async function requestReceiptUploadUrl(
  telegram_id: string,
  payment_id: string,
  filename: string,
  content_type?: string,
): Promise<SignedUploadUrlResponse> {
  const url = functionUrl('receipt-upload-url');
  if (!url) throw new Error('no url');
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ telegram_id, payment_id, filename, content_type }),
  });
  if (!r.ok) throw new Error('signed url failed');
  return r.json() as Promise<SignedUploadUrlResponse>;
}

export async function submitReceipt(
  telegram_id: string,
  payment_id: string,
  storage_path: string,
) {
  const url = functionUrl('receipt-submit');
  if (!url) throw new Error('no url');
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ telegram_id, payment_id, storage_path }),
  });
  return r.ok;
}


export async function adminCheck(initData: string) {
  const u = functionUrl('admin-check'); if (!u) return { ok:false };
  const r = await fetch(u, { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ initData }) });
  return r.json();
}
export async function adminListPending(initData: string, limit=25, offset=0) {
  const u = functionUrl('admin-list-pending'); if (!u) return { ok:false, items:[] };
  const r = await fetch(u, { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ initData, limit, offset }) });
  return r.json();
}
export async function adminActOnPayment(initData: string, payment_id: string, decision: "approve"|"reject", months?: number, message?: string) {
  const u = functionUrl('admin-act-on-payment'); if (!u) return { ok:false };
  const r = await fetch(u, { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ initData, payment_id, decision, months, message }) });
  return r.json();
}
export async function adminFetchLogs(initData: string, limit=20, offset=0) {
  const u = functionUrl('admin-logs'); if (!u) return { ok:false, items:[] };
  const r = await fetch(u, { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ initData, limit, offset }) });
  return r.json();
}
