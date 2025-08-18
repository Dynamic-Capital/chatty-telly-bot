export async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const pathname = url.pathname;
  const method = req.method;

  const makeHeaders = (contentType: string) =>
    new Headers({
      "content-type": contentType,
      "x-content-type-options": "nosniff",
    });

  if (pathname === "/miniapp/version") {
    const headers = makeHeaders("application/json; charset=utf-8");
    const body = JSON.stringify({ name: "miniapp", ts: new Date().toISOString() });
    return new Response(method === "HEAD" ? null : body, { status: 200, headers });
  }

  if (pathname === "/miniapp" || pathname === "/miniapp/") {
    if (method !== "GET" && method !== "HEAD") {
      const headers = makeHeaders("text/plain; charset=utf-8");
      return new Response(null, { status: 405, headers });
    }
    const headers = makeHeaders("text/html; charset=utf-8");
    try {
      const indexUrl = new URL("./static/index.html", import.meta.url);
      const html = await Deno.readTextFile(indexUrl);
      return new Response(method === "HEAD" ? null : html, { status: 200, headers });
    } catch {
      return new Response(method === "HEAD" ? null : "", { status: 200, headers });
    }
  }

  if (pathname.startsWith("/assets/")) {
    try {
      const assetUrl = new URL(`./static${pathname}`, import.meta.url);
      const data = await Deno.readFile(assetUrl);
      const ct = pathname.endsWith(".css")
        ? "text/css; charset=utf-8"
        : "application/octet-stream";
      const headers = makeHeaders(ct);
      return new Response(method === "HEAD" ? null : data, { status: 200, headers });
    } catch {
      const headers = makeHeaders("application/octet-stream");
      return new Response(null, { status: 404, headers });
    }
  }

  if (pathname.startsWith("/miniapp/")) {
    const headers = makeHeaders("text/plain; charset=utf-8");
    return new Response(null, { status: 404, headers });
  }

  const headers = makeHeaders("application/json; charset=utf-8");
  const body = JSON.stringify({ error: "Not Found" });
  return new Response(method === "HEAD" ? null : body, { status: 404, headers });
}

export default handler;
