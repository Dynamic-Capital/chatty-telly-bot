import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTelegram } from '@/shared/useTelegram';
import { verifyInitData, getVipStatus, getPackages } from '@/services/api';
import VipBadge from '@/shared/VipBadge';
import PackageCard from '@/shared/PackageCard';

type Pkg = { id: string; name: string; price: number; currency: string; thumbnail_url?: string; description?: string };

export default function Dashboard() {
  const { initData, user, haptic } = useTelegram();
  const nav = useNavigate();
  const [vip, setVip] = useState<null | boolean>(null);
  const [pkgs, setPkgs] = useState<Pkg[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        if (initData) await verifyInitData(initData);
        const v = await getVipStatus(String(user?.id || ''));
        setVip(v);
        const list = await getPackages();
        setPkgs(list);
      } finally {
        setLoading(false);
      }
    })();
  }, [initData, user?.id]);

  return (
    <div className="space-y-4">
      <section className="card">
        <h2 className="text-xl font-semibold mb-1">Membership</h2>
        <VipBadge value={vip} />
        <div className="mt-3 flex gap-3">
          <button
            className="btn bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={() => {
              haptic('medium');
              nav('/plans');
            }}
          >
            Renew / Upgrade
          </button>
          <button className="btn bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100" onClick={() => haptic('light')}>
            Support
          </button>
        </div>
      </section>
      <section className="card">
        <h2 className="text-xl font-semibold mb-3">Education Packages</h2>
        {loading && <div className="opacity-70 text-sm">Loading…</div>}
        {!loading && (!pkgs || pkgs.length === 0) && <div className="opacity-70 text-sm">No packages found.</div>}
        <div className="grid gap-3">
          {pkgs?.map(p => <PackageCard key={p.id} pkg={p} />)}
        </div>
      </section>
    </div>
  );
}
