import { assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { ensureWebhookSecret } from "../_shared/telegram_secret.ts";

Deno.test("keeper: uses DB secret if present", async () => {
  const supa = {
    from: () => ({
      select() {
        return this;
      },
      eq() {
        return this;
      },
      limit() {
        return this;
      },
      maybeSingle() {
        return { data: { setting_value: "db" }, error: null };
      },
      upsert() {
        return { error: null };
      },
    }),
  } as any;
  const secret = await ensureWebhookSecret(supa, "env");
  assert(secret === "db");
});

Deno.test("keeper: falls back to env secret", async () => {
  const supa = {
    from: () => ({
      select() {
        return this;
      },
      eq() {
        return this;
      },
      limit() {
        return this;
      },
      maybeSingle() {
        return { data: null, error: null };
      },
      upsert() {
        return { error: null };
      },
    }),
  } as any;
  const secret = await ensureWebhookSecret(supa, "env");
  assert(secret === "env");
});

Deno.test("keeper: generates if none", async () => {
  const supa = {
    from: () => ({
      select() {
        return this;
      },
      eq() {
        return this;
      },
      limit() {
        return this;
      },
      maybeSingle() {
        return { data: null, error: null };
      },
      upsert() {
        return { error: null };
      },
    }),
  } as any;
  const secret = await ensureWebhookSecret(supa, null);
  assert(typeof secret === "string" && secret.length >= 16);
});
