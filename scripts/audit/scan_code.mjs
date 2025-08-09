import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const SRC_DIRS = ['src', 'supabase/functions'];

function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (/\.(ts|js|mjs|tsx|jsx|json)$/.test(e.name)) out.push(p);
  }
  return out;
}

function read(p){ try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }

const files = SRC_DIRS.flatMap(d => walk(path.join(ROOT, d)));

const cbVals = new Set();     // callback_data values
const cbDefs = new Set();     // where defined (constants)
const fnDirs = new Set();     // edge functions (folder names)
const fnRefs = new Set();     // code references to function names
const tableRefs = new Set();  // db.from('table') table names

// Edge functions present (by directory name)
const FN_ROOT = path.join(ROOT, 'supabase', 'functions');
if (fs.existsSync(FN_ROOT)) {
  for (const e of fs.readdirSync(FN_ROOT, { withFileTypes: true })) {
    if (e.isDirectory()) fnDirs.add(e.name);
  }
}

// Regexes
const reCallbackData = /callback_data\s*:\s*['"]([^'"]+)['"]/g;
const reCBMapValue = /CB\.\w+\s*=\s*['"]([^'"]+)['"]/g; // in case of assignments
const reCBObject = /export\s+const\s+CB\s*=\s*\{([\s\S]*?)\}\s*as\s*const/s;
const reCBPair = /['"]?([A-Z0-9_]+)['"]?\s*:\s*['"]([^'"]+)['"]/g;
const reFromTable = /\.from\(\s*['"]([a-zA-Z0-9_\.]+)['"]\s*\)/g;
const reFuncFetch = /\/functions\/v1\/([a-zA-Z0-9\-_]+)/g;
const reFuncNameStr = /['"`]([a-zA-Z0-9\-_]+)['"`]/g;

for (const f of files) {
  const s = read(f);
  // find callback_data usage
  for (const m of s.matchAll(reCallbackData)) cbVals.add(m[1]);

  // find CB object values
  const obj = s.match(reCBObject)?.[1];
  if (obj) for (const m of obj.matchAll(reCBPair)) { cbVals.add(m[2]); cbDefs.add(m[2]); }
  for (const m of s.matchAll(reCBMapValue)) { cbVals.add(m[1]); cbDefs.add(m[1]); }

  // find table refs
  for (const m of s.matchAll(reFromTable)) tableRefs.add(m[1]);

  // find function refs via fetch URLs
  for (const m of s.matchAll(reFuncFetch)) fnRefs.add(m[1]);
  // also catch explicit string mentions if preceded by functions/v1 var builds
  if (/functions\/v1/.test(s)) {
    for (const m of s.matchAll(reFuncNameStr)) {
      const name = m[1];
      if (fnDirs.has(name)) fnRefs.add(name);
    }
  }
}

// Output
const out = {
  scanned_files: files.length,
  edge_functions: { present: [...fnDirs].sort(), referenced: [...fnRefs].sort() },
  callbacks: { defined: [...cbDefs].sort(), used_anywhere: [...cbVals].sort() },
  tables: { referenced: [...tableRefs].sort() }
};
fs.writeFileSync('.audit/code_scan.json', JSON.stringify(out, null, 2));
