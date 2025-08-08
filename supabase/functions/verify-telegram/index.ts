const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function toHex(buf: ArrayBuffer) {
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

async function hmacSHA256(keyBytes: Uint8Array, data: string) {
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { initData } = await req.json();
    if (!initData) throw new Error("missing initData");

    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!botToken) throw new Error("missing TELEGRAM_BOT_TOKEN");

    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash) throw new Error("missing hash");
    params.delete("hash");

    // 1) secret_key = HMAC_SHA256(key="WebAppData", data=botToken)
    const secret = await hmacSHA256(new TextEncoder().encode("WebAppData"), botToken);

    // 2) data_check_string = sorted key=value lines
    const dataCheckString = [...params.entries()]
      .sort(([a],[b]) => a.localeCompare(b))
      .map(([k,v]) => `${k}=${v}`)
      .join("\n");

    // 3) computed = HMAC_SHA256(key=secret_key, data=data_check_string)
    const computed = toHex(await hmacSHA256(new Uint8Array(secret), dataCheckString));
    if (computed !== hash) throw new Error("invalid hash");

    const user = params.get("user") ? JSON.parse(params.get("user")!) : null;

    return new Response(JSON.stringify({ ok: true, user }), {
      headers: { ...CORS, "content-type": "application/json" },
      status: 200
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e.message || e) }), {
      headers: { ...CORS, "content-type": "application/json" },
      status: 400
    });
  }
});
