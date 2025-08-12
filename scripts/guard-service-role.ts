const decoder = new TextDecoder();

const allowGlobs = [
  /^supabase\/functions\//,
  /^functions\//
];

const isAllowed = (p: string) => allowGlobs.some((re) => re.test(p));

const bannedSnippets = [
  "SUPABASE_SERVICE_ROLE_KEY"
];

const isBinary = (buf: Uint8Array) => {
  for (let i = 0; i < Math.min(buf.length, 1024); i++) {
    if (buf[i] === 0) return true;
  }
  return false;
};

let bad = false;

async function scan(dir: string) {
  for await (const e of Deno.readDir(dir)) {
    const p = dir === "." ? e.name : `${dir}/${e.name}`;
    if (e.isDirectory) {
      if ([".git","node_modules","dist","build",".next",".turbo",".vercel",".vscode","coverage"].includes(e.name)) continue;
      await scan(p);
      continue;
    }
    if (p === "scripts/guard-service-role.ts") continue;
    if (/(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$/.test(p)) continue;
    if (p.endsWith(".env.example")) continue;
    if (!/\.(t|j)sx?$|\.env|\.yml$|\.jsonc?$/.test(p)) continue;
    const buf = await Deno.readFile(p);
    if (isBinary(buf)) continue;
    const txt = decoder.decode(buf);

    // Hard rule: no literal-looking service-role key (very naive pattern)
    // Matches long base64-like strings; adjust if you get false positives.
    const highEntropy = /[A-Za-z0-9_-]{40,}/g;
    if (txt.match(highEntropy) && txt.includes("supabase")) {
      console.error(`Possible secret material in ${p}. Remove and rotate if real.`);
      bad = true;
    }

    // No direct reference to env name outside allowed server paths
    if (!isAllowed(p) && bannedSnippets.some(s => txt.includes(s))) {
      console.error(`Forbidden reference to SUPABASE_SERVICE_ROLE_KEY in ${p}`);
      bad = true;
    }
  }
}
await scan(".");
if (bad) Deno.exit(1);
