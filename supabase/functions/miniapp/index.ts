import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { DEFAULT_SECURITY, serveStatic } from "../_shared/static.ts";
import { mna } from "../_shared/http.ts";

const ROOT = new URL("./static/", import.meta.url);

let INDEX_HTML = "";
try {
  INDEX_HTML = await Deno.readTextFile(
    new URL("./static/index.html", import.meta.url),
  );
} catch (_) {
  // ignore and lazily load later
}

async function serveIndex(): Promise<Response> {
  if (!INDEX_HTML) {
    try {
      INDEX_HTML = await Deno.readTextFile(
        new URL("./static/index.html", import.meta.url),
      );
    } catch (_) {
      try {
        const landing = await Deno.readTextFile(
          new URL("./static/landing.html", import.meta.url),
        );
        const h = new Headers({
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-cache",
          "x-frame-options": "ALLOWALL",
        });
        for (const [k, v] of Object.entries(DEFAULT_SECURITY)) {
          h.set(k, v as string);
        }
        return new Response(landing, { headers: h });
      } catch (_) {
        return new Response("Not Found", { status: 404 });
      }
    }
  }

  const h = new Headers({
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-cache",
    "x-frame-options": "ALLOWALL",
  });
  for (const [k, v] of Object.entries(DEFAULT_SECURITY)) h.set(k, v as string);
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
