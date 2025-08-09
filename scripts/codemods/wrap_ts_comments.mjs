import fs from 'fs';
import path from 'path';

const roots = ['src', 'supabase/functions'];
const exts = /\.(ts|tsx|js|jsx|mjs)$/;

function* walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) yield* walk(p);
    else if (exts.test(d.name)) yield p;
  }
}

for (const root of roots) {
  for (const file of walk(root)) {
    const src = fs.readFileSync(file, 'utf8').split('\n');
    let changed = false;
    for (let i = 0; i < src.length; i++) {
      const line = src[i];
      if (/@ts-(ignore|expect-error)/.test(line)) {
        const prev = src[i - 1] || '';
        if (!/deno-lint-ignore\s+ban-ts-comment/.test(prev)) {
          src.splice(i, 0, '// deno-lint-ignore ban-ts-comment');
          i++; // skip inserted line
          changed = true;
        }
      }
    }
    if (changed) {
      fs.writeFileSync(file, src.join('\n'));
      console.log('wrapped ts-comment:', file);
    }
  }
}
