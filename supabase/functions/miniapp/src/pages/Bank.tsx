import { useEffect, useState } from "react";
import TopBar from "../components/TopBar";
import NetworkPicker from "../components/NetworkPicker";
import GlassPanel from "../components/GlassPanel";
import ReceiptUploader from "../components/ReceiptUploader";
import PrimaryButton from "../components/PrimaryButton";
import SecondaryButton from "../components/SecondaryButton";
import { useApi } from "../hooks/useApi";
import { useTelegramMainButton } from "../hooks/useTelegram";

export default function Bank() {
  const api = useApi();
  const [bank, setBank] = useState("");
  const [payCode, setPayCode] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (bank) {
      api.createIntent({ type: "bank", bank }).then((r) =>
        setPayCode(r.pay_code)
      );
    }
  }, [bank, api]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(payCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // no-op if clipboard isn't available
    }
  };

  const handleSubmit = async () => {
    if (file) {
      await api.uploadReceipt(file);
      globalThis.location.href = "/status";
    }
  };

  useTelegramMainButton(!!file, "Submit", handleSubmit);

  return (
    <div className="dc-screen">
      <TopBar title="Bank Deposit" />
      <NetworkPicker
        options={[{ id: "BML", label: "BML" }, { id: "MIB", label: "MIB" }]}
        value={bank}
        onChange={setBank}
      />
      {payCode && (
        <GlassPanel className="mt-4 text-center">
          <p>Your deposit code</p>
          <div className="flex items-center justify-center gap-2">
            <span className="font-mono text-lg">{payCode}</span>
            <SecondaryButton
              type="button"
              label={copied ? "Copied!" : "Copy code"}
              aria-label="Copy code"
              onClick={handleCopy}
              className="px-2 py-1 text-xs"
            />
          </div>
          <p className="text-sm">Add this in Remarks</p>
        </GlassPanel>
      )}
      <div className="mt-4">
        <p className="mb-2 text-sm">Upload receipt</p>
        <ReceiptUploader onChange={setFile} />
      </div>
      <PrimaryButton
        label="Submit for verification"
        onClick={handleSubmit}
        className="fixed bottom-4 left-4 right-4"
        disabled={!file}
      />
    </div>
  );
}
