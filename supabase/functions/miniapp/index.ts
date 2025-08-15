import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { mna, ok, nf } from "../_shared/http.ts";
// Avoid top-level disk reads; use lazy helpers below.
const cache = new Map<string, Response>();

const SECURITY: Record<string, string> = {
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-content-type-options": "nosniff",
  "permissions-policy": "geolocation=(), microphone=(), camera=()",
  "content-security-policy":
    "default-src 'self' https://*.telegram.org https://telegram.org; " +
    "script-src 'self' 'unsafe-inline' https://*.telegram.org; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; " +
    "connect-src 'self' https://*.functions.supabase.co https://*.supabase.co wss://*.supabase.co; " +
    "font-src 'self' data:; " +
    "frame-ancestors *;",
};

async function file(path: string, type = "text/plain") {
  const key = `__${path}`;
  if (cache.has(key)) return cache.get(key)!.clone();
  try {
    const data = await Deno.readFile(new URL(`./static/${path}`, import.meta.url));
    const h = new Headers({
      "content-type": type,
      "cache-control": path.endsWith(".html") ? "no-cache" : "public, max-age=31536000, immutable",
    });
    for (const [k, v] of Object.entries(SECURITY)) h.set(k, v as string);
    const r = new Response(data, { headers: h });
    cache.set(key, r.clone());
    return r;
  } catch (_e) {
    return nf("Not Found");
  }
}

function fallbackHtml(): string {
  return `<!doctype html><html lang="en"><head>
  <meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
  <title>Dynamic Capital VIP • Mini App</title>
  <script src="https://telegram.org/js/telegram-web-app.js"></script>
  <style>body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto;background:#0b1220;color:#f5f5f5}
  .wrap{max-width:760px;margin:0 auto;padding:20px 16px}.card{background:#192230;border-radius:16px;padding:16px}
  .btn{border:0;border-radius:12px;padding:10px 14px;background:#5288c1;color:#fff;cursor:pointer}.muted{color:#708499}</style>
  </head><body><div class="wrap"><div class="card">
  <h1>Dynamic Capital VIP</h1><p class="muted">Static <code>index.html</code> not found in bundle — showing fallback.</p>
  <button class="btn" id="check">Check Backend</button><div id="out" class="muted">No checks yet.</div>
  </div></div><script>
  const base=location.origin, mini=base+"/miniapp/";
  document.getElementById("check").onclick=async()=>{const o=document.getElementById("out");o.textContent="Checking...";
  try{const r=await fetch(mini+"version");const j=await r.json().catch(()=>null);
  o.textContent="/miniapp/version → "+r.status+(j?" "+JSON.stringify(j):"");}catch(e){o.textContent="Error: "+String(e).slice(0,120);}};
  </script></body></html>`;
}

async function indexHtml(): Promise<Response> {
  const r = await file("index.html", "text/html; charset=utf-8");
  if (r.status === 404) {
    const h = new Headers({ "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" });
    for (const [k, v] of Object.entries(SECURITY)) h.set(k, v as string);
    h.set("x-frame-options", "ALLOWALL"); // Telegram WebView
    return new Response(fallbackHtml(), { headers: h, status: 200 });
  }
  const h = new Headers(r.headers);
  for (const [k, v] of Object.entries(SECURITY)) h.set(k, v as string);
  h.set("x-frame-options", "ALLOWALL");
  return new Response(await r.arrayBuffer(), { headers: h, status: r.status });
}

export async function handler(req: Request): Promise<Response> {
  if (req.method === "GET") {
    const url = new URL(req.url);
    if (url.pathname.endsWith("/version")) {
      return ok({ name: "miniapp", ts: new Date().toISOString() });
    }
  }
  if (req.method === "HEAD") return new Response(null, { status: 200 });
  if (req.method !== "GET") return mna();
  const url = new URL(req.url);
  let resp: Response;
  if (url.pathname === "/" || url.pathname === "/miniapp" || url.pathname === "/miniapp/") {
    resp = await indexHtml();
  } else if (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/miniapp/assets/")) {
    const rel = url.pathname.replace(/^\/(miniapp\/)?/, "");
    resp = await file(
      rel,
      rel.endsWith(".js")
        ? "text/javascript"
        : rel.endsWith(".css")
        ? "text/css"
        : rel.endsWith(".svg")
        ? "image/svg+xml"
        : rel.endsWith(".png")
        ? "image/png"
        : rel.endsWith(".jpg") || rel.endsWith(".jpeg")
        ? "image/jpeg"
        : rel.endsWith(".webp")
        ? "image/webp"
        : "application/octet-stream",
    );
  } else {
    resp = nf("Not Found");
  }
  return resp;
}

if (import.meta.main) {
  serve(handler);
}

