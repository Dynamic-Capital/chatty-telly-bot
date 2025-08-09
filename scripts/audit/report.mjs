import fs from 'fs';

function j(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

const code = j('.audit/code_scan.json') ||
  {
    edge_functions: { present: [], referenced: [] },
    callbacks: { defined: [], used_anywhere: [] },
    tables: { referenced: [] },
  };
const meta = j('.audit/meta.json') || { ok: false, tables: [], indexes: [] };

const presentFns = new Set(code.edge_functions.present);
const refFns = new Set(code.edge_functions.referenced);
const unusedFns = [...presentFns].filter((x) => !refFns.has(x)).sort();

const cbDefined = new Set(code.callbacks.defined);
const cbUsed = new Set(code.callbacks.used_anywhere);
const unusedCallbacks = [...cbDefined].filter((x) => !cbUsed.has(x)).sort();

const codeTables = new Set(code.tables.referenced);
const dbTables = new Set(meta.tables || []);
const dbOnlyTables = [...dbTables].filter((t) => !codeTables.has(t)).sort(); // exist in DB, never referenced in code
const codeOnlyTables = [...codeTables].filter((t) => !dbTables.has(t)).sort(); // referenced in code, not found in DB (typos?)

const idx = Array.isArray(meta.indexes) ? meta.indexes : [];
const suspectIndexes = idx
  .filter((i) => !codeTables.has(i.table)) // indexes on tables not referenced in code
  .filter((i) => !i.is_primary) // ignore PK
  .map((i) => ({ table: i.table, name: i.name, columns: i.columns, is_unique: i.is_unique }))
  .sort((a, b) => (a.table + a.name).localeCompare(b.table + b.name));

const report = {
  summary: {
    files_scanned: code.scanned_files || 0,
    edge_functions: { total: presentFns.size, referenced: refFns.size, unused: unusedFns.length },
    callbacks: { defined: cbDefined.size, used: cbUsed.size, unused: unusedCallbacks.length },
    tables: {
      referenced_in_code: codeTables.size,
      in_db: dbTables.size,
      db_only: dbOnlyTables.length,
      code_only: codeOnlyTables.length,
    },
    suspect_indexes: suspectIndexes.length,
  },
  details: {
    unused_edge_functions: unusedFns,
    unused_callbacks: unusedCallbacks,
    db_only_tables: dbOnlyTables,
    code_only_tables: codeOnlyTables,
    suspect_indexes: suspectIndexes,
  },
};

fs.writeFileSync('.audit/audit_report.json', JSON.stringify(report, null, 2));

// Markdown
function table(rows, headers) {
  const h = `| ${headers.join(' | ')} |`;
  const s = `| ${headers.map(() => ':--').join(' | ')} |`;
  const b = rows.map((r) => `| ${headers.map((k) => String(r[k] ?? '')).join(' | ')} |`).join('\n');
  return [h, s, b].join('\n');
}
const md = `# Project Audit Report

## Summary
- Files scanned: ${report.summary.files_scanned}
- Edge Functions: total ${report.summary.edge_functions.total}, referenced ${report.summary.edge_functions.referenced}, unused ${report.summary.edge_functions.unused}
- Callbacks: defined ${report.summary.callbacks.defined}, used ${report.summary.callbacks.used}, unused ${report.summary.callbacks.unused}
- Tables: referenced in code ${report.summary.tables.referenced_in_code}, in DB ${report.summary.tables.in_db}, DB-only ${report.summary.tables.db_only}, code-only ${report.summary.tables.code_only}
- Suspect indexes (on tables not referenced in code, non-PK): ${report.summary.suspect_indexes}

## Unused Edge Functions
${
  report.details.unused_edge_functions.length
    ? report.details.unused_edge_functions.map((x) => `- ${x}`).join('\n')
    : '_None_'
}

## Unused Callback Keys
${
  report.details.unused_callbacks.length
    ? report.details.unused_callbacks.map((x) => `- ${x}`).join('\n')
    : '_None_'
}

## Tables present in DB but never referenced in code
${
  report.details.db_only_tables.length
    ? report.details.db_only_tables.map((x) => `- ${x}`).join('\n')
    : '_None_'
}

## Tables referenced in code but not found in DB
${
  report.details.code_only_tables.length
    ? report.details.code_only_tables.map((x) => `- ${x}`).join('\n')
    : '_None_'
}

## Suspect Indexes
${
  report.details.suspect_indexes.length
    ? table(report.details.suspect_indexes, ['table', 'name', 'columns', 'is_unique'])
    : '_None_'
}
`;
fs.writeFileSync('.audit/audit_report.md', md);
