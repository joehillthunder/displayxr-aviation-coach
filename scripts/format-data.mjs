// Pretty-print the training material the way it is committed: two-space JSON, with short arrays of
// plain values (aliases, anchors) and one-line source objects kept on one line.
//   node scripts/format-data.mjs web/data/preflight/parts.json [...]
import { readFileSync, writeFileSync } from 'node:fs';

export function formatJson(value) {
  let out = JSON.stringify(value, null, 2);
  out = out.replace(/\[\n(\s+(?:"[^"\n]*"|-?[\d.e-]+),?\n)+\s*\]/g, (m) => {
    const one = `[${m.slice(1, -1).split('\n').map((l) => l.trim()).filter(Boolean).join(' ')}]`;
    return one.length <= 140 ? one : m;
  });
  out = out.replace(/\{\n(\s+"[^"\n]+": (?:"[^"\n]*"|-?[\d.]+),?\n)+\s*\}/g, (m) => {
    const one = `{ ${m.slice(1, -1).split('\n').map((l) => l.trim()).filter(Boolean).join(' ')} }`;
    return one.length <= 140 ? one : m;
  });
  return `${out}\n`;
}

for (const f of process.argv.slice(2)) writeFileSync(f, formatJson(JSON.parse(readFileSync(f, 'utf8'))));
