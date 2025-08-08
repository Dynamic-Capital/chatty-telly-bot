import { useEffect, useState } from 'react';
import TopBar from '../components/TopBar';
import NetworkPicker from '../components/NetworkPicker';
import GlassPanel from '../components/GlassPanel';
import PrimaryButton from '../components/PrimaryButton';
import SecondaryButton from '../components/SecondaryButton';
import { useApi } from '../hooks/useApi';
import { useTelegramMainButton } from '../hooks/useTelegram';

export default function Crypto() {
  const api = useApi();
  const [network, setNetwork] = useState('TRON');
  const [address, setAddress] = useState('');
  const [txid, setTxid] = useState('');

  useEffect(() => {
    api.createIntent({ type: 'crypto', network }).then((r) => setAddress(r.deposit_address));
  }, [network, api]);

  const handleSubmit = async () => {
    if (txid) await api.submitTxid({ txid });
  };

  useTelegramMainButton(!!txid, 'Submit TXID', handleSubmit);

  return (
    <div className="dc-screen">
      <TopBar title="Crypto Deposit" />
      <p className="mb-2 text-sm">Network</p>
      <NetworkPicker
        options={[{ id: 'TRON', label: 'TRON/USDT' }]}
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
              onClick={() => navigator.clipboard.writeText(address)}
            />
          </div>
          <img src="/qr-frame.svg" alt="QR code" className="mx-auto mt-2 w-32 h-32" />
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
    </div>
  );
}
