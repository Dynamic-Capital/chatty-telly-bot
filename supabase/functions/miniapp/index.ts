import { mna, nf } from "../_shared/http.ts";
import { optionalEnv, requireEnv } from "../_shared/env.ts";
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
const SERVE_FROM_STORAGE = ["1", "true", "yes"].includes(
  optionalEnv("SERVE_FROM_STORAGE")?.toLowerCase() ?? "",
);

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
} as const;

function withSecurity(resp: Response, extra: Record<string, string> = {}) {
  const h = new Headers(resp.headers);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) h.set(k, v);
  for (const [k, v] of Object.entries(extra)) h.set(k, v);
  return new Response(resp.body, { status: resp.status, headers: h });
}

// MIME type helper
function getMime(path: string): string {
  switch (extname(path).toLowerCase()) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
    case ".mjs":
      return "text/javascript; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".json":
    case ".map":
      return "application/json; charset=utf-8";
    case ".txt":
      return "text/plain; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    case ".avif":
      return "image/avif";
    case ".ico":
      return "image/x-icon";
    case ".ttf":
      return "font/ttf";
    case ".otf":
      return "font/otf";
    case ".woff":
      return "font/woff";
    case ".woff2":
      return "font/woff2";
    case ".wasm":
      return "application/wasm";
    case ".webmanifest":
      return "application/manifest+json";
    default:
      return "application/octet-stream";
  }
}

// read file from bundled static directory
async function readFromBundle(
  relPath: string,
  mime: string,
): Promise<Response | null> {
  try {
    const body = await Deno.readFile("./static/" + relPath);
    return new Response(body, { headers: { "content-type": mime } });
  } catch {
    return null;
  }
}

// stream file from Supabase storage
async function readFromStorage(
  key: string,
  mime: string,
): Promise<Response | null> {
  const { data: bucket } = await supabase.storage.getBucket(BUCKET);
  if (!bucket) return null;
  let url: string;
  if (bucket.public) {
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(key);
    url = data.publicUrl;
  } else {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(
      key,
      60,
    );
    if (error || !data) return null;
    url = data.signedUrl;
  }
  const upstream = await fetch(url);
  if (!upstream.ok) return null;
  const headers = new Headers(upstream.headers);
  headers.set("content-type", mime);
  return new Response(upstream.body, { status: upstream.status, headers });
}

export async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  url.pathname = url.pathname.replace(/^\/functions\/v1/, "");
  const path = url.pathname;

  if (req.method !== "GET" && req.method !== "HEAD") return mna();
  const isHead = req.method === "HEAD";

  // /miniapp or /miniapp/
  if (path === "/miniapp" || path === "/miniapp/") {
    const mime = "text/html; charset=utf-8";
    const resp = SERVE_FROM_STORAGE
      ? await readFromStorage(INDEX_KEY, mime)
      : await readFromBundle(INDEX_KEY, mime);
    if (!resp) {
      return withSecurity(nf("Not Found"), { "x-frame-options": "ALLOWALL" });
    }

    const h = new Headers(resp.headers);
    h.set("cache-control", "no-cache");
    return withSecurity(
      new Response(isHead ? null : resp.body, {
        status: resp.status,
        headers: h,
      }),
      { "x-frame-options": "ALLOWALL" },
    );
  }

  // /miniapp/version
  if (path === "/miniapp/version") {
    const body = JSON.stringify({
      name: "miniapp",
      ts: new Date().toISOString(),
    });
    const headers = { "content-type": "application/json; charset=utf-8" };
    return withSecurity(
      new Response(isHead ? null : body, { status: 200, headers }),
    );
  }

  // /assets/*
  if (path.startsWith("/assets/")) {
    const rel = path.slice("/assets/".length);
    const mime = getMime(path);
    const key = SERVE_FROM_STORAGE ? ASSETS_PREFIX + rel : "assets/" + rel;
    const resp = SERVE_FROM_STORAGE
      ? await readFromStorage(key, mime)
      : await readFromBundle(key, mime);
    if (!resp) return withSecurity(nf("Not Found"));

    const h = new Headers(resp.headers);
    h.set("cache-control", "public, max-age=31536000, immutable");
    return withSecurity(
      new Response(isHead ? null : resp.body, {
        status: resp.status,
        headers: h,
      }),
    );
  }

  return withSecurity(nf("Not Found"));
}

if (import.meta.main) {
  Deno.serve(handler);
}

export default handler;
