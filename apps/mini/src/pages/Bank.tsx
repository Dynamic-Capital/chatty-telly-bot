import { useEffect, useState } from 'react';
import TopBar from '../components/TopBar';
import NetworkPicker from '../components/NetworkPicker';
import GlassPanel from '../components/GlassPanel';
import ReceiptUploader from '../components/ReceiptUploader';
import PrimaryButton from '../components/PrimaryButton';
import { useApi } from '../hooks/useApi';
import { useTelegramMainButton } from '../hooks/useTelegram';

export default function Bank() {
  const api = useApi();
  const [bank, setBank] = useState('');
  const [payCode, setPayCode] = useState('');
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (bank) {
      api.createIntent({ type: 'bank', bank }).then((r) => setPayCode(r.pay_code));
    }
  }, [bank, api]);

  const handleSubmit = async () => {
    if (file) {
      await api.uploadReceipt(file);
    }
  };

  useTelegramMainButton(!!file, 'Submit', handleSubmit);

  return (
    <div className="dc-screen">
      <TopBar title="Bank Deposit" />
      <NetworkPicker
        options={[{ id: 'BML', label: 'BML' }, { id: 'MIB', label: 'MIB' }]}
        value={bank}
        onChange={setBank}
      />
      {payCode && (
        <GlassPanel className="mt-4 text-center">
          <p>Your deposit code</p>
          <p className="font-mono text-lg">{payCode}</p>
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
