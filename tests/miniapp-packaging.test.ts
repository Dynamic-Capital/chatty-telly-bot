import fs from "node:fs";
import { assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("miniapp packaging bundles index.html", () => {
  const path = "supabase/functions/miniapp/static/index.html";
  assert(fs.existsSync(path), `${path} is missing`);
});
