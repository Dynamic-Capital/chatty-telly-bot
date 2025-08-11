import { functionUrl } from "../supabase/functions/_shared/edge.ts";

async function call(name: string, payload?: unknown) {
  const url = functionUrl(name);
  if (!url) {
    console.log(`[${name}] cannot derive URL`);
    return;
  }
  const r = await fetch(url, {
    method: payload ? "POST" : "GET",
    headers: { "content-type": "application/json" },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  let txt = await r.text();
  if (txt.length > 800) txt = txt.slice(0, 800) + "…";
  console.log(`[${name}]`, r.status, txt);
}

await call("miniapp-health", { telegram_id: "225513686" });
await call("verify-initdata", { initData: "query_id=…&user=…&hash=…" });
