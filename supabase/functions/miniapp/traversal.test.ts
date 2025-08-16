import handler from "./index.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("blocks .. path traversal", async () => {
  const res = await handler(
    new Request("http://example.com/assets/../secret.txt"),
  );
  assertEquals(res.status, 404);
});

Deno.test("blocks encoded .. path traversal", async () => {
  const res = await handler(
    new Request("http://example.com/assets/..%2Fsecret.txt"),
  );
  assertEquals(res.status, 404);
});

Deno.test("blocks backslash path traversal", async () => {
  const res = await handler(
    new Request("http://example.com/assets/%5Csecret.txt"),
  );
  assertEquals(res.status, 404);
});
