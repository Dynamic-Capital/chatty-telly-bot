import handler from "./index.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("HEAD requests return security headers", async () => {
  for (const path of ["/", "/miniapp", "/miniapp/", "/miniapp/version"]) {
    const res = await handler(
      new Request(`http://example.com${path}`, { method: "HEAD" }),
    );
    assertEquals(res.status, 200);
    assertEquals(res.headers.get("x-content-type-options"), "nosniff");
    assertEquals(await res.text(), "");
  }
});
