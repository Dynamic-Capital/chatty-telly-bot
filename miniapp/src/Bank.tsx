import { useEffect, useState } from "react";
import { createIntent, uploadReceipt } from "./api";

interface Props {
  onBack: () => void;
}

export default function Bank({ onBack }: Props) {
  const [bank, setBank] = useState("");
  const [payCode, setPayCode] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (bank) {
      createIntent({ type: "bank", bank }).then((r) =>
        setPayCode(r.pay_code),
      );
    }
  }, [bank]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(payCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  async function handleSubmit() {
    if (file) {
      await uploadReceipt(file);
    }
  }

  return (
    <div className="min-h-screen p-4 space-y-4 bg-background text-foreground">
      <header className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Bank Deposit</h1>
        <button
          type="button"
          onClick={onBack}
          className="px-3 py-1 rounded-lg border"
        >
          Back
        </button>
      </header>
      <div className="space-y-2">
        <label className="text-sm">Select bank</label>
        <select
          value={bank}
          onChange={(e) => setBank(e.target.value)}
          className="w-full p-2 border rounded-lg bg-card"
        >
          <option value="" disabled>
            Choose bank
          </option>
          <option value="BML">BML</option>
          <option value="MIB">MIB</option>
        </select>
      </div>
      {payCode && (
        <div className="p-4 border border-border rounded-lg bg-card text-center space-y-2">
          <div>Your deposit code</div>
          <div className="flex items-center justify-center gap-2">
            <span className="font-mono text-lg">{payCode}</span>
            <button
              type="button"
              onClick={handleCopy}
              className="px-2 py-1 text-xs rounded-lg border"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <div className="text-sm">Add this in Remarks</div>
        </div>
      )}
      <div className="space-y-2">
        <label className="text-sm">Upload receipt</label>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="w-full text-sm"
        />
      </div>
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!file}
        className="w-full py-3 rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
      >
        Submit for verification
      </button>
    </div>
  );
}

