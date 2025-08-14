export function useApi() {
  const getInitData = () =>
    (globalThis as unknown as { Telegram?: { WebApp?: { initData?: string } } })
      .Telegram?.WebApp?.initData || "";

  const createIntent = async (payload: Record<string, unknown>) => {
    const res = await fetch("/api/intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData: getInitData(), ...payload }),
    });
    return res.json();
  };

  const uploadReceipt = async (file: File) => {
    const form = new FormData();
    form.append("image", file);
    form.append("initData", getInitData());
    const res = await fetch("/api/receipt", {
      method: "POST",
      body: form,
    });
    return res.json();
  };

  const submitTxid = async (payload: { txid: string }) => {
    const res = await fetch("/api/crypto-txid", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData: getInitData(), ...payload }),
    });
    return res.json();
  };

  const getReceipts = async (limit: number) => {
    const initData = encodeURIComponent(getInitData());
    const res = await fetch(`/api/receipts?limit=${limit}&initData=${initData}`);
    return res.json();
  };

  const getPending = async () => {
    const initData = encodeURIComponent(getInitData());
    const res = await fetch(
      `/api/receipts?status=manual_review&initData=${initData}`,
    );
    return res.json();
  };

  const approve = async (id: string) => {
    await fetch(`/api/receipt/${id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData: getInitData() }),
    });
  };

  const reject = async (id: string) => {
    await fetch(`/api/receipt/${id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData: getInitData() }),
    });
  };

  return {
    createIntent,
    uploadReceipt,
    submitTxid,
    getReceipts,
    getPending,
    approve,
    reject,
  };
}
