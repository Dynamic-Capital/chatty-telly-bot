// TRON USDT transaction verifier

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

interface TronIntent {
  expected_amount: number;
  deposit_address?: string;
  min_confirmations?: number;
}

/** Returns { ok, awaiting, reason, details, raw } */
export async function verifyTronTx(txid: string, intent: TronIntent) {
  const API = Deno.env.get("TRON_API_URL")!;
  const USDT = Deno.env.get("TRON_USDT_CONTRACT")!;
  const DEST = (intent.deposit_address ?? Deno.env.get("CRYPTO_TRON_ADDRESS")) as string;
  const MINC = Number(Deno.env.get("TRON_MIN_CONFIRMATIONS") ?? 20);

  const tx = await json(`${API}/v1/transactions/${txid}`);
  const rec = tx?.data?.[0];
  if (!rec) return { ok: false, reason: "tx_not_found", raw: tx };
  if (rec?.ret?.[0]?.contractRet !== "SUCCESS") return { ok: false, reason: "tx_failed", raw: tx };

  const ev = await json(`${API}/v1/contracts/${USDT}/events?only_confirmed=false&limit=100&event_name=Transfer&transaction_id=${txid}`);
  const transfer = ev?.data?.[0];
  if (!transfer) return { ok: false, reason: "no_usdt_transfer", raw: { tx, ev } };

  const to = transfer?.result?.to;
  const from = transfer?.result?.from;
  const raw = BigInt(transfer?.result?.value ?? "0");
  const decimals = 6n;
  const amount = Number(raw) / 10 ** Number(decimals);

  if (to !== DEST) return { ok: false, reason: "wrong_destination", details: { to }, raw: { tx, ev } };

  const exp = Number(intent.expected_amount);
  const amtOk = Math.abs(amount - exp) / exp <= 0.01; // 1% tolerance
  if (!amtOk) return { ok: false, reason: "amount_mismatch", details: { amount, expected: exp }, raw: { tx, ev } };

  const conf = Number(rec.confirmations ?? 0);
  const minConf = intent.min_confirmations ?? MINC;
  if (conf < minConf) {
    return { ok: false, awaiting: true, details: { confirmations: conf }, raw: { tx, ev } };
  }

  return {
    ok: true,
    details: { from, to, amount, confirmations: conf },
    raw: { tx, ev }
  };
}
