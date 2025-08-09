import fs from 'fs';

const url = process.env.SUPABASE_URL || process.env.A_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.A_SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('Missing SUPABASE_URL and key (SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY).');
  process.exit(0);
}

async function get(path) {
  const u = `${url.replace(/\/$/, '')}/rest/v1/${path}`;
  const r = await fetch(u, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!r.ok) throw new Error(`GET ${path} -> ${r.status}`);
  return r.json();
}

function arr(x){ return Array.isArray(x) ? x : (x ? [x] : []); }
function normCols(cols){ return arr(cols).map(String).map(s => s.replace(/"/g,'').toLowerCase()); }
function idxName(table, cols){ return `idx_${table}_${cols.join('_')}`.toLowerCase().replace(/[^a-z0-9_]/g,'_'); }

function hasCoveringIndex(indexes, table, cols) {
  const want = normCols(cols);
  const list = indexes.filter(i => i.table === table);
  for (const i of list) {
    const ic = normCols(i.columns);
    // treat "covering" as prefix match: index on (fk, ...) covers FK lookups
    if (ic.length >= want.length && want.every((c, k) => ic[k] === c)) return true;
  }
  return false;
}

const fk = await get('pg_meta.foreign_keys?select=schema,table,columns,foreign_table,foreign_columns');
const ix = await get('pg_meta.indexes?select=schema,table,name,columns,is_unique,is_primary');

const publicFK = fk.filter(x => x.schema === 'public');
const publicIX = ix.filter(x => x.schema === 'public').map(x => ({
  table: x.table, name: x.name, columns: x.columns, is_primary: !!x.is_primary, is_unique: !!x.is_unique
}));

const statements = [];
for (const f of publicFK) {
  const table = f.table;
  const cols = normCols(f.columns);
  if (!cols.length) continue;

  // skip if PK-like (already indexed) — crude filter; we rely on hasCoveringIndex anyway
  if (hasCoveringIndex(publicIX, table, cols)) continue;

  const name = idxName(table, cols);
  const colsSQL = cols.map(c => `"${c}"`).join(', ');
  statements.push(`CREATE INDEX CONCURRENTLY IF NOT EXISTS ${name} ON public."${table}" (${colsSQL});`);
}

const outDir = '.audit';
fs.mkdirSync(outDir, { recursive: true });
const out = `${outDir}/generated_fk_indexes.sql`;
fs.writeFileSync(out, (statements.length
  ? `-- Auto-generated FK index recommendations (CONCURRENTLY)\n${statements.join('\n')}\n`
  : '-- No missing FK indexes detected.\n'
));
console.log(`Wrote ${out} (${statements.length} statement(s)).`);

const repoOutDir = 'sql';
try { fs.mkdirSync(repoOutDir, { recursive: true }); } catch {}
const repoOut = `${repoOutDir}/generated_fk_indexes.sql`;
fs.writeFileSync(repoOut, fs.readFileSync(out));
console.log(`Copied to ${repoOut}.`);
