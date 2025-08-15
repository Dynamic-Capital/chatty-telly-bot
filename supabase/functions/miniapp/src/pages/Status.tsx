import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import TopBar from "../components/TopBar";
import GlassRow from "../components/GlassRow";
import StatusPill from "../components/StatusPill";
import { useApi } from "../hooks/useApi";

interface Receipt {
  id: string;
  amount: number;
  status: string;
  created_at: string;
}

export default function Status() {
  const api = useApi();
  const [search] = useSearchParams();
  const paymentId = search.get("payment_id");
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  useEffect(() => {
    api.getReceipts(5).then((res: any) => {
      const items = Array.isArray(res) ? res : res.items || [];
      const found = items.find((r: Receipt) => r.id === paymentId) || items[0];
      setReceipt(found || null);
    });
  }, [api, paymentId]);

  return (
    <div className="dc-screen">
      <TopBar title="Payment Status" />
      {receipt ? (
        <GlassRow
          left={<span className="text-sm">{receipt.id.slice(0, 6)}…</span>}
          right={<StatusPill status={receipt.status as any} />}
        />
      ) : (
        <p className="p-4 text-sm">No payment information available.</p>
      )}
    </div>
  );
}

