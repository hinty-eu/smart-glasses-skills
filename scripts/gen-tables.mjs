#!/usr/bin/env node
// Generates the platform tables from data/platforms.json into every file that has the markers
//   <!-- platforms:start -->            all columns
//   <!-- platforms:start columns=a,b --> only these columns
//   <!-- platforms:end -->
// Files inside skills/ use link-reference markers instead, because skill security scanners read an HTML comment
// pair that wraps text as a hidden instruction. These render as nothing; the table gets a blank line on each side:
//   [//]: # "platforms:start"            (columns=a,b works here too)
//   [//]: # "platforms:end"
// Usage: node scripts/gen-tables.mjs           rewrite the tables
//        node scripts/gen-tables.mjs --check   exit 1 if any table is out of date (CI)
import { readFileSync, writeFileSync } from 'node:fs';

const TARGETS = ['skills/smart-glasses/references/platforms.md', 'README.md'];
const TAG = { official: 'O', community: 'S', press: 'P', unverified: '?' };
const check = process.argv.includes('--check');

const data = JSON.parse(readFileSync('data/platforms.json', 'utf8'));
for (const p of data.platforms) {
  for (const [id, f] of Object.entries(p.facts)) {
    // Facts outside the table columns (sdk, licence, countries...) are kept as data and validated, not rendered.
    for (const key of ['value', 'source', 'checked', 'confidence']) {
      if (!f[key]) throw new Error(`${p.id}.${id}: missing "${key}"`);
    }
    if (!TAG[f.confidence]) throw new Error(`${p.id}.${id}: confidence must be one of ${Object.keys(TAG).join(', ')}`);
  }
}

const cell = s => String(s).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');

function table(only) {
  const cols = only ? data.columns.filter(c => only.includes(c.id)) : data.columns;
  if (!data.platforms.length) return '_No platforms yet._';
  const head = `| Glasses | ${cols.map(c => c.title).join(' | ')} | Checked |`;
  const sep = `|---|${cols.map(() => '---').join('|')}|---|`;
  const rows = data.platforms.map(p => {
    const facts = cols.map(c => {
      const f = p.facts[c.id];
      return f ? `${cell(f.value)} [${TAG[f.confidence]}](${f.source})` : '-';
    });
    const dates = cols.map(c => p.facts[c.id]?.checked).filter(Boolean).sort();
    return `| ${cell(p.name)} | ${facts.join(' | ')} | ${dates[0] || '-'} |`;
  });
  return [head, sep, ...rows].join('\n');
}

let stale = [];
for (const file of TARGETS) {
  let text;
  try { text = readFileSync(file, 'utf8'); } catch { continue; }
  const next = text
    .replace(
      /(<!-- platforms:start(?: columns=([a-z0-9,-]+))? -->)[\s\S]*?(<!-- platforms:end -->)/g,
      (_, start, cols, end) => `${start}\n${table(cols ? cols.split(',') : null)}\n${end}`,
    )
    .replace(
      /(\[\/\/\]: # "platforms:start(?: columns=([a-z0-9,-]+))?")[\s\S]*?(\[\/\/\]: # "platforms:end")/g,
      (_, start, cols, end) => `${start}\n\n${table(cols ? cols.split(',') : null)}\n\n${end}`,
    );
  if (next !== text) {
    if (check) stale.push(file);
    else { writeFileSync(file, next); console.log(`gen-tables: updated ${file}`); }
  }
}
if (check && stale.length) {
  console.error(`gen-tables: out of date: ${stale.join(', ')}. Run node scripts/gen-tables.mjs`);
  process.exit(1);
}
if (check) console.log('gen-tables: OK');
