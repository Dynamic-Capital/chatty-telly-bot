import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const cache = new Map<string, Response>();
const SECURITY = {
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-content-type-options": "nosniff",
  "permissions-policy": "geolocation=(), microphone=(), camera=()",
  // Telegram WebView needs frame allowed; CSP is relaxed for WebApp JS and your function host
  "content-security-policy":
    "default-src 'self' https://*.telegram.org https://telegram.org; " +
    "script-src 'self' 'unsafe-inline' https://*.telegram.org; " +
    "style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; " +
    "connect-src 'self' https://*.functions.supabase.co https://*.supabase.co; " +
    "frame-ancestors *;",
} as const;

async function file(path: string, type = "text/plain"): Promise<Response> {
  const key = `__${path}`;
  if (cache.has(key)) return cache.get(key)!.clone();
  try {
    const data = await Deno.readFile(
      new URL(`./static/${path}`, import.meta.url),
    );
    const h = new Headers({
      "content-type": type,
      "cache-control": path.endsWith(".html")
        ? "no-cache"
        : "public, max-age=31536000, immutable",
    });
    for (const [k, v] of Object.entries(SECURITY)) h.set(k, v);
    const r = new Response(data, { headers: h });
    cache.set(key, r.clone());
    return r;
  } catch {
    return new Response("Not Found", { status: 404 });
  }
}

async function indexHtml(): Promise<Response> {
  const r = await file("index.html", "text/html; charset=utf-8");
  const h = new Headers(r.headers);
  h.set("x-frame-options", "ALLOWALL"); // Telegram WebView
  for (const [k, v] of Object.entries(SECURITY)) h.set(k, v);
  return new Response(await r.arrayBuffer(), { headers: h, status: r.status });
}

const TYPE = (p: string) =>
  p.endsWith(".js")
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
    : "application/octet-stream";

serve((req) => {
  console.log(
    "miniapp hit",
    new Date().toISOString(),
    new URL(req.url).pathname,
    req.headers.get("user-agent") || "",
  );
  const url = new URL(req.url);
  if (
    url.pathname === "/" || url.pathname === "/miniapp" ||
    url.pathname === "/miniapp/"
  ) {
    return indexHtml();
  }
  if (url.pathname.startsWith("/assets/")) {
    const rel = url.pathname.replace(/^\//, "");
    return file(rel, TYPE(rel));
  }
  return indexHtml();
});
