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

    try {
      await Deno.remove("supabase/functions/miniapp/static/assets/foo.css");
    } catch {}

    const resRoot = await fetch(`${base}/miniapp/`);
    assertEquals(resRoot.status, 200);
    await resRoot.arrayBuffer();

    const resVersion = await fetch(`${base}/miniapp/version`);
    assertEquals(resVersion.status, 200);
    await resVersion.arrayBuffer();

    const resHeadVersion = await fetch(`${base}/miniapp/version`, {
      method: "HEAD",
    });
    assertEquals(resHeadVersion.status, 200);
    assertEquals(
      resHeadVersion.headers.get("x-content-type-options"),
      "nosniff",
    );
    await resHeadVersion.arrayBuffer();

    const resHead = await fetch(`${base}/miniapp/`, { method: "HEAD" });
    assertEquals(resHead.status, 200);
    assertEquals(resHead.headers.get("x-content-type-options"), "nosniff");
    await resHead.arrayBuffer();

    const resFooMissing = await fetch(`${base}/assets/foo.css`);
    assertEquals(resFooMissing.status, 404);
    await resFooMissing.arrayBuffer();

    await Deno.writeTextFile(
      "supabase/functions/miniapp/static/assets/foo.css",
      "body{}",
    );
    const resFooPresent = await fetch(`${base}/assets/foo.css`);
    assertEquals(resFooPresent.status, 200);
    await resFooPresent.arrayBuffer();

    const resFoo = await fetch(`${base}/foo`);
    assertEquals(resFoo.status, 404);
    assertEquals(
      resFoo.headers.get("content-type"),
      "application/json; charset=utf-8",
    );
    const bodyFoo = await resFoo.json();
    assertEquals(bodyFoo.error, "Not Found");

    const resNotFound = await fetch(`${base}/miniapp/nope`);
    assertEquals(resNotFound.status, 404);
    await resNotFound.arrayBuffer();

    const resPost = await fetch(`${base}/miniapp/`, { method: "POST" });
    assertEquals(resPost.status, 405);
    await resPost.arrayBuffer();

    controller.abort();
    try {
      await Deno.remove("supabase/functions/miniapp/static/assets/foo.css");
    } catch {}
  },
});
