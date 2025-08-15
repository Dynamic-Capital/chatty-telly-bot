import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { serveStatic } from "../_shared/static.ts";

const ROOT = new URL("./static/", import.meta.url);

console.log(`[miniapp] Starting miniapp server, static root: ${ROOT.pathname}`);

serve((req) => {
  const url = new URL(req.url);
  console.log(`[miniapp] Request: ${req.method} ${url.pathname}`);

  return serveStatic(req, {
    rootDir: ROOT,
    spaRoots: ["/", "/miniapp", "/miniapp/"],
    security: {
      "x-frame-options": "ALLOWALL", // Allow embedding in Telegram
      "content-security-policy": 
        "default-src 'self' https://*.telegram.org https://telegram.org; " +
        "script-src 'self' 'unsafe-inline' https://*.telegram.org; " +
        "style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data: https:; " +
        "connect-src 'self' https://*.functions.supabase.co https://*.supabase.co wss://*.supabase.co; " +
        "font-src 'self' data:; " +
        "frame-ancestors *;",
    },
  });
});
