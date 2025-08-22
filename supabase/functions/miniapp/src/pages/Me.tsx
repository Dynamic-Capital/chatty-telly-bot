import { useEffect, useState } from "react";
import GlassRow from "../components/GlassRow";
import StatusPill from "../components/StatusPill";
import TopBar from "../components/TopBar";
import { useApi } from "../hooks/useApi";

interface Receipt {
  id: string;
  amount: number;
  status: "AWAITING" | "VERIFIED" | "REJECTED" | "REVIEW";
  created_at: string;
}

export default function Me() {
  const api = useApi();
  const [receipts, setReceipts] = useState<Receipt[]>([]);

  useEffect(() => {
    api.getReceipts(5).then(setReceipts);
  }, [api]);

  return (
    <div className="dc-screen">
      <TopBar title="My Receipts" />
      {receipts.map((r) => (
        <GlassRow
          key={r.id}
          left={
            <div className="flex flex-col">
              <span className="text-sm font-medium">#{r.id.slice(0, 8)}</span>
              <span className="text-xs text-dc-text-dim">{new Date(r.created_at).toLocaleDateString()}</span>
            </div>
          }
          right={
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">${r.amount}</span>
              <StatusPill status={r.status} />
            </div>
          }
        />
      ))}
    </div>
  );
}
