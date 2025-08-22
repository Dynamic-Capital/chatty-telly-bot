import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import TopBar from "../components/TopBar";
import GlassRow from "../components/GlassRow";
import StatusPill, { type Status } from "../components/StatusPill";
import { useApi } from "../hooks/useApi";

interface Receipt {
  id: string;
  amount: number;
  status: Status;
  created_at: string;
}

export default function Status() {
  const api = useApi();
  const [search] = useSearchParams();
  const paymentId = search.get("payment_id");
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  useEffect(() => {
    api.getReceipts(5).then((res: unknown) => {
      const items = Array.isArray(res)
        ? (res as Receipt[])
        : ((res as { items?: Receipt[] }).items ?? []);
      const found = items.find((r) => r.id === paymentId) || items[0];
      setReceipt(found ?? null);
    });
  }, [api, paymentId]);

  return (
    <div className="dc-screen">
      <TopBar title="Payment Status" />
      {receipt ? (
        <GlassRow
          left={
            <div className="flex flex-col">
              <span className="text-sm font-medium">Payment #{receipt.id.slice(0, 8)}</span>
              <span className="text-xs text-dc-text-dim">${receipt.amount} • {new Date(receipt.created_at).toLocaleDateString()}</span>
            </div>
          }
          right={<StatusPill status={receipt.status} />}
        />
      ) : (
        <p className="p-4 text-sm">No payment information available.</p>
      )}
    </div>
  );
}
