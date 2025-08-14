// supabase/functions/_shared/static.ts
import { mna, nf, ok } from "./http.ts";

export type StaticOpts = {
  rootDir: URL; // e.g., new URL("../miniapp/static/", import.meta.url)
  spaRoots?: string[]; // paths that should serve index.html
  security?: Record<string, string>;
  extraFiles?: string[]; // e.g., ["/favicon.svg", "/site.webmanifest"]
};
export const DEFAULT_SECURITY = {
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
} as const;

function mime(p: string) {
  return p.endsWith(".js")
    ? "text/javascript"
    : p.endsWith(".css")
    ? "text/css"
    : p.endsWith(".svg")
    ? "image/svg+xml"
    : p.endsWith(".png")
    ? "image/png"
    : p.endsWith(".jpg") || p.endsWith(".jpeg")
    ? "image/jpeg"
    : p.endsWith(".webp")
    ? "image/webp"
    : p.endsWith(".json")
    ? "application/json"
    : p.endsWith(".ico")
    ? "image/x-icon"
    : p.endsWith(".webmanifest")
    ? "application/manifest+json"
    : "application/octet-stream";
}

async function readFileFrom(rootDir: URL, relPath: string): Promise<Response | null> {
  try {
    const rel = relPath.replace(/^\/+/, "");
    const url = new URL(`./${rel}`, rootDir);
    if (!url.pathname.startsWith(rootDir.pathname)) return null; // prevent path traversal
    
    console.log(`[static] Attempting to read file: ${url.pathname}`);
    const data = await Deno.readFile(url);
    const h = new Headers({
      "content-type": mime(relPath),
      "cache-control": relPath.endsWith(".html")
        ? "no-cache"
        : "public, max-age=31536000, immutable",
    });
    console.log(`[static] Successfully read file: ${url.pathname}, size: ${data.length}`);
    return new Response(data, { headers: h });
  } catch (e) {
    console.error(`[static] Failed to read file: ${relPath}`, e);
    return null;
  }
}

export async function serveStatic(req: Request, opts: StaticOpts): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, ""); // strip trailing slash for routing
  const sec = { ...DEFAULT_SECURITY, ...(opts.security || {}) };

  console.log(`[static] Request: ${req.method} ${url.pathname}`);

  const setSec = (resp: Response) => {
    const h = new Headers(resp.headers);
    for (const [k, v] of Object.entries(sec)) h.set(k, v);
    return new Response(resp.body, { headers: h, status: resp.status });
  };

  const extra = new Set(opts.extraFiles ?? [
    "/favicon.svg",
    "/favicon.ico",
    "/vite.svg",
    "/site.webmanifest",
    "/robots.txt",
  ]);

  // HEAD allowed on roots
  if (req.method === "HEAD") {
    if (path === "" || path === "/" || path === "/miniapp" || path === "/miniapp/") {
      return setSec(new Response(null, { status: 200 }));
    }
    if (extra.has(url.pathname) || url.pathname.startsWith("/assets/")) {
      const f = await readFileFrom(opts.rootDir, url.pathname);
      if (f) {
        const h = new Headers(f.headers);
        return setSec(new Response(null, { headers: h, status: f.status }));
      }
      return setSec(new Response(null, { status: 404 }));
    }
    return setSec(new Response(null, { status: 404 }));
  }

  if (req.method !== "GET") return mna();

  // Allow GET /version
  if (url.pathname.endsWith("/version")) {
    const r = ok({ name: "miniapp", ts: new Date().toISOString() });
    const h = new Headers(r.headers);
    for (const [k, v] of Object.entries(sec)) h.set(k, v);
    return new Response(await r.arrayBuffer(), { headers: h, status: r.status });
  }

  // Serve SPA index for roots
  const spaRoots = opts.spaRoots ?? ["/", "/miniapp"];
  if (spaRoots.includes(url.pathname) || spaRoots.includes(path) || url.pathname === "/miniapp/") {
    console.log(`[static] Serving index.html for SPA root: ${url.pathname}`);
    const idx = await readFileFrom(opts.rootDir, "index.html");
    if (idx) {
      const h = new Headers(idx.headers);
      h.set("x-frame-options", "ALLOWALL"); // Telegram WebView
      for (const [k, v] of Object.entries(sec)) h.set(k, v);
      return new Response(idx.body, { headers: h, status: idx.status });
    }
    console.error(`[static] index.html not found in rootDir: ${opts.rootDir.pathname}`);
    return nf("index.html missing");
  }

  // Serve common root files (optional)
  if (extra.has(url.pathname)) {
    const f = await readFileFrom(opts.rootDir, url.pathname);
    return f ? setSec(f) : nf("Not Found");
  }

  // Serve /assets/*
  if (url.pathname.startsWith("/assets/")) {
    const f = await readFileFrom(opts.rootDir, url.pathname);
    return f ? setSec(f) : nf("Not Found");
  }

  // Unknown path → 404
  console.log(`[static] Path not found: ${url.pathname}`);
  return nf("Not Found");
}