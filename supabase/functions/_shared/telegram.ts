export type TgUser = { id: number; username?: string; first_name?: string; last_name?: string };

function toHex(buf: ArrayBuffer) {
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}
async function hmacSHA256(key: CryptoKey, data: string) {
  const enc = new TextEncoder();
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return toHex(sig);
}
async function importHmacKeyFromToken(token: string) {
  const enc = new TextEncoder();
  const secretKey = await crypto.subtle.digest("SHA-256", enc.encode(token));
  return crypto.subtle.importKey("raw", secretKey, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}

/** Verifies initData and returns safe user if valid + not stale. */
export async function verifyInitDataAndGetUser(initData: string, windowSec = 900): Promise<TgUser | null> {
  if (!initData) return null;
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!token) throw new Error("Missing TELEGRAM_BOT_TOKEN");
  const key = await importHmacKeyFromToken(token);

  const params = new URLSearchParams(initData);
  const hash = params.get("hash") || "";
  params.delete("hash");
  const dataCheckString = Array.from(params.entries()).map(([k, v]) => `${k}=${v}`).sort().join("\n");
  const sig = await hmacSHA256(key, dataCheckString);
  if (sig !== hash) return null;

  // Optional freshness check
  const auth = Number(params.get("auth_date") || "0");
  const age = Math.floor(Date.now() / 1000) - auth;
  if (windowSec > 0 && (isNaN(auth) || age > windowSec)) return null;

  const userJson = params.get("user");
  if (!userJson) return null;
  try { return JSON.parse(decodeURIComponent(userJson)) as TgUser; } catch { return null; }
}

/** Checks if a Telegram user id is in TELEGRAM_ADMIN_IDS allowlist. */
export function isAdmin(tgId: number | string): boolean {
  const raw = (Deno.env.get("TELEGRAM_ADMIN_IDS") || "").split(",").map(s => s.trim()).filter(Boolean);
  const set = new Set(raw);
  return set.has(String(tgId));
}
