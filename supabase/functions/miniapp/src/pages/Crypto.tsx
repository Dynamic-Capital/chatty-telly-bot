import { useEffect, useState } from "react";
import TopBar from "../components/TopBar";
import NetworkPicker from "../components/NetworkPicker";
import GlassPanel from "../components/GlassPanel";
import PrimaryButton from "../components/PrimaryButton";
import SecondaryButton from "../components/SecondaryButton";
import Toast from "../components/Toast";
import { useApi } from "../hooks/useApi";
import { useTelegramMainButton } from "../hooks/useTelegram";

export default function Crypto() {
  const api = useApi();
  const [network, setNetwork] = useState("TRON");
  const [address, setAddress] = useState("");
  const [txid, setTxid] = useState("");
  const [copyFailed, setCopyFailed] = useState(false);

  useEffect(() => {
    api.createIntent({ type: "crypto", network }).then((r) =>
      setAddress(r.deposit_address)
    );
  }, [network, api]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(address);
    } catch {
      setCopyFailed(true);
    }
  };

  const handleSubmit = async () => {
    if (txid) {
      await api.submitTxid({ txid });
      globalThis.location.href = "/status";
    }
  };

  useTelegramMainButton(!!txid, "Submit TXID", handleSubmit);

  return (
    <div className="dc-screen">
      <TopBar title="Crypto Deposit" />
      <p className="mb-2 text-sm">Network</p>
      <NetworkPicker
        options={[{ id: "TRON", label: "TRON/USDT" }]}
        value={network}
        onChange={setNetwork}
      />
      {address && (
        <GlassPanel className="mt-4 text-center">
          <p>Your deposit address</p>
          <p className="break-all font-mono text-sm">{address}</p>
          <div className="mt-2">
            <SecondaryButton
              label="Copy address"
              onClick={handleCopy}
            />
          </div>
          <img
            src="/img/qr-frame.svg"
            alt="QR code"
            className="mx-auto mt-2 w-32 h-32"
          />
        </GlassPanel>
      )}
      <div className="mt-4">
        <input
          type="text"
          placeholder="Paste TXID"
          value={txid}
          onChange={(e) => setTxid(e.target.value)}
          className="dc-input"
          aria-label="Paste TXID"
        />
      </div>
      <PrimaryButton
        label="Submit TXID"
        onClick={handleSubmit}
        className="fixed bottom-4 left-4 right-4"
        disabled={!txid}
      />
      {copyFailed && (
        <Toast
          message="Failed to copy address"
          type="error"
          onClose={() => setCopyFailed(false)}
        />
      )}
    </div>
  );
}
