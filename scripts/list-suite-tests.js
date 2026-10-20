// Writes an inventory of the module suite: every spec file, its tests (titles via `playwright test --list`) and the named steps inside each file (test.step titles, in source order).
//   node scripts/list-suite-tests.js [out.md]      default out: reports/suite-test-inventory.md
// Uses the same file selection as scripts/suite-run.js (no Smoke, DIT-*, support; Link_Management_Edit_Document excluded). Does not run any test or open a browser.
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const out = path.resolve(process.argv[2] || path.join(ROOT, 'reports', 'suite-test-inventory.md'));

const files = [];
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!['Smoke', 'support', '_tmp'].includes(e.name) && !e.name.startsWith('DIT-')) walk(p); }
    else if (e.name.endsWith('.spec.ts') && e.name !== 'Link_Management_Edit_Document.spec.ts') files.push(path.relative(ROOT, p).split(path.sep).join('/'));
  }
};
walk(path.join(ROOT, 'tests'));
files.sort();

// titles per file from Playwright itself
const r = spawnSync(process.execPath, [path.join(ROOT, 'node_modules', '@playwright', 'test', 'cli.js'), 'test', '--list', '--reporter=json'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 });
const titles = {};
try {
  const j = JSON.parse(r.stdout);
  const w = (su) => {
    for (const sp of su.specs || []) titles['tests/' + sp.file.replace(/\\/g, '/').replace(/^tests\//, '')] = [...(titles['tests/' + sp.file.replace(/\\/g, '/').replace(/^tests\//, '')] || []), sp.title];
    for (const s of su.suites || []) w(s);
  };
  (j.suites || []).forEach(w);
} catch (e) { console.error('could not parse --list output', e.message); }

const stepRe = new RegExp('test\\.step\\(\\s*([\'"`])((?:\\\\.|(?!\\1).)*)\\1', 'g');
const lines = [];
let nTests = 0, nSteps = 0;
let curMod = '';
for (const f of files) {
  const m = f.split('/')[1];
  if (m !== curMod) { curMod = m; lines.push('', '## ' + m, ''); }
  const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const steps = [];
  let x;
  while ((x = stepRe.exec(src))) steps.push(x[2].replace(/\s+/g, ' '));
  const t = titles[f] || [];
  nTests += t.length; nSteps += steps.length;
  lines.push('### ' + f.split('/').slice(2).join('/'), '');
  for (const title of t) lines.push('- **Test:** ' + title);
  if (!t.length) lines.push('- (no test titles found)');
  if (steps.length) { lines.push('', '  Steps / actions:'); steps.forEach((s, i) => lines.push(`  ${i + 1}. ${s}`)); }
  lines.push('');
}
const head = ['# ROBAR module suite - inventory of tests and actions', '', `Generated ${new Date().toISOString().slice(0, 10)} by scripts/list-suite-tests.js: ${files.length} spec files, ${nTests} tests, ${nSteps} named steps (test.step titles; template-literal steps show their raw text). Specs without named steps do their actions inline: read the spec file for the click-level detail.`];
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, head.concat(lines).join('\n') + '\n');
console.log(out, files.length, nTests, nSteps);

// Short list: "Module:" then "SpecName - test title" per test (reports/suite-test-list.md)
const short = [];
let cur = '';
for (const f of files) {
  const m = f.split('/')[1];
  if (m !== cur) { cur = m; if (short.length) short.push(''); short.push(m.replace(/-/g, ' ') + ':', ''); }
  const name = f.split('/').slice(2).join('/').replace('.spec.ts', '');
  for (const title of titles[f] || ['(no title found)']) short.push(name + ' - ' + title);
}
const shortOut = path.join(path.dirname(out), 'suite-test-list.md');
fs.writeFileSync(shortOut, short.join('\n') + '\n');
console.log(shortOut);
