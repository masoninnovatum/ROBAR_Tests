// Runs the whole MODULE-based spec suite (everything under tests/ except Smoke, DITs and support) as one end-to-end run, one Playwright process per spec file (so a crash or a stuck
// Sentinel launch in one spec cannot poison the next), then builds a report: reports/suite/runs/<yyyymmdd-hhmmss>/report.md (+ results.json, one <spec>.json per file).
//   node scripts/suite-run.js                    all spec files
//   node scripts/suite-run.js --only Lot         only files whose path matches the text
//   node scripts/suite-run.js --exclude tests/API/   all files except those whose path matches the text (combinable with --only)
//   node scripts/suite-run.js --report <dir>    rebuild report.md of an earlier run folder (wall-clock time is taken from its live.ndjson when it has one)
//   A spec process that ends WITHOUT a result file (killed, closed console window, crash) leaves a marker <spec>.json {"crashed":true,...}: the report lists that file under Failures as "crashed"
//   (before 2026-11-20 its tests were silently missing), and --resume always runs it again.
//   (headed specs are always run first)
//   node scripts/suite-run.js --datadog         upload the run's JUnit reports to Datadog when it ends (env DD_API_KEY, DD_SITE; service robar-e2e)
//   node scripts/suite-run.js --fix-fixtures     before the run, restore the shared MB/CL fixture groups to their baseline if a killed spec left them changed (default: stop and say what is wrong)
//   node scripts/suite-run.js --no-canary        skip the fixture baseline check that normally runs first (tests/Smoke/preflight/Fixture_Baseline.spec.ts)
//   node scripts/suite-run.js --resume <run folder> --only <text> --redo-failed   (ALWAYS give --only with --resume: a spec counts as done only if THIS folder holds its result, so without --only every other spec runs)
//   Live view while it runs: http://127.0.0.1:4173 - the runner starts scripts/suite-ui.js itself when it is not already running (scripts/ensure-suite-ui.js; SUITE_UI_AUTOSTART=0 turns that off); it reads <run folder>/live.ndjson; the page can also start Smoke / E2E / API runs and stop the active one; follows the newest run; Ctrl+C on the runner is recorded as "aborted")
//   node scripts/suite-run.js --fast           FAST_WAITS=1: fixed waitForTimeout sleeps end early once the page's network traffic is quiet (tests/support/fast-waits.ts; ~30 % faster in samples)
// Settings: nothing here changes any setting. A spec that needs a Global Setting / Print Config that is not set skips with a "precondition" message; the report collects these in one list
// ("settings to update at the end"). Headed specs (print, template editor, Sentinel, Acrobat) use the real mouse and keyboard: nobody may touch the computer while it runs.

