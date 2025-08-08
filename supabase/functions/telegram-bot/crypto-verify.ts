import { createHmac } from "node:crypto";

export const BINANCE_API_KEY = Deno.env.get("BINANCE_API_KEY") ?? "";
const BINANCE_API_SECRET = Deno.env.get("BINANCE_API_SECRET") ?? "";
const BINANCE_API_URL = Deno.env.get("BINANCE_API_URL") ?? "https://api.binance.com";
const TRON_API_URL = Deno.env.get("TRON_API_URL") ?? "https://api.trongrid.io";
const TRON_API_KEY = Deno.env.get("TRON_API_KEY") ?? "";
export const USDT_TRON_CONTRACT = Deno.env.get("USDT_TRON_CONTRACT") ?? "TXLAQ63Xg1NAzckPwKHvzw7CSEmLMEqcdj";
export const TRC20_CONFIRMATIONS = Number(Deno.env.get("TRC20_CONFIRMATIONS") ?? 20);
const APPROVAL_TIMEOUT_MS = 30_000;

function withTimeout(url: string, options: RequestInit = {}) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), APPROVAL_TIMEOUT_MS);
  const opts = { ...options, signal: controller.signal, headers: { ...(options.headers || {}), ...(TRON_API_KEY ? { "TRON-PRO-API-KEY": TRON_API_KEY } : {}) } };
  return fetch(url, opts).finally(() => clearTimeout(id));
}

export async function verifyTronTx({ txId, toAddress, expectedAmount }: { txId: string; toAddress: string; expectedAmount: number }): Promise<{ ok: boolean; amount: number; confirmations: number; from?: string; reason?: string }> {
  try {
    const txRes = await withTimeout(`${TRON_API_URL}/v1/transactions/${txId}`);
    if (!txRes.ok) return { ok: false, amount: 0, confirmations: 0, reason: `http_${txRes.status}` };
    const txJson = await txRes.json();
    const tx = txJson.data?.[0];
    if (!tx || tx.ret?.[0]?.contractRet !== "SUCCESS") {
      return { ok: false, amount: 0, confirmations: 0, reason: "not_success" };
    }
    const eventsRes = await withTimeout(`${TRON_API_URL}/v1/transactions/${txId}/events`);
    const eventsJson = await eventsRes.json();
    const transfer = eventsJson.data?.find((e: any) => e.event_name === "Transfer" && e.contract_address?.toLowerCase() === USDT_TRON_CONTRACT.toLowerCase());
    if (!transfer) return { ok: false, amount: 0, confirmations: 0, reason: "no_usdt_transfer" };
    const to = transfer.result?.to;
    const from = transfer.result?.from;
    const value = Number(transfer.result?.value ?? 0) / 1_000_000;
    if (!to || to.toLowerCase() !== toAddress.toLowerCase()) {
      return { ok: false, amount: value, confirmations: 0, from, reason: "wrong_recipient" };
    }
    if (value < expectedAmount) {
      return { ok: false, amount: value, confirmations: 0, from, reason: "amount_mismatch" };
    }
    const latestRes = await withTimeout(`${TRON_API_URL}/v1/blocks/latest`);
    const latestJson = await latestRes.json();
    const latestNum = latestJson.data?.[0]?.number ?? 0;
    const blockNum = tx.blockNumber ?? tx.block_number ?? 0;
    const confirmations = latestNum && blockNum ? latestNum - blockNum : 0;
    return { ok: true, amount: value, confirmations, from };
  } catch (err) {
    console.error("tron_verify_error", err);
    return { ok: false, amount: 0, confirmations: 0, reason: "fetch_error" };
  }
}

export async function verifyBinanceDeposit({ txId }: { txId: string }): Promise<{ credited: boolean; amount?: number; completeTime?: string; reason?: string }> {
  try {
    if (!BINANCE_API_KEY || !BINANCE_API_SECRET) {
      return { credited: false, reason: "missing_api_keys" };
    }
    const timestamp = Date.now();
    const query = `coin=USDT&network=TRX&txId=${txId}&timestamp=${timestamp}`;
    const signature = createHmac("sha256", BINANCE_API_SECRET).update(query).digest("hex");
    const url = `${BINANCE_API_URL}/sapi/v1/capital/deposit/hisrec?${query}&signature=${signature}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), APPROVAL_TIMEOUT_MS);
    const res = await fetch(url, { headers: { "X-MBX-APIKEY": BINANCE_API_KEY }, signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return { credited: false, reason: `http_${res.status}` };
    const data = await res.json();
    const record = Array.isArray(data) ? data.find((d: any) => d.txId === txId) : undefined;
    if (!record) return { credited: false, reason: "not_found" };
    if (record.status === 1) {
      const completeTime = record.insertTime ? new Date(record.insertTime).toISOString() : undefined;
      return { credited: true, amount: Number(record.amount), completeTime };
    }
    return { credited: false, amount: Number(record.amount), reason: `status_${record.status}` };
  } catch (err) {
    console.error("binance_verify_error", err);
    return { credited: false, reason: "fetch_error" };
  }
}

