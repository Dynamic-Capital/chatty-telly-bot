import { mna, nf, ok } from "../_shared/http.ts";

const STATIC_CACHE = new Map<string, Response>();

const SECURITY = {
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-content-type-options": "nosniff",
  "permissions-policy": "geolocation=(), microphone=(), camera=()",
  "strict-transport-security": "max-age=63072000; includeSubDomains; preload",
  "content-security-policy":
    "default-src 'self' https://*.telegram.org https://telegram.org; " +
    "script-src 'self' 'unsafe-inline' https://*.telegram.org; " +
    "style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; " +
    "connect-src 'self' https://*.functions.supabase.co https://*.supabase.co; " +
    "frame-ancestors https://web.telegram.org https://*.telegram.org;",
};

function withSec(h: Headers) {
  for (const [k, v] of Object.entries(SECURITY)) h.set(k, v);
  return h;
}

async function readStatic(relPath: string, type = "application/octet-stream") {
  const cached = STATIC_CACHE.get(relPath);
  if (cached) return cached.clone();
  try {
    const url = new URL(`./static/${relPath}`, import.meta.url);
    const data = await Deno.readFile(url);
    const h = withSec(
      new Headers({
        "content-type": type,
        "cache-control": relPath.endsWith(".html")
          ? "no-cache"
          : "public, max-age=31536000, immutable",
      }),
    );
    const r = new Response(data, { headers: h });
    STATIC_CACHE.set(relPath, r);
    return r.clone();
  } catch {
    return nf("Not Found");
  }
}

async function maybeCompress(req: Request, res: Response): Promise<Response> {
  const enc = req.headers.get("accept-encoding") ?? "";
  let encoding: "br" | "gzip" | null = null;
  if (enc.includes("br")) encoding = "br";
  else if (enc.includes("gzip")) encoding = "gzip";
  if (!encoding) return res;

  const ct = res.headers.get("content-type") ?? "";
  if (!ct.startsWith("text/html") && !ct.startsWith("application/json")) {
    return res;
  }

  const data = await res.arrayBuffer();
  if (data.byteLength < 1024) {
    return new Response(data, { status: res.status, headers: res.headers });
  }

  const cs = new CompressionStream(encoding as CompressionFormat);
  const stream = new Response(data).body!.pipeThrough(cs);
  const h = new Headers(res.headers);
  h.set("content-encoding", encoding);
  h.delete("content-length");
  return new Response(stream, { status: res.status, headers: h });
}

async function indexHtml() {
  try {
    const data = await Deno.readFile(
      new URL("./static/index.html", import.meta.url),
    );
    const h = withSec(
      new Headers({
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-cache",
      }),
    );
    h.set("x-frame-options", "ALLOWALL"); // Telegram WebView
    return new Response(data, { headers: h, status: 200 });
  } catch {
    console.warn(
      "miniapp: static/index.html not in bundle (serving fallback)",
    );
    const html = `<!doctype html><html lang="en"><head>
      <meta charset="utf-8"/>
      <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
      <title>Dynamic Capital VIP • Mini App</title>
      <script src="https://telegram.org/js/telegram-web-app.js"></script>
      </head><body>
      <h1>Dynamic Capital VIP</h1>
      <p>Static <code>index.html</code> not found in bundle — showing fallback.</p>
      <p>If the issue persists, use diagnostics below.</p>
      <button onclick="location.href='/miniapp/version'">Check Version</button>
      </body></html>`;
    const h = withSec(
      new Headers({ "content-type": "text/html; charset=utf-8" }),
    );
    return new Response(html, { headers: h, status: 200 });
  }
}

function mime(p: string) {
  if (p.endsWith(".js")) return "text/javascript";
  if (p.endsWith(".css")) return "text/css";
  if (p.endsWith(".svg")) return "image/svg+xml";
  if (p.endsWith(".png")) return "image/png";
  if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "image/jpeg";
  if (p.endsWith(".webp")) return "image/webp";
  return "application/octet-stream";
}

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  if (req.method === "GET" && url.pathname.endsWith("/version")) {
    return await maybeCompress(
      req,
      ok({ name: "miniapp", ts: new Date().toISOString() }),
    );
  }
  if (req.method === "HEAD") {
    if (url.pathname === "/miniapp/" || url.pathname === "/miniapp/version") {
      return new Response(null, {
        status: 200,
        headers: withSec(new Headers()),
      });
    }
    return mna();
  }
  if (req.method !== "GET") return mna();

  // Only serve these routes
  if (
    url.pathname === "/" ||
    url.pathname === "/miniapp" ||
    url.pathname === "/miniapp/"
  ) {
    return await maybeCompress(req, await indexHtml());
  }
  if (url.pathname.startsWith("/assets/")) {
    const rel = url.pathname.replace(/^\//, "");
    return await maybeCompress(req, await readStatic(rel, mime(rel)));
  }
  return nf("Not Found");
}

if (import.meta.main) {
  Deno.serve(handler);
}
