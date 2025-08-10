// Verify Telegram WebApp initData according to Telegram spec
// Public Edge Function with CORS

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function hex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

function parseInitData(initData: string): Record<string, string> {
  const obj: Record<string, string> = {};
  // initData is typically URL query-string style (k=v&k=v)
  initData.split("&").forEach((pair) => {
    const [k, v] = pair.split("=", 2);
    if (!k) return;
    obj[decodeURIComponent(k)] = decodeURIComponent(v || "");
  });
  return obj;
}

async function verifyInitData(initData: string) {
  const encoder = new TextEncoder();
  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
  if (!botToken) {
    return { ok: false, error: "BOT_TOKEN_NOT_SET" } as const;
  }

  const params = parseInitData(initData);
  const providedHash = params["hash"];
  if (!providedHash) return { ok: false, error: "MISSING_HASH" } as const;

  // Build data_check_string: sort all keys except 'hash' and join as key=value with \n
  const dataCheckString = Object.keys(params)
    .filter((k) => k !== "hash")
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("\n");

  // secret key = SHA256(bot_token)
  const secretKey = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(botToken),
  );
  const hmacKey = await crypto.subtle.importKey(
    "raw",
    secretKey,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    hmacKey,
    encoder.encode(dataCheckString),
  );
  const signatureHex = hex(signature);

  if (!timingSafeEqual(signatureHex, providedHash)) {
    return { ok: false, error: "HASH_MISMATCH" } as const;
  }

  // Optional freshness check: auth_date within last 24h
  const authDate = Number(params["auth_date"]) || 0;
  if (!authDate || Math.abs(Date.now() / 1000 - authDate) > 60 * 60 * 24) {
    return { ok: false, error: "AUTH_DATE_EXPIRED" } as const;
  }

  // Parse user JSON (if present)
  let user: unknown = null;
  if (params["user"]) {
    try {
      user = JSON.parse(params["user"]);
    } catch {
      // ignore
    }
  }

  return { ok: true, user } as const;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ ok: false, error: "METHOD_NOT_ALLOWED" }),
        {
          status: 405,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

    const { initData } = await req.json().catch(() => ({ initData: "" }));
    if (!initData || typeof initData !== "string") {
      return new Response(
        JSON.stringify({ ok: false, error: "MISSING_INIT_DATA" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

    const result = await verifyInitData(initData);
    const status = result.ok ? 200 : 400;
    return new Response(JSON.stringify(result), {
      status,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    console.error("verify-telegram error", err);
    return new Response(JSON.stringify({ ok: false, error: "SERVER_ERROR" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
