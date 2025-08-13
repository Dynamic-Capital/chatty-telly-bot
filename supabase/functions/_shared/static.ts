// supabase/functions/_shared/static.ts
import { mna, nf, ok } from "./http.ts";

export type StaticOpts = {
  rootDir: URL; // e.g., new URL("../miniapp/static/", import.meta.url)
  spaRoots?: string[]; // paths that should serve index.html
  security?: Record<string, string>;
  extraFiles?: string[]; // e.g., ["/favicon.svg", "/site.webmanifest"]
};

const DEFAULT_SECURITY = {
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
    const url = new URL(`./${relPath.replace(/^\/+/, "")}`, rootDir);
    const data = await Deno.readFile(url);
    const h = new Headers({
      "content-type": mime(relPath),
      "cache-control": relPath.endsWith(".html")
        ? "no-cache"
        : "public, max-age=31536000, immutable",
    });
    return new Response(data, { headers: h });
  } catch {
    return null;
  }
}

export async function serveStatic(req: Request, opts: StaticOpts): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, ""); // strip trailing slash for routing
  const sec = { ...DEFAULT_SECURITY, ...(opts.security || {}) };

  // HEAD allowed on roots
  if (req.method === "HEAD") {
    const roots = new Set(["", "/miniapp"]);
    if (roots.has(path)) return new Response(null, { status: 200 });
    return new Response(null, { status: 404 });
  }

  if (req.method !== "GET") return mna();

  // Allow GET /version
  if (url.pathname.endsWith("/version")) {
    const r = ok({ name: "miniapp", ts: new Date().toISOString() });
    const h = new Headers(r.headers);
    for (const [k, v] of Object.entries(sec)) h.set(k, v);
    return new Response(await r.arrayBuffer(), { headers: h, status: r.status });
  }

  const setSec = (resp: Response) => {
    const h = new Headers(resp.headers);
    for (const [k, v] of Object.entries(sec)) h.set(k, v);
    return new Response(resp.body, { headers: h, status: resp.status });
  };

  // Serve SPA index for roots
  const spaRoots = opts.spaRoots ?? ["/", "/miniapp"];
  if (spaRoots.includes(url.pathname) || spaRoots.includes(path) || url.pathname === "/miniapp/") {
    const idx = await readFileFrom(opts.rootDir, "index.html");
    if (idx) {
      const h = new Headers(idx.headers);
      h.set("x-frame-options", "ALLOWALL"); // Telegram WebView
      for (const [k, v] of Object.entries(sec)) h.set(k, v);
      return new Response(await idx.arrayBuffer(), { headers: h, status: idx.status });
    }
    return nf("index.html missing");
  }

  // Serve common root files (optional)
  const extra = new Set(opts.extraFiles ?? [
    "/favicon.svg",
    "/favicon.ico",
    "/vite.svg",
    "/site.webmanifest",
    "/robots.txt",
  ]);
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
  return nf("Not Found");
}
