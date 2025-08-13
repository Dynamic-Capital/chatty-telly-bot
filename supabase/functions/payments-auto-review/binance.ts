export async function verifyBinancePayment(
  providerId: string,
  fetchFn: typeof fetch = fetch,
): Promise<boolean> {
  const apiKey = Deno.env.get("BINANCE_API_KEY");
  const secretKey = Deno.env.get("BINANCE_SECRET_KEY");
  if (!apiKey || !secretKey) {
    throw new Error("Missing Binance credentials");
  }
  const payload = { merchantTradeNo: providerId };
  const timestamp = Date.now().toString();
  const nonce = crypto.randomUUID();
  const body = JSON.stringify(payload);
  const message = `${timestamp}\n${nonce}\n${body}\n`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secretKey),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message),
  );
  const signature = btoa(String.fromCharCode(...new Uint8Array(sig)));
  const res = await fetchFn(
    "https://bpay.binanceapi.com/binancepay/openapi/order/query",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "BinancePay-Timestamp": timestamp,
        "BinancePay-Nonce": nonce,
        "BinancePay-Certificate-SN": apiKey,
        "BinancePay-Signature": signature,
      },
      body,
    },
  );
  if (!res.ok) {
    throw new Error(`Binance API error ${res.status}`);
  }
  const json = await res.json().catch(() => ({}));
  const status = json?.data?.status ?? json?.status;
  return status === "PAID";
}
