import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("serves 500 page when index.html fails to load", async () => {
  const original = Deno.readFile;
  (Deno as unknown as { readFile: typeof Deno.readFile }).readFile = () => {
    throw new Error("boom");
  };

  const { handler } = await import("./index.ts");
  (Deno as unknown as { readFile: typeof Deno.readFile }).readFile = original;

  const res = await handler(new Request("http://example.com/"));
  assertEquals(res.status, 500);
  const text = await res.text();
  assert(text.includes("Internal Server Error") || text.includes("500"));
});
