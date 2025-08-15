import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { serveStatic } from "../_shared/static.ts";

serve((req) =>
  serveStatic(req, {
    rootDir: new URL("./static/", import.meta.url),
    spaRoots: ["/", "/miniapp"],
  }),
);
