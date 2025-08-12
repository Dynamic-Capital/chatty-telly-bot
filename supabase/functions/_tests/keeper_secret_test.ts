import { assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { decideSecret } from "../telegram-webhook-keeper/index.ts";

Deno.test({
  name: "keeper: uses env if present",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  Deno.env.set("TELEGRAM_WEBHOOK_SECRET", "env");
  const secret = await decideSecret({});
  assert(secret === "env");
  Deno.env.delete("TELEGRAM_WEBHOOK_SECRET");
});

Deno.test({
  name: "keeper: generates if none",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  Deno.env.delete("TELEGRAM_WEBHOOK_SECRET");
  const supa = {
    from: () => ({
      select(){return this}, eq(){return this}, limit(){return this}, maybeSingle(){return { data: null, error: null }},
      upsert(){return { error: null }}
    })
  };
  const secret = await decideSecret(supa);
  assert(typeof secret === "string" && secret.length >= 16);
});
