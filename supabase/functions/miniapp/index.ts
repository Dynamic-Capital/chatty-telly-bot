import { extname } from "https://deno.land/std@0.224.0/path/extname.ts";

const securityHeaders = {
  "x-content-type-options": "nosniff",
};

async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);

  // Supabase edge functions are mounted under `/functions/v1` in production.
  // Strip that prefix and any trailing slashes so routing works the same
  // locally (where the prefix is absent) and in production.
  let pathname = url.pathname.replace(/^\/functions\/v1/, "").replace(
    /\/+$/,
    "",
  );
  if (pathname !== "" && !pathname.startsWith("/")) pathname = `/${pathname}`;

  console.log(
    `[miniapp] Request: ${req.method} ${pathname} - Full URL: ${req.url}`,
  );

  // Version endpoint
  if (pathname === "/miniapp/version") {
    const headers = new Headers({
      ...securityHeaders,
      "content-type": "application/json; charset=utf-8",
    });
    if (req.method === "HEAD") {
      return new Response(null, { status: 200, headers });
    }
    return new Response(
      JSON.stringify({ name: "miniapp", ts: new Date().toISOString() }),
      { status: 200, headers },
    );
  }

  // Serve root HTML - treat the bare function path and `/miniapp` the same
  if (pathname === "" || pathname === "/miniapp") {
    if (req.method !== "GET" && req.method !== "HEAD") {
      return new Response(null, { status: 405, headers: securityHeaders });
    }

    const headers = new Headers(securityHeaders);
    headers.set("content-type", "text/html; charset=utf-8");
    headers.set("cache-control", "no-cache, no-store, must-revalidate");

    try {
      const fileUrl = new URL("./static/index.html", import.meta.url);
      const html = await Deno.readFile(fileUrl);
      if (req.method === "HEAD") {
        return new Response(null, { status: 200, headers });
      }
      return new Response(html, { status: 200, headers });
    } catch (err) {
      console.error("[miniapp] Failed to read index.html", err);
      return new Response("Miniapp index not found", { status: 500, headers });
    }
  }

  // Static assets
  if (pathname.startsWith("/assets/")) {
    const rel = pathname.slice("/assets/".length);
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
      if (req.method === "HEAD") {
        return new Response(null, { status: 200, headers });
      }
      return new Response(body, { status: 200, headers });
    } catch {
      return new Response(null, { status: 404, headers: securityHeaders });
    }
  }

  if (pathname.startsWith("/miniapp")) {
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

// Only start the server when executed directly, so tests can import the handler
// without side effects like binding to a port.
if (import.meta.main) {
  Deno.serve(handler);
}

export default handler;
