import handler from "./index.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("sets Vary header when compressing", async () => {
  const original = Deno.readFile;
  const big = new TextEncoder().encode("a".repeat(2000));
  (Deno as unknown as { readFile: typeof Deno.readFile }).readFile = () =>
    Promise.resolve(big);
  try {
    const req = new Request("http://example.com/miniapp/", {
      headers: { "accept-encoding": "gzip" },
    });
    const res = await handler(req);
    assertEquals(res.headers.get("content-encoding"), "gzip");
    assertEquals(res.headers.get("vary"), "Accept-Encoding");
  } finally {
    (Deno as unknown as { readFile: typeof Deno.readFile }).readFile = original;
  }
});
