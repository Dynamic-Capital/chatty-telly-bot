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

  const token = getEnv("TELEGRAM_BOT_TOKEN");
  const key = await importHmacKeyFromToken(token);

  const params = new URLSearchParams(raw);
  const hash = params.get("hash") || "";
  params.delete("hash");

  const pairs = Array.from(params.entries()).map(([k, v]) => `${k}=${v}`)
    .sort();
  const dataCheckString = pairs.join("\n");
  const sig = await hmacSHA256(key, dataCheckString);

  if (sig !== hash) {
    return new Response(
      JSON.stringify({ ok: false, reason: "bad_signature" }),
      { status: 401 },
    );
  }

  // optional age window
  const win = Number(Deno.env.get("WINDOW_SECONDS") ?? "900"); // 15 min default
  const auth = Number(params.get("auth_date") || "0");
  const age = Math.floor(Date.now() / 1000) - auth;
  if (win > 0 && (isNaN(auth) || age > win)) {
    return new Response(JSON.stringify({ ok: false, reason: "stale" }), {
      status: 401,
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "content-type": "application/json" },
  });
});
