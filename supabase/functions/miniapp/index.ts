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

async function serveIndex(): Promise<Response> {
  try {
    const data = await Deno.readFile(new URL("./static/index.html", import.meta.url));
    const h = new Headers({
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-cache",
      "x-frame-options": "ALLOWALL",
    });
    for (const [k, v] of Object.entries(SECURITY)) h.set(k, v as string);
    return new Response(data, { headers: h });
  } catch (e) {
    console.error("miniapp index read failed", e);
    return new Response(JSON.stringify({ ok: false, error: "index.html missing" }), {
      status: 404,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
}

serve((req) => {
  const url = new URL(req.url);
  // Keep /version public
  if (req.method === "GET" && url.pathname.endsWith("/version")) {
    return serveStatic(req, { rootDir: ROOT });
  }
  if (req.method === "HEAD") {
    if (url.pathname === "/" || url.pathname === "/miniapp" || url.pathname === "/miniapp/") {
      return new Response(null, { status: 200 });
    }
    return new Response(null, { status: 404 });
  }
  // Delegate GET/static & SPA roots
  if (req.method === "GET") {
    if (url.pathname === "/" || url.pathname === "/miniapp" || url.pathname === "/miniapp/") {
      return serveIndex();
    }
    return serveStatic(req, {
      rootDir: ROOT,
      spaRoots: ["/", "/miniapp", "/miniapp/index.html"],
    });
  }
  return mna(); // 405 for others
});
