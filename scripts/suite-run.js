// Runs the whole MODULE-based spec suite (everything under tests/ except Smoke, DIT-* and support) as one end-to-end run, one Playwright process per spec file (so a crash or a stuck
// Sentinel launch in one spec cannot poison the next), then builds a report: reports/suite/runs/<yyyymmdd-hhmmss>/report.md (+ results.json, one <spec>.json per file).
//   node scripts/suite-run.js                    all spec files
//   node scripts/suite-run.js --only Lot         only files whose path matches the text
//   node scripts/suite-run.js --report <dir>     rebuild report.md of an earlier run folder
//   (headed specs are always run first)
//   node scripts/suite-run.js --fast             FAST_WAITS=1: fixed waitForTimeout sleeps end early once the page's network traffic is quiet (tests/support/fast-waits.ts; ~30 % faster in samples)
// Settings: nothing here changes any setting. A spec that needs a Global Setting / Print Config that is not set skips with a "precondition" message; the report collects these in one list
// ("settings to update at the end"). Headed specs (print, template editor, Sentinel, Acrobat) use the real mouse and keyboard: nobody may touch the computer while it runs.

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const opt = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
const pad = (n) => String(n).padStart(2, '0');

function specFiles() {
  const out = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (!['Smoke', 'support', '_tmp'].includes(e.name) && !e.name.startsWith('DIT-')) walk(p); }
      else if (e.name.endsWith('.spec.ts') && e.name !== 'Link_Management_Edit_Document.spec.ts' /* blocked: Acrobat reinstall needs an admin */) out.push(path.relative(ROOT, p).split(path.sep).join('/'));
    }
  };
  walk(path.join(ROOT, 'tests'));
  return out.sort();
}

function* walkTests(suite) {
  for (const spec of suite.specs ?? []) for (const t of spec.tests ?? []) yield { spec, test: t };
  for (const s of suite.suites ?? []) yield* walkTests(s);
}

