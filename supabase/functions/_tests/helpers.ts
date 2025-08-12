// tiny harness for Edge-function logic

interface TestEnvGlobal {
  __TEST_ENV__?: Record<string, string>;
}

export function setTestEnv(kv: Record<string, string>) {
  const g = globalThis as TestEnvGlobal;
  g.__TEST_ENV__ = { ...g.__TEST_ENV__, ...kv };
}

export async function makeTelegramInitData(
  user: Record<string, unknown>,
  botToken: string,
  extra: Record<string, string> = {},
) {
  // builds a valid WebApp initData for tests
  const enc = new TextEncoder();
  const secretKey = await crypto.subtle.digest("SHA-256", enc.encode(botToken));
  const key = await crypto.subtle.importKey("raw", secretKey, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const params = new URLSearchParams({
    user: encodeURIComponent(JSON.stringify(user)),
    auth_date: String(Math.floor(Date.now()/1000)),
    query_id: "TEST",
    ...extra
  });
  const dataCheckString = Array.from(params.entries()).map(([k,v])=>`${k}=${v}`).sort().join("\n");
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(dataCheckString));
  const hash = [...new Uint8Array(sig)].map(b=>b.toString(16).padStart(2,"0")).join("");
  params.set("hash", hash);
  return params.toString();
}

export const FakeSupa = () => ({
  from: (_table: string) => ({
    _table,
    _sel: "",
    select(sel: string) { this._sel = sel; return this; },
    eq() { return this; },
    limit() { return this; },
    order() { return this; },
    maybeSingle() { return { data: null, error: null }; },
    range() { return { data: [], error: null }; },
    insert() { return { data: null, error: null }; },
    update() { return { data: null, error: null }; },
    upsert() { return { data: null, error: null }; }
  }),
  storage: { from: () => ({ createSignedUrl: async () => ({ data: { signedUrl: "https://example/signed" }, error: null }) }) }
});
