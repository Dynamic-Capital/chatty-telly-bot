import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createMockSupabaseClient } from "./mock_supabase.ts";

Deno.test("vip-sync version", async () => {
  void createMockSupabaseClient();
  const { default: handler } = await import("../vip-sync/index.ts");
  const res = await handler(new Request("https://example.com/vip-sync/version"));
  assertEquals(res.status, 200);
  const json = await res.json();
  assertEquals(json.name, "vip-sync");
});