function load(outDir) {
  const rows = [];
  for (const f of fs.readdirSync(outDir).filter((n) => n.endsWith('.json') && n !== 'results.json')) {
    let j;
    try { j = JSON.parse(fs.readFileSync(path.join(outDir, f), 'utf8')); } catch { rows.push({ file: f.replace(/__/g, '/').replace('.json', ''), module: 'unknown', title: '(no JSON result: the run crashed)', status: 'crashed', duration: 0, error: 'no result file', annotations: [] }); continue; }
    for (const suite of j.suites ?? []) {
      for (const { spec, test } of walkTests(suite)) {
        const results = test.results ?? [];
        const last = results[results.length - 1] ?? {};
        const status = test.status === 'skipped' ? 'skipped' : test.status === 'expected' ? 'passed' : test.status === 'flaky' ? 'flaky' : 'failed';
        const file = (spec.file ?? suite.file ?? '').replace(/\\/g, '/');
        rows.push({
          file: 'tests/' + file.replace(/^tests\//, ''), module: file.replace(/^tests\//, '').split('/')[0], title: spec.title, status,
          duration: results.reduce((s, r) => s + (r.duration ?? 0), 0),
          error: status === 'failed' ? String(last.error?.message ?? (last.errors ?? [])[0]?.message ?? '').replace(/\u001b\[[0-9;]*m/g, '').split('\n').filter(Boolean).slice(0, 3).join(' | ').slice(0, 400) : '',
          annotations: test.annotations ?? [],
        });
      }
    }
  }
  return rows;
}

function report(outDir, meta) {
  const rows = load(outDir);
  const mins = (ms) => (ms / 60000).toFixed(1);
  const count = (arr, s) => arr.filter((r) => r.status === s).length;
  const modules = [...new Set(rows.map((r) => r.module))].sort();
  const L = [];
  L.push(`# ROBAR module suite - end-to-end run ${path.basename(outDir)}`, '');
  L.push(`- Environment: ${meta.env ?? 'see .env (ROBAR_BASE_URL)'}; spec files: ${meta.files ?? '?'}; one Playwright process per file; workers 1.`);
  L.push(`- **Wall-clock time: ${meta.wall ? mins(meta.wall) + ' min (' + (meta.wall / 3600000).toFixed(2) + ' h)' : 'n/a'}**; sum of test durations ${mins(rows.reduce((s, r) => s + r.duration, 0))} min.`);
  L.push(`- Tests: **${rows.length}** | passed ${count(rows, 'passed')} | failed ${count(rows, 'failed') + count(rows, 'crashed')} | flaky ${count(rows, 'flaky')} | skipped ${count(rows, 'skipped')}`, '');
  L.push('## By module', '', '| Module | Tests | Passed | Failed | Skipped | Minutes |', '|---|---:|---:|---:|---:|---:|');
  for (const m of modules) {
    const r = rows.filter((x) => x.module === m);
    L.push(`| ${m} | ${r.length} | ${count(r, 'passed')} | ${count(r, 'failed') + count(r, 'crashed')} | ${count(r, 'skipped')} | ${mins(r.reduce((s, x) => s + x.duration, 0))} |`);
  }
  const failed = rows.filter((r) => r.status === 'failed' || r.status === 'crashed');
  L.push('', `## Failures (${failed.length})`, '');
  for (const r of failed) L.push(`- **${r.file}** - ${r.title}: ${r.error}`);
  if (!failed.length) L.push('none');
  const skipped = rows.filter((r) => r.status === 'skipped');
  const skipReason = (r) => (r.annotations.find((a) => a.type === 'skip')?.description ?? '').replace(/\s+/g, ' ');
  const settings = skipped.filter((r) => /precondition|setting|PrintEntityRequired|Print Config|Global Setting/i.test(skipReason(r)));
  L.push('', `## Settings to update at the end (${settings.length} spec(s) skipped on a precondition)`, '');
  for (const r of settings) L.push(`- ${r.file} - ${skipReason(r)}`);
  if (!settings.length) L.push('none');
  const otherSkips = skipped.filter((r) => !settings.includes(r));
  L.push('', `## Other skips (${otherSkips.length})`, '');
  for (const r of otherSkips) L.push(`- ${r.file} - ${skipReason(r) || '(no reason recorded)'}`);
  const dev = rows.flatMap((r) => r.annotations.filter((a) => /^deviation/.test(a.type)).map((a) => `${r.file}: ${a.type} - ${(a.description ?? '').slice(0, 200)}`));
  L.push('', `## Deviations recorded by the specs (${dev.length}; specs stay green, differences from ValMaster / scripts)`, '');
  for (const d of dev) L.push(`- ${d}`);
  L.push('', '## Slowest 15 tests', '');
  for (const r of [...rows].sort((a, b) => b.duration - a.duration).slice(0, 15)) L.push(`- ${mins(r.duration)} min - ${r.file} - ${r.title.slice(0, 90)}`);
  fs.writeFileSync(path.join(outDir, 'report.md'), L.join('\n') + '\n');
  fs.writeFileSync(path.join(outDir, 'results.json'), JSON.stringify(rows, null, 1));
  return L.join('\n');
}

if (opt('--report')) { console.log(report(path.resolve(opt('--report')), {})); process.exit(0); }

const only = opt('--only');
// Headed specs (they use the real mouse/keyboard, so the desktop must stay unlocked) run first, so a person can supervise that part; the rest is headless.
const isHeaded = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8').includes('headless: false');
const files = specFiles().filter((f) => !only || f.includes(only)).sort((a, b) => Number(isHeaded(b)) - Number(isHeaded(a)) || (a < b ? -1 : 1));
const d = new Date();
const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
// --resume <run folder>: continue an interrupted run in the same folder, skipping every spec file that already has its JSON result
const resumeDir = opt('--resume') ? path.resolve(opt('--resume')) : undefined;
const outDir = resumeDir || path.join(ROOT, 'reports', 'suite', 'runs', stamp);
fs.mkdirSync(outDir, { recursive: true });
if (resumeDir) {
  // with --redo-failed a spec only counts as done when its earlier result has no failed test (use after an outage, e.g. the VPN dropping)
  const doneFiles = (f) => {
    const jf = path.join(outDir, f.replace(/\//g, '__').replace('.spec.ts', '') + '.json');
    if (!fs.existsSync(jf)) return false;
    if (!argv.includes('--redo-failed')) return true;
    try { return !/"status": "unexpected"/.test(fs.readFileSync(jf, 'utf8')); } catch { return false; }
  };
  for (let i = files.length - 1; i >= 0; i--) if (doneFiles(files[i])) files.splice(i, 1);
}
console.log(`suite run ${stamp}: ${files.length} spec files -> ${outDir}`);
const t0 = Date.now();
files.forEach((f, i) => {
  const jsonFile = path.join(outDir, f.replace(/\//g, '__').replace('.spec.ts', '') + '.json');
  const t1 = Date.now();
  const r = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['playwright', 'test', f, '--workers=1', '--reporter=json'], { cwd: ROOT, shell: process.platform === 'win32', env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: jsonFile, ...(argv.includes('--fast') ? { FAST_WAITS: '1' } : {}) }, encoding: 'utf8', maxBuffer: 1 << 28 });
  console.log(`[${i + 1}/${files.length}] ${((Date.now() - t1) / 60000).toFixed(1)} min  exit ${r.status}  ${f}`);
  fs.appendFileSync(path.join(outDir, 'progress.log'), `${new Date().toISOString()} [${i + 1}/${files.length}] exit ${r.status} ${f}\n`);
});
const text = report(outDir, { wall: Date.now() - t0, files: files.length });
console.log('\n' + text);
