import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listPlans, type SubscriptionPlan } from '@/services/api';

export default function Plans() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const nav = useNavigate();

  useEffect(() => {
    (async () => {
      const p = await listPlans();
      setPlans(p);
    })();
  }, []);

  return (
    <section className="card space-y-3">
      <h2 className="text-xl font-semibold">Subscription Plans</h2>
      <div className="grid gap-3">
        {plans.map((p) => (
          <div key={p.id} className="border rounded p-3 space-y-1">
            <div className="font-medium">{p.name}</div>
            <div className="text-sm opacity-80">
              {p.price} {p.currency}
            </div>
            <button
              className="btn mt-2 bg-blue-600 text-white hover:bg-blue-700"
              onClick={() => nav(`/checkout?plan=${p.id}`)}
            >
              Select
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
