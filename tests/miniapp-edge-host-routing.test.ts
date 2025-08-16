import { assertEquals } from "https://deno.land/std@0.224.0/testing/asserts.ts";
import { handler } from "../supabase/functions/miniapp/index.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

Deno.test({
  name: "miniapp edge host routes",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const controller = new AbortController();
    serve(handler, { signal: controller.signal });
    const base = "http://localhost:8000";

    const resVersion = await fetch(`${base}/miniapp/version`);
    assertEquals(resVersion.status, 200);
    await resVersion.arrayBuffer();

    const resHead = await fetch(`${base}/miniapp/`, { method: "HEAD" });
    assertEquals(resHead.status, 200);
    await resHead.arrayBuffer();

    const resUnknown = await fetch(`${base}/miniapp/unknown`);
    assertEquals(resUnknown.status, 404);
    await resUnknown.arrayBuffer();

    controller.abort();
  },
});
