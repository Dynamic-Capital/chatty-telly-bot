import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { serveStatic } from "../_shared/static.ts";

const rootDir = new URL("./static/", import.meta.url);

let handler: (req: Request) => Response | Promise<Response>;

try {
  await Deno.readTextFile(new URL("./index.html", rootDir));
  handler = (req) =>
    serveStatic(req, {
      rootDir,
      spaRoots: ["/", "/miniapp"],
    });
} catch {
  console.warn("[miniapp] index.html not found");
  handler = () => new Response("Index file not found", { status: 404 });
}

if (import.meta.main) {
  serve(handler);
}

export { handler };
