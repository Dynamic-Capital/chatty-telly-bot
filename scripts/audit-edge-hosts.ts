// scripts/audit-edge-hosts.ts
// Scans the repo for Supabase Functions URLs and warns if they don't match your project ref.
// Never fails CI; prints a report and exits 0.

const decoder = new TextDecoder();
const found: Array<{ path: string; url: string; host: string }> = [];
const mismatches: typeof found = [];

function getProjectRefFromEnv(): string | null {
  return Deno.env.get("SUPABASE_PROJECT_ID") ?? null;
}

async function scan(dir: string) {
  for await (const e of Deno.readDir(dir)) {
    if ([".git","node_modules",".next",".vercel",".turbo","dist","build","coverage",".vscode"].includes(e.name)) continue;
    const p = `${dir}/${e.name}`;
    if (e.isDirectory) { await scan(p); continue; }
    if (!/\.(t|j)sx?$|\.jsonc?$|\.md|\.yml$/.test(p)) continue;
    const buf = await Deno.readFile(p).catch(() => null);
    if (!buf) continue;
    const txt = decoder.decode(buf);
    const re = /https:\/\/([a-z0-9-]+)\.functions\.supabase\.co\/[A-Za-z0-9_/-]+/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(txt))) {
      const url = m[0];
      const host = m[1] + ".functions.supabase.co";
      found.push({ path: p, url, host });
    }
  }
}

await scan(".");
const projectRef = getProjectRefFromEnv();
const expectedHost = projectRef ? `${projectRef}.functions.supabase.co` : null;

for (const f of found) {
  if (expectedHost && f.host !== expectedHost) mismatches.push(f);
}

console.log("=== Edge host audit ===");
console.log("Expected host:", expectedHost ?? "(unknown; set SUPABASE_PROJECT_ID for stricter checks)");
console.log("Total Edge URLs found:", found.length);
if (mismatches.length) {
  console.log("MISMATCHES:");
  for (const m of mismatches) console.log("-", m.host, "in", m.path, "→", m.url);
} else {
  console.log("No mismatched Edge hosts detected.");
}

// Never fail CI (add-only audit).
Deno.exit(0);
