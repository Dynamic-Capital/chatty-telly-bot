import { useEffect, useState } from 'react';
import { useTelegram } from '@/shared/useTelegram';
import { adminFetchLogs } from '@/services/api';

export default function Logs() {
  const { initData } = useTelegram();
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => { (async () => {
    const j = await adminFetchLogs(initData || "", 50, 0);
    setItems(j.items || []);
  })(); }, [initData]);

  return (
    <div className="space-y-2">
      {items.map((r, i) => (
        <div key={i} className="card">
          <div className="text-xs opacity-70">{new Date(r.created_at).toLocaleString()}</div>
          <div className="font-medium">{r.action_type}</div>
          <div className="text-sm opacity-80">{r.action_description}</div>
        </div>
      ))}
    </div>
  );
}
