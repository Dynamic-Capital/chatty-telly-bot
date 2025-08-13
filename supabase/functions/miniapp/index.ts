import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { serveStatic } from "../_shared/static.ts";
import { mna } from "../_shared/http.ts";

const ROOT = new URL("./static/", import.meta.url);

const SECURITY = {
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

let INDEX_HTML = "";
try {
  INDEX_HTML = await Deno.readTextFile(
    new URL("./static/index.html", import.meta.url),
  );
} catch (e) {
  console.error("miniapp index preload failed", e);
}

function serveIndex(): Response {
  if (!INDEX_HTML) {
    return new Response(
      JSON.stringify({ ok: false, error: "index.html missing" }),
      {
        status: 404,
        headers: { "content-type": "application/json; charset=utf-8" },
      },
    );
  }
  const h = new Headers({
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-cache",
    "x-frame-options": "ALLOWALL",
  });
  for (const [k, v] of Object.entries(SECURITY)) h.set(k, v as string);
  return new Response(INDEX_HTML, { headers: h });
}

serve((req) => {
  const url = new URL(req.url);
  // Keep /version public
  if (req.method === "GET" && url.pathname.endsWith("/version")) {
    return serveStatic(req, { rootDir: ROOT });
  }
  if (req.method === "HEAD") {
    if (
      url.pathname === "/" ||
      url.pathname === "/miniapp" ||
      url.pathname === "/miniapp/" ||
      url.pathname === "/miniapp/static" ||
      url.pathname === "/miniapp/static/" ||
      url.pathname === "/miniapp/static/index.html"
    ) {
      return new Response(null, { status: 200 });
    }
    return new Response(null, { status: 404 });
  }
  // Delegate GET/static & SPA roots
  if (req.method === "GET") {
    if (
      url.pathname === "/" ||
      url.pathname === "/miniapp" ||
      url.pathname === "/miniapp/" ||
      url.pathname === "/miniapp/static" ||
      url.pathname === "/miniapp/static/"
    ) {
      return serveIndex();
    }
    return serveStatic(req, {
      rootDir: ROOT,
      spaRoots: ["/", "/miniapp/static", "/miniapp/static/index.html"],
    });
  }
  return mna(); // 405 for others
});
