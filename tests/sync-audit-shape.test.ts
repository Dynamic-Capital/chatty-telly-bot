import { assertEquals } from "https://deno.land/std@0.224.0/testing/asserts.ts";
import { handler } from "../supabase/functions/sync-audit/index.ts";

Deno.test("sync-audit version shape", async () => {
  const req = new Request("https://example.com/version", { method: "GET" });
  const res = await handler(req);
  assertEquals(res.status, 200);
  const data = await res.json();
  assertEquals(data.name, "sync-audit");
});
