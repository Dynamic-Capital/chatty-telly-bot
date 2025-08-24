import { mna, nf } from "../_shared/http.ts";
import { optionalEnv, requireEnv } from "../_shared/env.ts";
import { contentType } from "https://deno.land/std@0.224.0/media_types/mod.ts";
import { extname } from "https://deno.land/std@0.224.0/path/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Env setup
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = requireEnv([
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
]);
const BUCKET = optionalEnv("MINIAPP_BUCKET") ?? "miniapp";
const INDEX_KEY = optionalEnv("MINIAPP_INDEX_KEY") ?? "index.html";
const ASSETS_PREFIX = optionalEnv("MINIAPP_ASSETS_PREFIX") ?? "assets/";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Basic security headers (same as _shared/static.ts but with frame-ancestors open)
const SECURITY_HEADERS = {
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
    "frame-ancestors 'self' https://*.telegram.org https://telegram.org https://*.supabase.co;",
  "strict-transport-security":
    "max-age=63072000; includeSubDomains; preload",
  "x-frame-options": "ALLOWALL",
} as const;

function withSecurity(resp: Response, extra: Record<string, string> = {}) {
  const h = new Headers(resp.headers);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) h.set(k, v);
  for (const [k, v] of Object.entries(extra)) h.set(k, v);
  return new Response(resp.body, { status: resp.status, headers: h });
}

// simple mime helper
const mime = (p: string) =>
  contentType(extname(p)) ?? "application/octet-stream";

// in-memory cache
type CacheEntry = {
  expires: number;
  body: Uint8Array;
  headers: Record<string, string>;
  status: number;
};
const cache = new Map<string, CacheEntry>();

function fromCache(key: string): Response | null {
  const c = cache.get(key);
  if (!c) return null;
  if (c.expires < Date.now()) {
    cache.delete(key);
    return null;
  }
  return new Response(c.body.slice(), { status: c.status, headers: c.headers });
}

function saveCache(key: string, resp: Response, body: Uint8Array, ttl: number) {
  cache.set(key, {
    expires: Date.now() + ttl,
    body,
    headers: Object.fromEntries(resp.headers),
    status: resp.status,
  });
}

// compression helper for html/json
function maybeCompress(
  body: Uint8Array,
  req: Request,
  type: string,
): { stream: ReadableStream | Uint8Array; encoding?: string } {
  const accept = req.headers.get("accept-encoding")?.toLowerCase() ?? "";

  // Only compress html and json responses
  const compressible =
    type.startsWith("text/html") || type.startsWith("application/json");
  if (!compressible || !accept) return { stream: body };

  const encodings = accept.split(",").map((e) => e.trim().split(";")[0]);

  for (const enc of ["br", "gzip"] as const) {
    if (!encodings.includes(enc)) continue;
    try {
      const stream = new Blob([body]).stream().pipeThrough(
        new CompressionStream(enc),
      );
      return { stream, encoding: enc };
    } catch {
      // unsupported encoding; try next option
    }
  }

  return { stream: body };
}

async function fetchFromStorage(key: string): Promise<Uint8Array | null> {
  const { data, error } = await supabase.storage.from(BUCKET).download(key);
  if (error || !data) return null;
  return new Uint8Array(await data.arrayBuffer());
}

const FALLBACK_HTML =
  "<!doctype html><html><body>Mini App unavailable</body></html>";

export async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  url.pathname = url.pathname.replace(/^\/functions\/v1/, "");
  const path = url.pathname;

  // HEAD routes
  if (req.method === "HEAD") {
    if (path === "/miniapp" || path === "/miniapp/") {
      return withSecurity(new Response(null, { status: 200 }));
    }
    if (path === "/miniapp/version") {
      return withSecurity(new Response(null, { status: 200 }));
    }
    if (path.startsWith("/assets/")) {
      return withSecurity(new Response(null, { status: 200 }));
    }
    return withSecurity(nf());
  }

  if (req.method !== "GET") return withSecurity(mna());

  // GET /miniapp/ → index.html
  if (path === "/miniapp" || path === "/miniapp/") {
    const cached = fromCache("__index");
    if (cached) return withSecurity(cached);

    const arr = await fetchFromStorage(INDEX_KEY);
    if (!arr) {
      console.warn(
        `[miniapp] missing index at ${BUCKET}/${INDEX_KEY}`,
      );
      const resp = new Response(FALLBACK_HTML, {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-cache",
        },
      });
      return withSecurity(resp);
    }

    const type = "text/html; charset=utf-8";
    const { stream, encoding } = maybeCompress(arr, req, type);
    const headers: Record<string, string> = {
      "content-type": type,
      "cache-control": "no-cache",
    };
    if (encoding) headers["content-encoding"] = encoding;
    const resp = new Response(stream, { status: 200, headers });
    saveCache("__index", resp, arr, 60_000);
    return withSecurity(resp);
  }

  // GET /miniapp/version
  if (path === "/miniapp/version") {
    const body = new TextEncoder().encode(
      JSON.stringify({ name: "miniapp", ts: new Date().toISOString() }),
    );
    const type = "application/json; charset=utf-8";
    const { stream, encoding } = maybeCompress(body, req, type);
    const headers: Record<string, string> = { "content-type": type };
    if (encoding) headers["content-encoding"] = encoding;
    const resp = new Response(stream, { status: 200, headers });
    return withSecurity(resp);
  }

  // GET /assets/* → storage
  if (path.startsWith("/assets/")) {
    const key = ASSETS_PREFIX + path.slice("/assets/".length);
    const cached = fromCache(key);
    if (cached) return withSecurity(cached);

    const arr = await fetchFromStorage(key);
    if (!arr) {
      console.warn(`[miniapp] missing asset ${key}`);
      return withSecurity(nf());
    }

    const type = mime(path);
    const headers: Record<string, string> = {
      "content-type": type,
      "cache-control": "public, max-age=31536000, immutable",
    };
    const resp = new Response(arr, { status: 200, headers });
    saveCache(key, resp, arr, 600_000);
    return withSecurity(resp);
  }

  // unknown
  return withSecurity(nf());
}

if (import.meta.main) {
  Deno.serve(handler);
}

export default handler;
