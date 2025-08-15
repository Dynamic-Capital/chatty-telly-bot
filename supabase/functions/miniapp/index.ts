import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { serveStatic } from "../_shared/static.ts";

const rootDir = new URL("./static/", import.meta.url);

async function loadIndexHtml() {
  await Deno.readFile(new URL("./index.html", rootDir));
}

const errorPage = new Response("<h1>Internal Server Error</h1>", {
  status: 500,
  headers: { "content-type": "text/html" },
});

let handler: (req: Request) => Response | Promise<Response>;

try {
  await loadIndexHtml();
  handler = (req) =>
    serveStatic(req, {
      rootDir,
      spaRoots: ["/", "/miniapp"],
    });
} catch {
  console.error("[miniapp] failed to load index.html");
  handler = () => errorPage;
}

if (import.meta.main) {
  serve(handler);
}

export { handler };
