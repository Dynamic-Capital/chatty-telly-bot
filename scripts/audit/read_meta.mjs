import fs from 'fs';

const url = process.env.A_SUPABASE_URL;
const key = process.env.A_SUPABASE_KEY;
if (!url || !key) {
  fs.writeFileSync('.audit/meta.json', JSON.stringify({ ok:false, error:'Missing A_SUPABASE_URL/A_SUPABASE_KEY' }, null, 2));
  process.exit(0);
}

async function r(path) {
  const u = `${url.replace(/\/$/,'')}/rest/v1/${path}`;
  const res = await fetch(u, { headers: { apikey: key, Authorization: `Bearer ${key}` }});
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status}`);
  return res.json();
}

// pg_meta exposure
let tables=[], indexes=[];
try {
  tables = await r('pg_meta.tables?select=schema,name');
} catch(e) {}
try {
  indexes = await r('pg_meta.indexes?select=schema,table,name,is_unique,is_primary,columns');
} catch(e) {}

const meta = {
  ok: true,
  tables: tables.filter(t => t.schema === 'public').map(t => t.name).sort(),
  indexes: indexes.filter(i => i.schema === 'public').map(i => ({
    table: i.table, name: i.name, is_unique: !!i.is_unique, is_primary: !!i.is_primary, columns: i.columns
  }))
};

fs.writeFileSync('.audit/meta.json', JSON.stringify(meta, null, 2));
