import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { serveStatic } from "../_shared/static.ts";
import { mna } from "../_shared/http.ts";

const ROOT = new URL("./static/", import.meta.url);

serve((req) => {
  const url = new URL(req.url);
  // Keep /version public
  if (req.method === "GET" && url.pathname.endsWith("/version")) {
    return serveStatic(req, { rootDir: ROOT });
  }
  // Delegate GET/HEAD/static & SPA roots
  if (req.method === "GET" || req.method === "HEAD") {
    return serveStatic(req, {
      rootDir: ROOT,
      spaRoots: ["/", "/miniapp", "/miniapp/index.html"],
    });
  }
  return mna(); // 405 for others
});
