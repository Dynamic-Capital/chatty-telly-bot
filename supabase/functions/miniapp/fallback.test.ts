import handler from "./index.ts";
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
    const res = await handler(new Request("http://example.com/"));
    assertEquals(res.status, 200);
    const body = await res.text();
    assertStringIncludes(
      body,
      "Static <code>index.html</code> not found in bundle",
    );
    assertStringIncludes(body, "/miniapp/version");
    assertStringIncludes(body, "<button");
  } finally {
    (Deno as unknown as { readFile: typeof Deno.readFile }).readFile = original;
  }
});
