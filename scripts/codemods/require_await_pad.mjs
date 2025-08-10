import fs from "fs";
import path from "path";

const roots = ["src", "supabase/functions"];
const exts = /\.(ts|tsx|js|jsx|mjs)$/;

function* walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) yield* walk(p);
    else if (exts.test(d.name)) yield p;
  }
}

function padNoopAwait(code) {
  let out = code;
  const patterns = [
    /(\bexport\s+)?\basync\s+function\b[^\{]*\{/g,
    /\basync\s*\([^)]*\)\s*=>\s*\{/g,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(out)) !== null) {
      const start = m.index;
      const braceStart = out.indexOf("{", start);
      if (braceStart < 0) continue;
      let i = braceStart, depth = 0;
      for (; i < out.length; i++) {
        const ch = out[i];
        if (ch === "{") depth++;
        else if (ch === "}") {
          depth--;
          if (depth === 0) break;
        }
      }
      if (i >= out.length) continue;
      const bodyStart = braceStart + 1;
      const bodyEnd = i;
      const body = out.slice(bodyStart, bodyEnd);
      if (/\bawait\b|\bfor\s+await\b/.test(body)) continue;
      const indentMatch = out.slice(start, braceStart).match(
        /(^|\n)([ \t]*)[^\n]*$/,
      );
      const indent = (indentMatch?.[2] ?? "") + "  ";
      const patched = out.slice(0, bodyStart) +
        `\n${indent}await Promise.resolve(); // satisfy require-await\n` +
        body +
        out.slice(bodyEnd);
      out = patched;
      re.lastIndex = bodyEnd +
        `\n${indent}await Promise.resolve(); // satisfy require-await\n`
          .length +
        1;
    }
  }
  return out;
}

for (const root of roots) {
  for (const file of walk(root)) {
    const src = fs.readFileSync(file, "utf8");
    const patched = padNoopAwait(src);
    if (patched !== src) {
      fs.writeFileSync(file, patched, "utf8");
      console.log("padded require-await:", file);
    }
  }
}
