import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("returns 404 when index.html fails to load", async () => {
  const original = Deno.readFile;
  (Deno as unknown as { readFile: typeof Deno.readFile }).readFile = () => {
    throw new Deno.errors.NotFound("boom");
  };

  const { handler } = await import("./index.ts");

  const res = await handler(new Request("http://example.com/"));
  (Deno as unknown as { readFile: typeof Deno.readFile }).readFile = original;
  assertEquals(res.status, 404);
  assert((await res.text()).includes("Static <code>index.html</code> not found"));
});
