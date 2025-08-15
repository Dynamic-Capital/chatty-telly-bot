import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("returns 404 when index.html fails to load", async () => {
  const original = Deno.readTextFile;
  (Deno as unknown as { readTextFile: typeof Deno.readTextFile }).readTextFile =
    () => {
      throw new Error("boom");
    };

  const { handler } = await import("./index.ts");
  (Deno as unknown as { readTextFile: typeof Deno.readTextFile }).readTextFile =
    original;

  const res = await handler(new Request("http://example.com/"));
  assertEquals(res.status, 404);
  assertEquals(await res.text(), "Index file not found");
});
