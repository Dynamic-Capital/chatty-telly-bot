// supabase/functions/miniapp-health/index.ts
// Read-only health endpoint for the Telegram Mini App.
// - GET  → returns env presence & reachability signals (non-fatal).
// - POST → accepts { telegram_id } OR { initData }; verifies initData (if provided),
//          and returns VIP status using Supabase REST (anon key), preferring current_vip view.
//
// Env expected in Supabase Edge Secrets:
//   TELEGRAM_BOT_TOKEN              (presence-only check; not used to send messages here)
//   TELEGRAM_WEBHOOK_SECRET         (presence-only check)
//   MINI_APP_URL                    (reachability HEAD)
//   SUPABASE_URL                    (for REST queries)
//   SUPABASE_ANON_KEY               (for REST queries; read-only)
// Optional:
//   SUPABASE_PROJECT_ID             (informational only)

type Json = Record<string, unknown>;

function has(k: string) {
  return (Deno.env.get(k) ?? "") !== "";
}
function env(k: string) {
  return Deno.env.get(k) ?? "";
}

async function headOk(url?: string): Promise<boolean> {
  if (!url) return false;
  const u = url.endsWith("/") ? url : url + "/";
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 5000);
  try {
    const r = await fetch(u, { method: "HEAD", signal: ctrl.signal });
    return r.ok || (r.status >= 200 && r.status < 400);
  } catch {
    return false;
  } finally {
    clearTimeout(to);
  }
}

async function supabaseQuery(
  path: string,
): Promise<{ ok: boolean; data?: unknown }> {
  const base = env("SUPABASE_URL");
  const anon = env("SUPABASE_ANON_KEY");
  if (!base || !anon) return { ok: false };
  try {
    const r = await fetch(`${base}/rest/v1/${path}`, {
      headers: { apikey: anon, Authorization: `Bearer ${anon}` },
    });
    if (!r.ok) return { ok: false };
    return { ok: true, data: await r.json() };
  } catch {
    return { ok: false };
  }
}

// --- initData verification (server-side) ---
function enc(s: string) {
  return new TextEncoder().encode(s);
}
async function sha256Hex(data: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
async function hmacSHA256Hex(
  keyRaw: Uint8Array,
  body: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    keyRaw,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc(body));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
function buildCheckString(params: URLSearchParams): string {
  const entries = Array.from(params.entries()).filter(([k]) => k !== "hash");
  entries.sort(([a], [b]) => a.localeCompare(b));
  return entries.map(([k, v]) => `${k}=${v}`).join("\n");
}
async function verifyInitDataString(
  initData: string,
): Promise<{ ok: boolean; user?: unknown }> {
  const token = env("TELEGRAM_BOT_TOKEN");
  if (!token) return { ok: false };
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return { ok: false };
  const secretHex = await sha256Hex(enc(token));
  const secretBytes = new Uint8Array(
    secretHex.match(/.{2}/g)!.map((h) => parseInt(h, 16)),
  );
  const calc = await hmacSHA256Hex(secretBytes, buildCheckString(params));
  if (calc !== hash) return { ok: false };
  let user: unknown = undefined;
  try {
    const u = params.get("user");
    user = u ? JSON.parse(u) : undefined;
  } catch {}
  return { ok: true, user };
}

// Derive VIP using current_vip (if present) else fallback to user_subscriptions.
async function getVipStatus(
  telegramId: string,
): Promise<{ source: string; is_vip: boolean | null }> {
  // Try view current_vip first
  const v = await supabaseQuery(
    `current_vip?select=telegram_id,is_vip&telegram_id=eq.${
      encodeURIComponent(telegramId)
    }&limit=1`,
  );
  if (v.ok && Array.isArray(v.data) && v.data.length > 0) {
    const row = (v.data as any[])[0];
    return { source: "current_vip", is_vip: !!row.is_vip };
  }
  // Fallback: compute from latest active subscription (very lightweight)
  const s = await supabaseQuery(
    `user_subscriptions?select=telegram_user_id,subscription_end_date,is_active&telegram_user_id=eq.${
      encodeURIComponent(telegramId)
    }&order=subscription_end_date.desc&limit=1`,
  );
  if (s.ok && Array.isArray(s.data) && s.data.length > 0) {
    const row = (s.data as any[])[0];
    const end = row.subscription_end_date
      ? new Date(row.subscription_end_date)
      : null;
    const isVip = !!row.is_active && !!end && end.getTime() > Date.now();
    return { source: "user_subscriptions", is_vip: isVip };
  }
  return { source: "none", is_vip: null };
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "GET") {
    const miniOk = await headOk(env("MINI_APP_URL"));
    const payload: Json = {
      ok: true,
      service: "miniapp-health",
      env: {
        TELEGRAM_BOT_TOKEN: has("TELEGRAM_BOT_TOKEN"),
        TELEGRAM_WEBHOOK_SECRET: has("TELEGRAM_WEBHOOK_SECRET"),
        MINI_APP_URL: has("MINI_APP_URL"),
        SUPABASE_URL: has("SUPABASE_URL"),
        SUPABASE_ANON_KEY: has("SUPABASE_ANON_KEY"),
        SUPABASE_PROJECT_ID: has("SUPABASE_PROJECT_ID"),
      },
      reachability: {
        MINI_APP_URL_HEAD_OK: miniOk,
      },
    };
    return new Response(JSON.stringify(payload), {
      headers: { "content-type": "application/json" },
    });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let body: any = {};
  try {
    const c = req.headers.get("content-type") ?? "";
    body = c.includes("application/json") ? await req.json() : {};
  } catch {
    body = {};
  }

  const telegramId = typeof body?.telegram_id === "string"
    ? body.telegram_id
    : null;
  const initData = typeof body?.initData === "string" ? body.initData : null;

  // If initData provided, verify first and prefer user.id from it
  let verifiedUserId: string | null = null;
  if (initData) {
    const v = await verifyInitDataString(initData);
    if (!v.ok) {
      return new Response(
        JSON.stringify({ ok: false, error: "invalid_initData" }),
        { status: 401, headers: { "content-type": "application/json" } },
      );
    }
    // Extract id if present
    try {
      const u: any = v.user;
      if (u?.id) verifiedUserId = String(u.id);
    } catch {}
  }
  const id = verifiedUserId ?? telegramId;
  if (!id) {
    return new Response(
      JSON.stringify({ ok: false, error: "missing_telegram_id" }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  }

  // Query VIP status (read-only)
  const vip = await getVipStatus(id);
  return new Response(JSON.stringify({ ok: true, telegram_id: id, vip }), {
    headers: { "content-type": "application/json" },
  });
}
