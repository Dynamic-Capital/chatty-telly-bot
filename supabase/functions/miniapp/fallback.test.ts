import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("returns fallback HTML when index.html fails to load", async () => {
  const original = Deno.readFile;
  (Deno as unknown as { readFile: typeof Deno.readFile }).readFile = () => {
    throw new Error("boom");
  };

  try {
    const mod = await import("./index.ts");
    const handler = (mod as {
      handler: (req: Request) => Promise<Response>;
    }).handler;

    const res = await handler(new Request("http://example.com/"));
    assertEquals(res.status, 200);
    const body = await res.text();
    assertStringIncludes(body, "Static `index.html` not found in bundle");
  } finally {
    (Deno as unknown as { readFile: typeof Deno.readFile }).readFile =
      original;
  }
});
