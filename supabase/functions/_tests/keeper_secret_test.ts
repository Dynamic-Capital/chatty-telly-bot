import { assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { decideSecret } from "../telegram-webhook-keeper/index.ts";

Deno.test("keeper: uses env if present", async () => {
  const secret = await decideSecret({ from: () => ({ select(){return this}, eq(){return this}, limit(){return this}, maybeSingle(){return { data: { setting_value: "db" }, error: null }} }) }, "env");
  assert(secret === "env");
});

Deno.test("keeper: generates if none", async () => {
  const supa = {
    from: () => ({
      select(){return this}, eq(){return this}, limit(){return this}, maybeSingle(){return { data: null, error: null }},
      upsert(){return { error: null }}
    })
  };
  const secret = await decideSecret(supa, null);
  assert(typeof secret === "string" && secret.length >= 16);
});
