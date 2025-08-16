import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
const idx = join(process.cwd(), "supabase", "functions", "miniapp", "static", "index.html");
if (!existsSync(idx)) {
  console.error(JSON.stringify({ ok:false, error:"index.html missing"}));
  process.exit(1);
}
const sz = statSync(idx).size;
if (sz < 128) {
  console.error(JSON.stringify({ ok:false, error:"index.html too small", size: sz }));
  process.exit(2);
}
console.log(JSON.stringify({ ok:true, size: sz }));