import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/testing/asserts.ts";
import { default as handler } from "../supabase/functions/miniapp/index.ts";
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
      await Deno.remove("supabase/functions/miniapp/static/assets/app.css");
    } catch {
      // ignore
    }

    const resRoot = await fetch(`${base}/miniapp/`);
    assertEquals(resRoot.status, 200);
    assertEquals(
      resRoot.headers.get("content-type"),
      "text/html; charset=utf-8",
    );
    const bodyRoot = await resRoot.text();
    assert(
      !bodyRoot.includes("Static <code>index.html</code> not found"),
      "should not serve fallback HTML",
    );

    // Supabase's default host rewrites use /functions/v1/miniapp; ensure it also works
    const resRootV1 = await fetch(`${base}/functions/v1/miniapp/`);
    assertEquals(resRootV1.status, 200);
    await resRootV1.arrayBuffer();

    const resVersion = await fetch(`${base}/miniapp/version`);
    assertEquals(resVersion.status, 200);
    const bodyVersion = await resVersion.json();
    assert(typeof bodyVersion === "object" && bodyVersion);

    const resVersionV1 = await fetch(`${base}/functions/v1/miniapp/version`);
    assertEquals(resVersionV1.status, 200);
    await resVersionV1.arrayBuffer();

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

    const resHeadV1 = await fetch(`${base}/functions/v1/miniapp/`, {
      method: "HEAD",
    });
    assertEquals(resHeadV1.status, 200);
    await resHeadV1.arrayBuffer();

    await Deno.writeTextFile(
      "supabase/functions/miniapp/static/assets/app.css",
      "body{}",
    );
    const resCss = await fetch(`${base}/assets/app.css`);
    assertEquals(resCss.status, 200);
    assertEquals(resCss.headers.get("content-type"), "text/css");
    await resCss.arrayBuffer();

    const resNope = await fetch(`${base}/nope`);
    assertEquals(resNope.status, 404);
    await resNope.arrayBuffer();

    const resPost = await fetch(`${base}/miniapp/`, { method: "POST" });
    assertEquals(resPost.status, 405);
    await resPost.arrayBuffer();

    controller.abort();
    try {
      await Deno.remove("supabase/functions/miniapp/static/assets/app.css");
    } catch {
      // ignore
    }
  },
});
