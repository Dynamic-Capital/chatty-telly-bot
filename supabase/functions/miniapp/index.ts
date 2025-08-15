import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

// Path to the mini app's bundled HTML file.
const INDEX_PATH = new URL("./static/index.html", import.meta.url);

/**
 * Load the mini app HTML from disk. If the file cannot be read, a detailed
 * error is logged and rethrown so that the function fails fast on startup.
 */
async function loadIndexHtml(): Promise<string> {
  try {
    return await Deno.readTextFile(INDEX_PATH);
  } catch (err) {
    const envInfo = {
      denoDeployId: Deno.env.get("DENO_DEPLOYMENT_ID"),
      denoRegion: Deno.env.get("DENO_REGION"),
    };
    console.error(
      `Failed to read mini app HTML at ${INDEX_PATH.href}. ` +
        `cwd: ${Deno.cwd()} env: ${JSON.stringify(envInfo)}`,
      err,
    );
    throw err;
  }
}

// Load the HTML on startup to ensure it is packaged with the function.
const INDEX_HTML: string = await loadIndexHtml();

/**
 * Get the mini app HTML, re-reading from disk on each request. If the runtime
 * read fails (e.g. transient I/O error), fall back to the cached startup
 * content.
 */
async function getIndexHtml(): Promise<string> {
  try {
    return await Deno.readTextFile(INDEX_PATH);
  } catch (err) {
    console.error("Failed to re-read mini app HTML; using cached version", err);
    return INDEX_HTML;
  }
}

const SECURITY_HEADERS = {
  // Rely on the Content Security Policy's frame-ancestors directive for
  // controlling embedding rather than the deprecated x-frame-options header.
  "content-security-policy":
    "default-src 'self' https://*.telegram.org https://telegram.org; " +
    "script-src 'self' 'unsafe-inline' https://*.telegram.org; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; " +
    "connect-src 'self' https://*.functions.supabase.co https://*.supabase.co wss://*.supabase.co; " +
    "font-src 'self' data:; " +
    "frame-ancestors *;",
};

serve(async (req) => {
  const url = new URL(req.url);
  if (
    url.pathname === "/" ||
    url.pathname === "/miniapp" ||
    url.pathname === "/miniapp/"
  ) {
    if (req.method !== "GET") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: {
          allow: "GET",
          ...SECURITY_HEADERS,
        },
      });
    }
    const html = await getIndexHtml();
    return new Response(html, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        ...SECURITY_HEADERS,
      },
    });
  }

  if (url.pathname === "/miniapp/version") {
    return new Response(JSON.stringify({ version: "1.0.0" }), {
      status: 200,
      headers: {
        "content-type": "application/json",
        ...SECURITY_HEADERS,
      },
    });
  }

  return new Response(JSON.stringify({ ok: false, error: "Not Found" }), {
    status: 404,
    headers: { "content-type": "application/json", ...SECURITY_HEADERS },
  });
});
