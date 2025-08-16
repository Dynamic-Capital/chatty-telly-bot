import { cpSync, existsSync, mkdirSync, statSync } from "node:fs";
import { join } from "node:path";

const repoRoot = process.cwd();
const dist = join(repoRoot, "miniapp", "dist");
const edgeStatic = join(repoRoot, "supabase", "functions", "miniapp", "static");

if (!existsSync(dist)) {
  console.error("Miniapp dist not found. Run `pnpm --filter miniapp build` or `npm run build:miniapp` first.");
  process.exit(1);
}
mkdirSync(edgeStatic, { recursive: true });
cpSync(dist, edgeStatic, { recursive: true });

const idx = join(edgeStatic, "index.html");
if (!existsSync(idx) || statSync(idx).size === 0) {
  console.error("index.html missing or empty after sync.");
  process.exit(2);
}
console.log("Synced miniapp dist -> functions/miniapp/static ✓");