/**
 * Generate a Telegram WebApp initData string for testing.
 * Signs with TELEGRAM_BOT_TOKEN from Deno.env (Supabase Edge secret).
 *
 * Examples:
 *   TELEGRAM_BOT_TOKEN=$TELEGRAM_BOT_TOKEN deno run -A scripts/make-initdata.ts
 *   deno run -A scripts/make-initdata.ts --id=225513686 --username=DynamicCapital_Support --first-name="The Wandering Trader"
 *   deno run -A scripts/make-initdata.ts --query-id=QA1 --extra=start_param=ref_abc --json
 */

type User = {
  id: number;
  is_premium?: boolean;
  allows_write_to_pm?: boolean;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
};

function toHex(buf: ArrayBuffer) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
async function keyFromToken(token: string) {
  const enc = new TextEncoder();
  const secret = await crypto.subtle.digest("SHA-256", enc.encode(token));
  return crypto.subtle.importKey(
    "raw",
    secret,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}
function parseArgs() {
  const args = new Map<string, string[]>();
  for (const a of Deno.args) {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    if (m) {
      const k = m[1], v = m[2] ?? "true";
      args.set(k, (args.get(k) ?? []).concat(v));
    }
  }
  const get = (k: string, d?: string) => args.get(k)?.[0] ?? d;
  const all = (k: string) => args.get(k) ?? [];
  const has = (k: string) => args.has(k);
  return { get, all, has };
}
function buildUser(p: ReturnType<typeof parseArgs>): User {
  const id = Number(p.get("id", "225513686"));
  return {
    id,
    username: p.get("username", "prod_audit"),
    first_name: p.get("first-name", "Audit"),
    last_name: p.get("last-name") || "",
    is_premium: p.get("premium", "false") === "true",
    allows_write_to_pm: true,
    language_code: p.get("lang", "en"),
    photo_url: p.get("photo-url") || undefined,
  };
}

async function main() {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!token) {
    console.error(
      "ERROR: TELEGRAM_BOT_TOKEN missing in environment (Supabase Edge secret).",
    );
    Deno.exit(1);
  }
  const args = parseArgs();
  const user = buildUser(args);

  const params = new URLSearchParams();
  const nowSec = Math.floor(Date.now() / 1000);
  const authDate = args.get("auth-date");
  params.set("user", encodeURIComponent(JSON.stringify(user)));
  params.set("auth_date", String(authDate ? Number(authDate) : nowSec));
  params.set("query_id", args.get("query-id", "AUDIT"));

  // Optional extras: --extra key=value (repeatable)
  for (const e of args.all("extra")) {
    const m = e.match(/^([^=]+)=(.*)$/);
    if (m) params.set(m[1], m[2]);
  }

  const dcs = Array.from(params.entries()).map(([k, v]) => `${k}=${v}`).sort()
    .join("\n");
  const key = await keyFromToken(token);
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(dcs),
  );
  params.set("hash", toHex(sig));
  const initData = params.toString();

  if (args.has("json")) {
    const extras = Array.from(params.entries())
      .filter(([k]) => !["user", "auth_date", "query_id", "hash"].includes(k))
      .reduce((o, [k, v]) => (o[k] = v, o), {} as Record<string, string>);
    console.log(
      JSON.stringify(
        {
          user,
          auth_date: Number(params.get("auth_date")),
          query_id: params.get("query_id"),
          extras,
          initData,
        },
        null,
        2,
      ),
    );
  } else {
    console.log(initData);
  }
}

if (import.meta.main) main();
