export function useApi() {
  const createIntent = async (payload: Record<string, unknown>) => {
    const res = await fetch("/api/intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.json();
  };

  const uploadReceipt = async (file: File) => {
    const form = new FormData();
    form.append("image", file);
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
      body: JSON.stringify(payload),
    });
    return res.json();
  };

  const getReceipts = async (limit: number) => {
    const res = await fetch(`/api/receipts?limit=${limit}`);
    return res.json();
  };

  const getPending = async () => {
    const res = await fetch("/api/receipts?status=manual_review");
    return res.json();
  };

  const approve = async (id: string) => {
    await fetch(`/api/receipt/${id}/approve`, { method: "POST" });
  };

  const reject = async (id: string) => {
    await fetch(`/api/receipt/${id}/reject`, { method: "POST" });
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
