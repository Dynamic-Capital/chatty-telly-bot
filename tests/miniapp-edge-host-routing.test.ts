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

    const resRoot = await fetch(`${base}/miniapp/`);
    assertEquals(resRoot.status, 200);
    await resRoot.arrayBuffer();

    const resVersion = await fetch(`${base}/miniapp/version`);
    assertEquals(resVersion.status, 200);
    await resVersion.arrayBuffer();

    const resNotFound = await fetch(`${base}/miniapp/nope`);
    assertEquals(resNotFound.status, 404);
    await resNotFound.arrayBuffer();

    const resPost = await fetch(`${base}/miniapp/`, { method: "POST" });
    assertEquals(resPost.status, 405);
    await resPost.arrayBuffer();

    controller.abort();
  },
});
