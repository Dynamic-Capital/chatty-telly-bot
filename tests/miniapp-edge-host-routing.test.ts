import { assertEquals } from "https://deno.land/std@0.224.0/testing/asserts.ts";
import "../supabase/functions/miniapp/index.ts";

Deno.test({
  name: "miniapp edge host routes",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const base = "http://localhost:8000";

    const resRoot = await fetch(`${base}/miniapp/`);
    assertEquals(resRoot.status, 200);
    await resRoot.arrayBuffer();

    const resNotFound = await fetch(`${base}/miniapp/nope`);
    assertEquals(resNotFound.status, 404);
    await resNotFound.arrayBuffer();

    const resPost = await fetch(`${base}/miniapp/`, { method: "POST" });
    assertEquals(resPost.status, 405);
    await resPost.arrayBuffer();
  },
});
