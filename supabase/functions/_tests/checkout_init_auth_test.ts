import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { handler } from "../checkout-init/index.ts";

Deno.test("checkout-init rejects unauthenticated requests", async () => {
  const req = new Request("http://localhost", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ telegram_id: "1", plan_id: "p1", method: "bank_transfer" }),
  });
  const res = await handler(req);
  assertEquals(res.status, 401);
});
