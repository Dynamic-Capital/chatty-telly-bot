import { serveStatic } from "../_shared/static.ts";

export function handler(req: Request): Promise<Response> {
  return serveStatic(req, {
    rootDir: new URL("./static/", import.meta.url),
    spaRoots: ["/", "/miniapp"],
    security: {
      "x-frame-options": "ALLOWALL",
      "strict-transport-security":
        "max-age=63072000; includeSubDomains; preload",
    },
  });
}

export default handler;

if (import.meta.main) {
  Deno.serve(handler);
}
