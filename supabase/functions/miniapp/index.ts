import { serveStatic } from "../_shared/static.ts";

const ROOT_DIR = new URL("./static/", import.meta.url);

export async function handler(req: Request): Promise<Response> {
  return serveStatic(req, {
    rootDir: ROOT_DIR,
    spaRoots: ["/", "/miniapp"],
  });
}

if (import.meta.main) {
  Deno.serve(handler);
}

export default handler;
