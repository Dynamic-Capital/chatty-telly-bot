// >>> DC BLOCK: tg-verify-core (start)
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { encode as hex } from "https://deno.land/std@0.224.0/encoding/hex.ts";
import { getEnv } from "../_shared/env.ts";
import { expectedSecret } from "../_shared/telegram_secret.ts";
import { ok, bad, oops, mna } from "../_shared/http.ts";

const BOT = getEnv("TELEGRAM_BOT_TOKEN");

function subtle() {
  const s = globalThis.crypto?.subtle;
  if (!s) throw new Error("crypto.subtle not available");
  return s;
}
async function sha256(data: Uint8Array) {
  return new Uint8Array(await subtle().digest("SHA-256", data));
}
function text(s: string) {
  return new TextEncoder().encode(s);
}
function toHex(u8: Uint8Array) {
  return new TextDecoder("utf-8").decode(hex.encode(u8));
}

function parseInitData(initData: string) {
  const p = new URLSearchParams(initData);
  const hash = p.get("hash") || "";
  p.delete("hash");
  const entries = Array.from(p.entries()).sort(([a], [b]) =>
    a.localeCompare(b)
  );
  const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join("\n");
  return { hash, dataCheckString, user: p.get("user") };
}

async function verifyInitData(initData: string) {
  if (!BOT) throw new Error("BOT token missing");
  const { hash, dataCheckString } = parseInitData(initData);
  const secretKey = await sha256(text(BOT)); // secret_key = sha256(bot_token)
  const signature = await sha256(text(dataCheckString));
  const hmacKey = await subtle().importKey(
    "raw",
    secretKey,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = new Uint8Array(
    await subtle().sign("HMAC", hmacKey, text(dataCheckString)),
  );
  const actual = toHex(mac);
  return actual === hash;
}

async function signSession(user_id: number, ttlSeconds = 1800) {
  // Simple HMAC session with webhook secret; replace with JWT if desired
  const payload = JSON.stringify({
    sub: user_id,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  });
  const secret = (await expectedSecret()) || "s";
  return btoa(
    payload + "." + secret.slice(0, 16),
  );
}

serve(async (req) => {
  const url = new URL(req.url);
  if (req.method === "GET" && url.pathname.endsWith("/version")) {
    return ok({ name: "tg-verify-init", ts: new Date().toISOString() });
  }
  if (req.method === "HEAD") return new Response(null, { status: 200 });
  if (req.method !== "POST") return mna();
  try {
    const { initData } = await req.json();
    if (!initData) {
      return bad("initData required");
    }
    const isValid = await verifyInitData(initData);
    if (!isValid) {
      return bad("bad signature");
    }
    const p = new URLSearchParams(initData);
    const user = JSON.parse(p.get("user") || "{}");
    const uid = Number(user?.id || 0);
    if (!uid) {
      return bad("no user id");
    }
    const token = await signSession(uid);
    return ok({
      user_id: uid,
      username: user?.username,
      session_token: token,
    });
  } catch (e) {
    return oops("verify failed", String(e));
  }
});
// <<< DC BLOCK: tg-verify-core (end)
