import { useEffect, useState } from 'react';
import { useTelegram } from '@/shared/useTelegram';
import { adminCheck } from '@/services/api';
import { Navigate } from 'react-router-dom';

export default function AdminGate({ children }: { children: React.ReactNode }) {
  const { initData } = useTelegram();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      if (!initData) { setAllowed(false); return; }
      const j = await adminCheck(initData);
      setAllowed(!!j.ok);
    })();
  }, [initData]);

  if (allowed === null) return <div className="card">Checking admin access…</div>;
  if (!allowed) return <Navigate to="/" replace />;
  return <>{children}</>;
}
