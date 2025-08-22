
import { serveStatic } from "../_shared/static.ts";

const ROOT_DIR = new URL("./static/", import.meta.url);

export async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  
  // For any request to the miniapp, serve our deposit form
  if (req.method === "GET" || req.method === "HEAD") {
    try {
      const indexHtml = await Deno.readTextFile(new URL("./static/index.html", import.meta.url));
      
      const headers = new Headers({
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-cache",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      });
      
      if (req.method === "HEAD") {
        return new Response(null, { headers, status: 200 });
      }
      
      return new Response(indexHtml, { headers, status: 200 });
    } catch (error) {
      console.error("Failed to serve index.html:", error);
      return new Response("Mini app not available", { status: 500 });
    }
  }
  
  // Handle OPTIONS for CORS
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      },
    });
  }
  
  return new Response("Method not allowed", { status: 405 });
}

if (import.meta.main) {
  Deno.serve(handler);
}

export default handler;
