const tronHeaders = () => {
  const h: Record<string, string> = {};
  const k = Deno.env.get("TRON_API_KEY");
  if (k) h["TRON-PRO-API-KEY"] = k;
  return h;
};

async function json(url: string) {
  const r = await fetch(url, { headers: tronHeaders() });
  if (!r.ok) throw new Error(`TRON API ${r.status}`);
  return r.json();
}

export interface TronVerifyResult {
  ok: boolean;
  awaiting?: boolean;
  reason?: string;
  details?: Record<string, unknown>;
}

interface TronIntent {
  expected_amount: number;
  deposit_address?: string;
  min_confirmations?: number;
  [key: string]: unknown;
}
export async function verifyTronTx(txid: string, intent: TronIntent): Promise<TronVerifyResult> {
  const API = Deno.env.get("TRON_API_URL")!;
  const USDT = Deno.env.get("TRON_USDT_CONTRACT")!;
  const DEST = intent.deposit_address ?? Deno.env.get("CRYPTO_TRON_ADDRESS")!;
  const MINC = Number(Deno.env.get("TRON_MIN_CONFIRMATIONS") ?? 20);

  // 1) tx status
  const tx = await json(`${API}/v1/transactions/${txid}`);
  const rec = tx?.data?.[0];
  if (!rec) return { ok: false, reason: "tx_not_found" };
  if (rec?.ret?.[0]?.contractRet !== "SUCCESS") return { ok: false, reason: "tx_failed" };

  // 2) TRC20 Transfer event for USDT in this tx
  const ev = await json(`${API}/v1/contracts/${USDT}/events?only_confirmed=false&limit=100&event_name=Transfer&transaction_id=${txid}`);
  const transfer = ev?.data?.[0];
  if (!transfer) return { ok: false, reason: "no_usdt_transfer" };

  const to = transfer?.result?.to;
  const from = transfer?.result?.from;
  const raw = BigInt(transfer?.result?.value ?? "0");
  const decimals = 6n;
  const amount = Number(raw) / 10 ** Number(decimals);

  // 3) basic matches
  if (to !== DEST) return { ok: false, reason: "wrong_destination", details: { to } };

  const exp = Number(intent.expected_amount);
  const amtOk = Math.abs(amount - exp) / exp <= 0.01; // 1% tolerance
  if (!amtOk) return { ok: false, reason: "amount_mismatch", details: { amount, expected: exp } };

  // 4) confirmations
  const conf = Number(rec.confirmations ?? 0);
  if (conf < (intent.min_confirmations ?? MINC)) {
    return {
      ok: false,
      awaiting: true,
      details: { from, to, amount, confirmations: conf, rawTx: rec, rawEvent: transfer }
    };
  }

  // 5) all good
  return {
    ok: true,
    details: { from, to, amount, confirmations: conf, rawTx: rec, rawEvent: transfer }
  };
}
