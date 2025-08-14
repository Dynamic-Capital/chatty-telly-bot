import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import CopyableText from '@/shared/CopyableText';
import { useTelegram } from '@/shared/useTelegram';
import {
  checkoutInit,
  requestReceiptUploadUrl,
  submitReceipt,
  type CheckoutInitResponse,
  type BankAccount,
} from '@/services/api';

export default function Checkout() {
  const [search] = useSearchParams();
  const planId = search.get('plan') || '';
  const { user } = useTelegram();
  const [method, setMethod] = useState('bank_transfer');
  const [payment, setPayment] = useState<CheckoutInitResponse | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function start() {
    if (!user?.id || !planId) return;
    const res = await checkoutInit(String(user.id), planId, method);
    setPayment(res);
  }

  async function upload() {
    if (!user?.id || !payment?.payment_id || !file) return;
    const { signed, path } = await requestReceiptUploadUrl(
      String(user.id),
      payment.payment_id,
      file.name,
      file.type,
    );
    const form = new FormData();
    form.append('file', file);
    form.append('token', signed.token);
    await fetch(signed.url, { method: 'POST', body: form });
    const ok = await submitReceipt(
      String(user.id),
      payment.payment_id,
      path,
    );
    setStatus(ok ? 'submitted' : 'failed');
  }

  return (
    <section className="card space-y-4">
      <h2 className="text-xl font-semibold">Checkout</h2>
      {!payment && (
        <div className="space-y-3">
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="border p-2 rounded w-full"
          >
            <option value="bank_transfer">Bank Transfer</option>
            <option value="binance_pay">Binance Pay</option>
            <option value="crypto">Crypto</option>
          </select>
          <button
            className="btn bg-blue-600 text-white hover:bg-blue-700"
            onClick={start}
          >
            Start Checkout
          </button>
        </div>
      )}
      {payment && (
        <div className="space-y-3">
          <div className="text-sm opacity-80 flex items-center gap-2">
            <span>Payment ID:</span>
            <CopyableText text={payment.payment_id} />
          </div>
          {payment.instructions && (
            <div className="space-y-2 text-sm">
              {payment.instructions.type === 'bank_transfer' &&
                (payment.instructions.banks as (BankAccount & { amount?: number | string })[]).map((b) => (
                  <div key={b.account_number} className="space-y-1">
                    <div className="font-medium">{b.bank_name}</div>
                    <div className="flex items-center gap-2">
                      <span>Account Name:</span>
                      <CopyableText text={b.account_name} />
                    </div>
                    <div className="flex items-center gap-2">
                      <span>Account Number:</span>
                      <CopyableText text={b.account_number} />
                    </div>
                    {b.amount !== undefined && (
                      <div className="flex items-center gap-2">
                        <span>Amount:</span>
                        <CopyableText text={String(b.amount)} />
                      </div>
                    )}
                  </div>
                ))}
              {payment.instructions.type !== 'bank_transfer' && (
                <CopyableText text={payment.instructions.note} />
              )}
            </div>
          )}
          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          <button
            className="btn bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
            onClick={upload}
            disabled={!file}
          >
            Upload Receipt
          </button>
          {status && (
            <div className="text-sm opacity-80">Status: {status}</div>
          )}
        </div>
      )}
    </section>
  );
}
