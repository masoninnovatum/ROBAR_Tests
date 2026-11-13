// Diffs two build snapshots made by tests/Smoke/snapshot/Build_Snapshot.spec.ts and writes a Markdown report.
//   node scripts/snapshot-diff.js <older.json> <newer.json> [out.md]
// Default output: reports/build-snapshots/diff-<older>-vs-<newer>.md (also printed). Exit code 0 = no differences, 1 = differences (so it can gate a run).
// What is compared per module: status, page URL, headings, buttons, links, menu items, tabs, labels, input ids, select option lists, grid column headers, nested frames.
// A list is reported as "added" / "removed" items; a module that opens in one build and not in the other is reported first.

const fs = require('fs');
const path = require('path');

const [aFile, bFile, outArg] = process.argv.slice(2);
if (!aFile || !bFile) { console.error('usage: node scripts/snapshot-diff.js <older.json> <newer.json> [out.md]'); process.exit(2); }
const A = JSON.parse(fs.readFileSync(aFile, 'utf8'));
const B = JSON.parse(fs.readFileSync(bFile, 'utf8'));

const LISTS = ['headings', 'buttons', 'links', 'menus', 'tabs', 'labels', 'inputs'];
const lines = [];
let diffs = 0;
const note = (s) => { lines.push(s); diffs++; };
const delta = (a = [], b = []) => ({ added: b.filter((x) => !a.includes(x)), removed: a.filter((x) => !b.includes(x)) });
const fmt = (xs) => xs.map((x) => '`' + String(x).replace(/`/g, "'") + '`').join(', ');

function diffMap(label, a = {}, b = {}) {
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (!(k in a)) note(`  - ${label} **${k}** added: ${fmt(b[k]).slice(0, 300)}`);
    else if (!(k in b)) note(`  - ${label} **${k}** removed (was: ${fmt(a[k]).slice(0, 200)})`);
    else {
      const d = delta(a[k], b[k]);
      if (d.added.length || d.removed.length) note(`  - ${label} **${k}**:${d.added.length ? ' added ' + fmt(d.added) : ''}${d.removed.length ? ' removed ' + fmt(d.removed) : ''}`);
      else if (a[k].join('\u0001') !== b[k].join('\u0001')) note(`  - ${label} **${k}**: same items, different order`);
    }
  }
}

function diffPage(prefix, a, b, indentTitle) {
  const before = lines.length;
  if (a.url !== b.url) note(`  - URL changed: \`${a.url}\` -> \`${b.url}\``);
  for (const l of LISTS) {
    const d = delta(a[l], b[l]);
    if (d.added.length || d.removed.length) note(`  - ${l}:${d.added.length ? ' added ' + fmt(d.added) : ''}${d.removed.length ? ' removed ' + fmt(d.removed) : ''}`);
  }
  diffMap('select', a.selects, b.selects);
  diffMap('grid columns', a.tables, b.tables);
  const ka = (a.childFrames || []).map((c) => c.url), kb = (b.childFrames || []).map((c) => c.url);
  const d = delta(ka, kb);
  if (d.added.length || d.removed.length) note(`  - nested frames:${d.added.length ? ' added ' + fmt(d.added) : ''}${d.removed.length ? ' removed ' + fmt(d.removed) : ''}`);
  (b.childFrames || []).forEach((cb) => {
    const ca = (a.childFrames || []).find((c) => c.url === cb.url);
    if (ca) { const n = lines.length; diffPage('', ca, cb); for (let i = n; i < lines.length; i++) lines[i] = lines[i].replace(/^  - /, `  - [frame ${cb.url.slice(0, 50)}] `); }
  });
  return lines.length - before;
}

lines.push(`# Build snapshot diff: ${A.build} -> ${B.build}`, '', `- older: \`${path.basename(aFile)}\` (${A.takenAt})`, `- newer: \`${path.basename(bFile)}\` (${B.takenAt})`, '');

const tiles = delta(A.tiles, B.tiles);
if (tiles.added.length || tiles.removed.length) { lines.push('## Main Menu tiles'); note(`- ${tiles.added.length ? 'new: ' + fmt(tiles.added) : ''}${tiles.removed.length ? ' removed: ' + fmt(tiles.removed) : ''}`); lines.push(''); }

const names = [...new Set([...Object.keys(A.modules), ...Object.keys(B.modules)])];
for (const m of names) {
  const a = A.modules[m], b = B.modules[m];
  const head = lines.length;
  lines.push(`## ${m}`);
  if (!a || !b) note(`- module only in ${a ? 'older' : 'newer'} snapshot`);
  else if (a.status !== b.status) note(`- status: ${a.status} -> ${b.status}`);
  else if (a.status === 'opened') diffPage('', a, b);
  if (lines.length === head + 1) lines.pop(); else lines.push('');
}

lines.splice(4, 0, diffs ? `**${diffs} difference line(s).**` : '**No differences.**', '');
const out = outArg || path.join(__dirname, '..', 'reports', 'build-snapshots', `diff-${A.build}${path.basename(aFile).includes('__') ? '-' + path.basename(aFile, '.json').split('__')[1] : ''}-vs-${B.build}${path.basename(bFile).includes('__') ? '-' + path.basename(bFile, '.json').split('__')[1] : ''}.md`);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, lines.join('\n') + '\n');
console.log(lines.join('\n'));
console.log(`\nreport: ${out}`);
process.exit(diffs ? 1 : 0);
