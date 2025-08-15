import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

// Load the full mini app HTML from the static bundle on startup
let INDEX_HTML: string | undefined;
try {
  INDEX_HTML = await Deno.readTextFile(
    new URL("./static/index.html", import.meta.url),
  );
} catch (err) {
  console.error("Failed to read mini app HTML:", err);
}

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
    if (!INDEX_HTML) {
      return new Response(
        "Internal Server Error: Unable to load mini app HTML",
        {
          status: 500,
          headers: {
            "content-type": "text/plain; charset=utf-8",
            ...SECURITY_HEADERS,
          },
        },
      );
    }
    return new Response(INDEX_HTML, {
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
    headers: { "content-type": "application/json" },
  });
});