const { spawnSync, spawn } = require('child_process');
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
      if (e.isDirectory()) { if (!['Smoke', 'support', '_tmp'].includes(e.name) && !e.name.startsWith('DIT-') && e.name !== 'DITs') walk(p); }
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
    if (j && j.crashed) { // marker written by this runner when a spec process ended without producing a result file (killed, closed console window, crash)
      const sf = j.file || f.replace(/__/g, '/').replace('.json', '.spec.ts');
      const why = j.exit === 3221225786 ? ' (0xC000013A: terminated by Ctrl+C or a closed console window)' : '';
      rows.push({ file: sf, module: sf.replace(/^tests\//, '').split('/')[0], title: '(spec process ended without a result: its tests are missing from this report)', status: 'crashed', duration: 0, error: `exit code ${j.exit}${why}${j.stderr ? ': ' + j.stderr : ''}`.slice(0, 400), annotations: [] });
      continue;
    }
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

if (opt('--report')) {
  const dir = path.resolve(opt('--report'));
  let meta = {}; // wall-clock time and file count of that run, from its live feed when it has one
  try { const ev = fs.readFileSync(path.join(dir, 'live.ndjson'), 'utf8').trim().split('\n').map((l) => JSON.parse(l)); const re = [...ev].reverse().find((e) => e.t === 'runEnd' && e.wallMs); const rs = ev.find((e) => e.t === 'runStart'); meta = { wall: re && re.wallMs, files: rs && rs.files.length }; } catch { /* no live feed */ }
  console.log(report(dir, meta)); process.exit(0);
}

// make sure the live progress page is up (http://127.0.0.1:4173); starts scripts/suite-ui.js detached if nobody did. Never fails the run; SUITE_UI_AUTOSTART=0 disables it.
// HIDE: when this runner has no terminal (started from the live page's Start button: detached, output redirected to a log file) it has no console either, and every console child it starts
// (the cmd.exe behind each `npx playwright test`) would open its own visible window, stealing focus from headed specs. windowsHide stops that; from a terminal nothing changes.
const HIDE = !process.stdout.isTTY;
spawnSync(process.execPath, [path.join(__dirname, 'ensure-suite-ui.js')], { stdio: 'inherit', windowsHide: HIDE });
const only = opt('--only');
const exclude = opt('--exclude'); // skip files whose path contains this text (the live page's "E2E" button uses --exclude tests/API/, its "API" button --only tests/API/)
// Headed specs (they use the real mouse/keyboard, so the desktop must stay unlocked) run first, so a person can supervise that part; the rest is headless.
const isHeaded = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8').includes('headless: false');
const files = specFiles().filter((f) => !only || f.includes(only)).filter((f) => !exclude || !f.includes(exclude)).sort((a, b) => Number(isHeaded(b)) - Number(isHeaded(a)) || (a < b ? -1 : 1));
const d = new Date();
const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
// --resume <run folder>: continue an interrupted run in the same folder, skipping every spec file that already has its JSON result
const doneEarlier = [];
const resumeDir = opt('--resume') ? path.resolve(opt('--resume')) : undefined;
const outDir = resumeDir || path.join(ROOT, 'reports', 'suite', 'runs', stamp);
fs.mkdirSync(outDir, { recursive: true });
// Pause: the live page's "Pause run" button creates <run folder>/pause.flag; this runner then holds BEFORE the next spec file (the file that is running always finishes; a spec cannot be frozen
// safely mid-test) until the flag is removed ("Resume run"). A stale flag from an earlier part of this folder is removed at start.
const PAUSE_FLAG = path.join(outDir, 'pause.flag');
try { fs.unlinkSync(PAUSE_FLAG); } catch { /* none */ }
if (resumeDir) {
  // with --redo-failed a spec only counts as done when its earlier result has no failed test (use after an outage, e.g. the VPN dropping)
  const doneFiles = (f) => {
    const jf = path.join(outDir, f.replace(/\//g, '__').replace('.spec.ts', '') + '.json');
    if (!fs.existsSync(jf)) return false;
    let txt; try { txt = fs.readFileSync(jf, 'utf8'); } catch { return false; }
    if (/^\s*\{\s*"crashed":\s*true/.test(txt)) return false; // a crash marker is not a result: always run that spec again
    if (!argv.includes('--redo-failed')) return true;
    return !/"status": "unexpected"/.test(txt);
  };
  for (let i = files.length - 1; i >= 0; i--) if (doneFiles(files[i])) doneEarlier.push(...files.splice(i, 1));
}
console.log(`suite run ${stamp}: ${files.length} spec files -> ${outDir}`);
// Live progress: every event of this run (runner + scripts/live-reporter.js inside each spec process) is appended to <run folder>/live.ndjson; watch it with  node scripts/suite-ui.js
const LIVE = path.join(outDir, 'live.ndjson');
const live = (ev) => { try { fs.appendFileSync(LIVE, JSON.stringify({ ts: Date.now(), ...ev }) + '\n'); } catch { /* the UI feed must never stop the run */ } };
live({ t: 'runStart', run: path.basename(outDir), kind: 'suite', pid: process.pid, files: files.map((f) => ({ file: f, headed: isHeaded(f) })), doneEarlier, resumed: !!resumeDir, only: only || null, exclude: exclude || null });
// Fixture canary (tests/Smoke/preflight/Fixture_Baseline.spec.ts, ~45 s, read-only): stops the run when a shared security fixture (e.g. MBPWLoginGrp) is not in its baseline state,
// instead of producing many confusing "not authorized" failures. --fix-fixtures restores the MB/CL fixture groups to their baseline and goes on; --no-canary skips the check.
if (!argv.includes('--no-canary') && files.length) {
  const canary = (fix) => spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['playwright', 'test', 'tests/Smoke/preflight/Fixture_Baseline.spec.ts', '--workers=1', '--reporter=line'], { cwd: ROOT, shell: process.platform === 'win32', windowsHide: HIDE, env: { ...process.env, ...(fix ? { CANARY_FIX: '1' } : {}) }, encoding: 'utf8', maxBuffer: 1 << 26 });
  live({ t: 'canary', status: 'start' });
  const c = canary(argv.includes('--fix-fixtures'));
  if (c.status !== 0) {
    live({ t: 'canary', status: 'failed' });
    live({ t: 'runEnd', status: 'canary-failed', wallMs: 0 });
    const out = `${c.stdout || ''}${c.stderr || ''}`;
    const why = out.split(/\r?\n/).filter((l) => /^\s*- (group|user) /.test(l)).join('\n') || out.slice(-1500);
    console.log(`\nFixture canary FAILED: a shared security fixture is not in its baseline state, so the run was NOT started:\n${why}\n(rerun with --fix-fixtures to restore the MB/CL fixture groups automatically, or --no-canary to skip this check)`);
    fs.appendFileSync(path.join(outDir, 'progress.log'), `${new Date().toISOString()} fixture canary failed, run not started\n`);
    process.exit(2);
  }
  console.log('fixture canary: shared security fixtures are in baseline');
  live({ t: 'canary', status: 'ok' });
}
const t0 = Date.now();
// One spec file at a time, asynchronously (so the live feed can heartbeat while a spec runs). The spec process's own stdout is not needed: results go to the JSON/JUnit files and to live.ndjson.
const NPX = process.platform === 'win32' ? 'npx.cmd' : 'npx';
let child; let aborted = false;
const killChild = () => { if (child && child.pid) { try { if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: HIDE }); else child.kill('SIGTERM'); } catch { /* already gone */ } } };
const abort = (sig) => { if (aborted) return; aborted = true; killChild(); live({ t: 'runEnd', status: 'aborted', signal: sig, wallMs: Date.now() - t0 }); process.exit(130); };
process.on('SIGINT', () => abort('SIGINT'));
process.on('SIGTERM', () => abort('SIGTERM'));
const hb = setInterval(() => live({ t: 'hb' }), 10000);

const runSpec = (f, i) => new Promise((resolve) => {
  const base = f.replace(/\//g, '__').replace('.spec.ts', '');
  const jsonFile = path.join(outDir, base + '.json');
  const junitFile = path.join(outDir, 'junit', base + '.xml');
  fs.mkdirSync(path.dirname(junitFile), { recursive: true });
  const t1 = Date.now();
  try { if (/^\s*\{\s*"crashed":\s*true/.test(fs.readFileSync(jsonFile, 'utf8'))) fs.unlinkSync(jsonFile); } catch { /* no earlier file */ } // a stale crash marker from an earlier part of this run folder (--resume)
  live({ t: 'fileStart', i: i + 1, n: files.length, file: f });
  let errTail = '';
  child = spawn(NPX, ['playwright', 'test', f, '--workers=1', '--reporter=json,junit,./scripts/live-reporter.js'], {
    cwd: ROOT, shell: process.platform === 'win32', stdio: ['ignore', 'ignore', 'pipe'], windowsHide: HIDE,
    env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: jsonFile, PLAYWRIGHT_JUNIT_OUTPUT_FILE: junitFile, LIVE_EVENTS_FILE: LIVE, LIVE_SHOTS_DIR: path.join(outDir, 'shots'), ...(argv.includes('--fast') ? { FAST_WAITS: '1' } : {}) },
  });
  child.stderr.on('data', (b) => { errTail = (errTail + b.toString()).slice(-600); });
  const cleanErr = () => errTail.replace(/\u001b\[[0-9;]*m/g, '').split(/\r?\n/).filter((l) => l.trim() && !/^npm notice/.test(l)).join(' | ').slice(-300);
  const done = (status) => {
    console.log(`[${i + 1}/${files.length}] ${((Date.now() - t1) / 60000).toFixed(1)} min  exit ${status}  ${f}`);
    fs.appendFileSync(path.join(outDir, 'progress.log'), `${new Date().toISOString()} [${i + 1}/${files.length}] exit ${status} ${f}\n`);
    // No JSON result = the spec process was killed / crashed (Playwright writes the file at the end of a normal run, passed or failed): leave a marker so the report lists the file as crashed
    // instead of silently leaving its tests out, and so --resume runs it again.
    if (!fs.existsSync(jsonFile)) { try { fs.writeFileSync(jsonFile, JSON.stringify({ crashed: true, file: f, exit: status, stderr: cleanErr() })); } catch { /* ignore */ } }
    live({ t: 'fileEnd', i: i + 1, n: files.length, file: f, exit: status, ms: Date.now() - t1, ...(status !== 0 && status !== 1 ? { stderr: cleanErr() } : {}) });
    resolve();
  };
  child.on('error', () => done(-1));
  child.on('close', (code) => done(code));
});

(async () => {
  for (let i = 0; i < files.length; i++) {
    if (fs.existsSync(PAUSE_FLAG)) {
      live({ t: 'pause', state: 'paused', next: files[i] });
      console.log(`paused before ${files[i]} (resume from the live page)`);
      while (fs.existsSync(PAUSE_FLAG)) await new Promise((r) => setTimeout(r, 1000));
      live({ t: 'pause', state: 'resumed' });
      console.log('resumed');
    }
    await runSpec(files[i], i);
  }
  try { fs.unlinkSync(PAUSE_FLAG); } catch { /* none */ }
  clearInterval(hb);
  const text = report(outDir, { wall: Date.now() - t0, files: files.length });
  live({ t: 'runEnd', status: 'finished', wallMs: Date.now() - t0 });
  // --datadog: upload the JUnit reports of this run to Datadog (needs DD_API_KEY in the environment, see scripts/datadog-upload.js)
  if (argv.includes('--datadog')) spawnSync(process.execPath, [path.join(__dirname, 'datadog-upload.js'), outDir, '--tags', 'suite:full'], { cwd: ROOT, stdio: 'inherit', windowsHide: HIDE });
  console.log('\n' + text);
})();
