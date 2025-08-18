import { extname } from "https://deno.land/std@0.224.0/path/extname.ts";

const securityHeaders = {
  "x-content-type-options": "nosniff",
};

export async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  console.log(`[miniapp] Request: ${req.method} ${url.pathname} - Full URL: ${req.url}`);

  // Version endpoint
  if (url.pathname === "/miniapp/version") {
    const headers = new Headers({
      ...securityHeaders,
      "content-type": "application/json; charset=utf-8",
    });
    if (req.method === "HEAD") return new Response(null, { status: 200, headers });
    return new Response(
      JSON.stringify({ name: "miniapp", ts: new Date().toISOString() }),
      { status: 200, headers },
    );
  }

  // Serve root HTML
  if (url.pathname === "/miniapp/" || url.pathname === "/miniapp") {
    if (req.method !== "GET" && req.method !== "HEAD") {
      return new Response(null, { status: 405, headers: securityHeaders });
    }
    try {
      const fileUrl = new URL("./static/index.html", import.meta.url);
      const body = await Deno.readFile(fileUrl);
      const headers = new Headers({
        ...securityHeaders,
        "content-type": "text/html; charset=utf-8",
      });
      if (req.method === "HEAD") {
        return new Response(null, { status: 200, headers });
      }
      return new Response(body, { status: 200, headers });
    } catch {
      return new Response("Static index.html not found", {
        status: 404,
        headers: securityHeaders,
      });
    }
  }

  // Static assets
  if (url.pathname.startsWith("/assets/")) {
    const rel = url.pathname.slice("/assets/".length);
    const fileUrl = new URL(`./static/assets/${rel}`, import.meta.url);
    try {
      const body = await Deno.readFile(fileUrl);
      const headers = new Headers(securityHeaders);
      const ext = extname(rel);
      const type = ext === ".css"
        ? "text/css; charset=utf-8"
        : ext === ".js"
        ? "text/javascript; charset=utf-8"
        : "application/octet-stream";
      headers.set("content-type", type);
      if (req.method === "HEAD") return new Response(null, { status: 200, headers });
      return new Response(body, { status: 200, headers });
    } catch {
      return new Response(null, { status: 404, headers: securityHeaders });
    }
  }

  if (url.pathname.startsWith("/miniapp")) {
    if (req.method !== "GET" && req.method !== "HEAD") {
      return new Response(null, { status: 405, headers: securityHeaders });
    }
    return new Response(null, { status: 404, headers: securityHeaders });
  }

  return new Response(JSON.stringify({ error: "Not Found" }), {
    status: 404,
    headers: {
      ...securityHeaders,
      "content-type": "application/json; charset=utf-8",
    },
  });
}

export default handler;
