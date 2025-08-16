import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { ok, nf, mna } from "../_shared/http.ts";

const SECURITY = {
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-content-type-options": "nosniff",
  "permissions-policy": "geolocation=(), microphone=(), camera=()",
  "content-security-policy":
    "default-src 'self' https://*.telegram.org https://telegram.org; " +
    "script-src 'self' 'unsafe-inline' https://*.telegram.org; " +
    "style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; " +
    "connect-src 'self' https://*.functions.supabase.co https://*.supabase.co; " +
    "frame-ancestors *;",
};

function withSec(h: Headers) {
  for (const [k, v] of Object.entries(SECURITY)) h.set(k, v);
  return h;
}

async function readStatic(relPath: string, type = "application/octet-stream") {
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
    return new Response(data, { headers: h });
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) {
      return nf("Not Found");
    }
    console.error("readStatic error for %s: %o", relPath, err);
    return new Response("Internal Error", { status: 500 });
  }
}

async function indexHtml() {
  // serve UTF-8 to avoid garbled symbols
  const r = await readStatic("index.html", "text/html; charset=utf-8");
  if (r.status !== 200) {
    if (r.status === 404) {
      console.warn(
        "static index.html missing; run scripts/sync-miniapp-static.mjs to generate it",
      );
    } else {
      console.error("static index.html failed to load (status %d)", r.status);
    }
    // Fallback inline (also UTF-8)
    const html = `<!doctype html><html lang="en"><head>
      <meta charset="utf-8"/>
      <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
      <title>Dynamic Capital VIP • Mini App</title>
      <script src="https://telegram.org/js/telegram-web-app.js"></script>
      </head><body>
      <h1>Dynamic Capital VIP</h1>
      <p>Static <code>index.html</code> not found in bundle — showing fallback.</p>
      </body></html>`;
    const h = withSec(new Headers({ "content-type": "text/html; charset=utf-8" }));
    return new Response(html, { headers: h, status: r.status });
  }
  const h = new Headers(r.headers);
  h.set("x-frame-options", "ALLOWALL"); // Telegram WebView
  return new Response(await r.arrayBuffer(), { headers: h, status: 200 });
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

export async function handler(req: Request) {
  const url = new URL(req.url);
  if (req.method === "GET" && url.pathname.endsWith("/version")) {
    return ok({ name: "miniapp", ts: new Date().toISOString() });
  }
  if (req.method === "HEAD") return new Response(null, { status: 200 });
  if (req.method !== "GET") return mna();

  // Only serve these routes
  if (url.pathname === "/" || url.pathname === "/miniapp" || url.pathname === "/miniapp/") {
    return await indexHtml();
  }
  if (url.pathname.startsWith("/assets/")) {
    const rel = url.pathname.replace(/^\//, "");
    return await readStatic(rel, mime(rel));
  }
  return nf("Not Found");
}

if (import.meta.main) {
  serve(handler);
}

