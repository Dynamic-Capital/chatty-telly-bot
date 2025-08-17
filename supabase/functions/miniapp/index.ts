import { serveStatic } from "../_shared/static.ts";

export function handler(req: Request): Promise<Response> {
  return serveStatic(req, {
    rootDir: new URL("./static/", import.meta.url),
    spaRoots: ["/", "/miniapp"],
    security: {
      "content-security-policy":
        "default-src 'self' https://*.telegram.org https://telegram.org; " +
        "script-src 'self' 'unsafe-inline' https://*.telegram.org; " +
        "style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data: https:; " +
        "connect-src 'self' https://*.functions.supabase.co https://*.supabase.co wss://*.supabase.co; " +
        "font-src 'self' data:; " +
        "frame-ancestors 'self' https://*.t.me https://*.telegram.org https://web.telegram.org https://telegram.org;",
      "strict-transport-security":
        "max-age=63072000; includeSubDomains; preload",
    },
  });
}

export default handler;

if (import.meta.main) {
  Deno.serve(handler);
}
