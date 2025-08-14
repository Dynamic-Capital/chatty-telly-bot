import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { serveStatic, DEFAULT_SECURITY } from "../_shared/static.ts";
import { mna } from "../_shared/http.ts";

const ROOT = new URL("./static/", import.meta.url);


let INDEX_HTML = "";
try {
  const indexPath = new URL("./static/index.html", import.meta.url);
  console.log(`[miniapp] Attempting to preload index.html from: ${indexPath.pathname}`);
  INDEX_HTML = await Deno.readTextFile(indexPath);
  console.log(`[miniapp] Successfully preloaded index.html, size: ${INDEX_HTML.length}`);
} catch (e) {
  console.error("miniapp index preload failed", e);
  console.error("miniapp static dir:", new URL("./static/", import.meta.url).pathname);
}

function serveIndex(): Response {
  console.log(`[miniapp] serveIndex called - INDEX_HTML available: ${!!INDEX_HTML}`);
  
  if (!INDEX_HTML) {
    console.error(`[miniapp] INDEX_HTML is empty or null`);
    const errorResponse = {
      ok: false, 
      error: "index.html missing",
      debug: {
        indexHtmlLength: INDEX_HTML.length,
        rootDir: ROOT.pathname,
        timestamp: new Date().toISOString()
      }
    };
    console.error(`[miniapp] Returning 404 error:`, errorResponse);
    return new Response(
      JSON.stringify(errorResponse),
      {
        status: 404,
        headers: { "content-type": "application/json; charset=utf-8" },
      },
    );
  }
  
  console.log(`[miniapp] Serving index.html, size: ${INDEX_HTML.length} chars`);
  const h = new Headers({
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-cache",
    "x-frame-options": "ALLOWALL",
  });
  for (const [k, v] of Object.entries(DEFAULT_SECURITY)) h.set(k, v as string);
  console.log(`[miniapp] Response headers set, returning HTML content`);
  return new Response(INDEX_HTML, { headers: h });
}

serve((req) => {
  const url = new URL(req.url);
  console.log(`[miniapp] ${req.method} ${url.pathname}`);
  console.log(`[miniapp] Full URL: ${req.url}`);
  console.log(`[miniapp] ROOT dir: ${ROOT.pathname}`);
  console.log(`[miniapp] INDEX_HTML length: ${INDEX_HTML.length}`);
  
  // Keep /version public
  if (req.method === "GET" && url.pathname.endsWith("/version")) {
    console.log(`[miniapp] Serving version endpoint`);
    return serveStatic(req, { rootDir: ROOT });
  }
  
  if (req.method === "HEAD") {
    console.log(`[miniapp] HEAD request for: ${url.pathname}`);
    if (
      url.pathname === "/" ||
      url.pathname === "/miniapp" ||
      url.pathname === "/miniapp/" ||
      url.pathname === "/miniapp/static" ||
      url.pathname === "/miniapp/static/" ||
      url.pathname === "/miniapp/static/index.html"
    ) {
      console.log(`[miniapp] HEAD allowed for: ${url.pathname}`);
      return new Response(null, { status: 200 });
    }
    console.log(`[miniapp] HEAD not allowed for: ${url.pathname}`);
    return new Response(null, { status: 404 });
  }
  
  // Delegate GET/static & SPA roots
  if (req.method === "GET") {
    console.log(`[miniapp] GET request processing for: ${url.pathname}`);
    
    if (
      url.pathname === "/" ||
      url.pathname === "/miniapp" ||
      url.pathname === "/miniapp/" ||
      url.pathname === "/miniapp/static" ||
      url.pathname === "/miniapp/static/"
    ) {
      console.log(`[miniapp] Serving preloaded index for SPA root: ${url.pathname}`);
      console.log(`[miniapp] INDEX_HTML available: ${!!INDEX_HTML}, length: ${INDEX_HTML.length}`);
      return serveIndex();
    }
    
    console.log(`[miniapp] Delegating to serveStatic for: ${url.pathname}`);
    console.log(`[miniapp] serveStatic options - rootDir: ${ROOT.pathname}, spaRoots: ["/", "/miniapp/static", "/miniapp/static/index.html"]`);
    
    return serveStatic(req, {
      rootDir: ROOT,
      spaRoots: ["/", "/miniapp/static", "/miniapp/static/index.html"],
    });
  }
  
  console.log(`[miniapp] Method not allowed: ${req.method}`);
  return mna(); // 405 for others
});
