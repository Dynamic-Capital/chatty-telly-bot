import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const INDEX_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8" /><title>Dynamic Capital VIP</title></head><body><h1>Dynamic Capital VIP Miniapp</h1></body></html>`;

const SECURITY_HEADERS = {
  "x-frame-options": "ALLOWALL", // Allow embedding in Telegram
  "content-security-policy":
    "default-src 'self' https://*.telegram.org https://telegram.org; " +
    "script-src 'self' 'unsafe-inline' https://*.telegram.org; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; " +
    "connect-src 'self' https://*.functions.supabase.co https://*.supabase.co wss://*.supabase.co; " +
    "font-src 'self' data:; " +
    "frame-ancestors *;",
};

serve((req) => {
  const url = new URL(req.url);
  if (url.pathname === "/" || url.pathname === "/miniapp" || url.pathname === "/miniapp/") {
    return new Response(INDEX_HTML, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        ...SECURITY_HEADERS,
      },
    });
  }

  return new Response(JSON.stringify({ ok: false, error: "Not Found" }), {
    status: 404,
    headers: { "content-type": "application/json" },
  });
});
