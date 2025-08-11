import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getEnv } from "../_shared/env.ts";

function toHex(buf: ArrayBuffer) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
async function hmacSHA256(key: CryptoKey, data: string) {
  const enc = new TextEncoder();
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return toHex(sig);
}
async function importHmacKeyFromToken(token: string) {
  const enc = new TextEncoder();
  const secretKey = await crypto.subtle.digest("SHA-256", enc.encode(token));
  return crypto.subtle.importKey(
    "raw",
    secretKey,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function verifyDetailed(initData: string, windowSec: number) {
  const token = getEnv("TELEGRAM_BOT_TOKEN");
  const key = await importHmacKeyFromToken(token);
  const params = new URLSearchParams(initData);
  const hash = params.get("hash") || "";
  params.delete("hash");
  const pairs = Array.from(params.entries()).map(([k, v]) => `${k}=${v}`).sort();
  const dataCheckString = pairs.join("\n");
  const sig = await hmacSHA256(key, dataCheckString);
  if (sig !== hash) return { ok: false, reason: "bad_signature" } as const;
  const auth = Number(params.get("auth_date") || "0");
  const age = Math.floor(Date.now() / 1000) - auth;
  if (windowSec > 0 && (isNaN(auth) || age > windowSec)) {
    return { ok: false, reason: "stale" } as const;
  }
  return { ok: true } as const;
}

export async function verifyFromRaw(initData: string, windowSec = 900): Promise<boolean> {
  const { ok } = await verifyDetailed(initData, windowSec);
  return ok;
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  let body: { initData?: string };
  try {
    body = await req.json();
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }
  const raw = body.initData || "";
  if (!raw) return new Response("Missing initData", { status: 400 });

  const win = Number(Deno.env.get("WINDOW_SECONDS") ?? "900");
  const ok = await verifyFromRaw(raw, win);
  if (!ok) {
    const res = await verifyDetailed(raw, win);
    return new Response(
      JSON.stringify({ ok: false, reason: res.reason }),
      { status: 401 },
    );
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "content-type": "application/json" },
  });
});
