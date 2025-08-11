// scripts/guard-env-usage.ts
import { walk } from "https://deno.land/std@0.224.0/fs/walk.ts";
const allowed = ["supabase/functions/_shared/env.ts"];
for await (const e of walk("supabase/functions")) {
  if (!e.isFile || !e.path.endsWith(".ts")) continue;
  if (allowed.includes(e.path)) continue;
  const content = await Deno.readTextFile(e.path);
  if (/Deno\.env\.get\(/.test(content)) {
    console.error(`Forbidden direct Deno.env.get() usage in ${e.path}`);
    Deno.exit(1);
  }
}
