import { useEffect, useState } from "react";
import { createIntent, submitTxid } from "./api";

interface Props {
  onBack: () => void;
}

export default function Crypto({ onBack }: Props) {
  const [network, setNetwork] = useState("TRON");
  const [address, setAddress] = useState("");
  const [txid, setTxid] = useState("");

  useEffect(() => {
    createIntent({ type: "crypto", network }).then((r) =>
      setAddress(r.deposit_address),
    );
  }, [network]);

  async function handleSubmit() {
    if (txid) {
      await submitTxid({ txid });
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(address);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="min-h-screen p-4 space-y-4 bg-background text-foreground">
      <header className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Crypto Deposit</h1>
        <button
          type="button"
          onClick={onBack}
          className="px-3 py-1 rounded-lg border"
        >
          Back
        </button>
      </header>
      <div className="space-y-2">
        <label className="text-sm">Network</label>
        <select
          value={network}
          onChange={(e) => setNetwork(e.target.value)}
          className="w-full p-2 border rounded-lg bg-card"
        >
          <option value="TRON">TRON/USDT</option>
        </select>
      </div>
      {address && (
        <div className="p-4 border border-border rounded-lg bg-card text-center space-y-2">
          <div>Your deposit address</div>
          <p className="break-all font-mono text-sm">{address}</p>
          <button
            type="button"
            onClick={handleCopy}
            className="px-2 py-1 text-xs rounded-lg border"
          >
            Copy address
          </button>
        </div>
      )}
      <div className="space-y-2">
        <input
          type="text"
          placeholder="Paste TXID"
          value={txid}
          onChange={(e) => setTxid(e.target.value)}
          className="w-full p-2 border rounded-lg bg-card"
        />
      </div>
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!txid}
        className="w-full py-3 rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
      >
        Submit TXID
      </button>
    </div>
  );
}

