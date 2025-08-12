import { useEffect, useState } from 'react';
import { useTelegram } from '@/shared/useTelegram';
import { adminListPending, adminActOnPayment } from '@/services/api';

export default function Payments() {
  const { initData, haptic } = useTelegram();
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const j = await adminListPending(initData || "", 50, 0);
    setItems(j.items || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [initData]);

  async function act(id: string, decision: "approve"|"reject") {
    const j = await adminActOnPayment(initData || "", id, decision);
    if (j?.ok) { haptic('medium'); await load(); }
  }

  if (loading) return <div className="card">Loading queue…</div>;

  return (
    <div className="space-y-3">
      {items.length === 0 && <div className="card">No pending payments.</div>}
      {items.map((p) => (
        <div key={p.id} className="card grid gap-2">
          <div className="text-sm opacity-70">{new Date(p.created_at).toLocaleString()}</div>
          <div className="font-medium">{p.plan} • {p.months ?? "?"} mo</div>
          <div className="text-xs opacity-70">TG: {p.telegram_id ?? "-"}</div>
          {p.receipt_url && <img src={p.receipt_url} alt="receipt" className="rounded-lg w-full max-h-72 object-contain" />}
          <div className="flex gap-2">
            <button onClick={() => act(p.id, "approve")} className="btn bg-emerald-600 text-white">Approve</button>
            <button onClick={() => act(p.id, "reject")}  className="btn bg-rose-600 text-white">Reject</button>
          </div>
        </div>
      ))}
    </div>
  );
}
