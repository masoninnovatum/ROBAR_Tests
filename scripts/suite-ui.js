// Live progress page for ROBAR end-to-end (suite), API and smoke runs. It reads files under reports/, and (since 2026-11-19) can START a Smoke / E2E / API run and STOP the running one
// from the page (POST /api/start, /api/stop; localhost + Origin checked, refuses to start while another run is active; see "Starting runs" below).
//   node scripts/suite-ui.js                 serve http://127.0.0.1:4173 and show the newest run (follows a new run when it starts)
//   node scripts/suite-ui.js --port 5000     another port
//   node scripts/suite-ui.js --open          also open the page in the default browser
// Data: <run folder>/live.ndjson, written by scripts/suite-run.js and scripts/smoke-run.js (runner events) and scripts/live-reporter.js (per-test events inside each spec process).
// Older runs without live.ndjson are replayed from their results.json (no timings inside a spec file, only results). Binds to localhost only.

const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec, execFile, spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const opt = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const PORT = Number(opt('--port') || process.env.SUITE_UI_PORT || 4173);
// Optional local settings, scripts/suite-ui.config.json (gitignored):  { "host": "0.0.0.0", "auth": "user:password" }
//   host: interface to listen on (default 127.0.0.1 = this machine only; 0.0.0.0 = the whole network). Also --host / env SUITE_UI_HOST.
//   auth: when set, every request that does NOT come from this machine needs this HTTP basic-auth login (also env SUITE_UI_AUTH). Unset = no login.
// Starting / stopping runs is ONLY allowed from this machine (127.0.0.1); everybody else on the network gets a view-only page.
let CFG = {};
try { CFG = JSON.parse(fs.readFileSync(path.join(__dirname, 'suite-ui.config.json'), 'utf8')); } catch { /* no config file: defaults */ }
const HOST = opt('--host') || process.env.SUITE_UI_HOST || CFG.host || '127.0.0.1';
const AUTH = process.env.SUITE_UI_AUTH || CFG.auth || '';
const isLoopback = (req) => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
function authOk(req) {
  if (!AUTH || isLoopback(req)) return true;
  const m = /^Basic (.+)$/i.exec(req.headers.authorization || '');
  if (!m) return false;
  const given = Buffer.from(m[1], 'base64').toString('utf8');
  return given.length === AUTH.length && require('crypto').timingSafeEqual(Buffer.from(given), Buffer.from(AUTH));
}
const DATA = process.env.SUITE_UI_ROOT || ROOT; // SUITE_UI_ROOT: point at another folder with reports/{suite,smoke}/runs (used to test the page with simulated runs)
const KINDS = { suite: path.join(DATA, 'reports', 'suite', 'runs'), smoke: path.join(DATA, 'reports', 'smoke', 'runs') };

const exists = (p) => { try { return fs.existsSync(p); } catch { return false; } };
const readJson = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return undefined; } };

// run id = "<kind>/<stamp>"; resolves only inside the two known run roots (no path traversal)
function runDir(id) {
  const m = /^(suite|smoke)\/(\d{8}-\d{6})$/.exec(id || '');
  return m ? path.join(KINDS[m[1]], m[2]) : undefined;
}

function firstEvent(file) {
  try {
    const fd = fs.openSync(file, 'r');
    const buf = Buffer.alloc(16384);
    const n = fs.readSync(fd, buf, 0, buf.length, 0);
    fs.closeSync(fd);
    const line = buf.slice(0, n).toString('utf8').split('\n')[0];
    return JSON.parse(line);
  } catch { return undefined; }
}

// Smoke / API / E2E, from a run's first (runStart) event
function suiteLabel(ev, kind) {
  if (kind === 'smoke' || (ev && ev.kind === 'smoke')) return 'Smoke';
  if (ev && ev.only && String(ev.only).replace(/\\/g, '/').includes('tests/API')) return 'API';
  return ev ? (ev.exclude || !ev.only ? 'E2E' : 'E2E (partial)') : 'E2E';
}

function listRuns() {
  const out = [];
  for (const [kind, dir] of Object.entries(KINDS)) {
    if (!exists(dir)) continue;
    for (const stamp of fs.readdirSync(dir)) {
      if (!/^\d{8}-\d{6}$/.test(stamp)) continue;
      const d = path.join(dir, stamp);
      const live = exists(path.join(d, 'live.ndjson'));
      const hasResults = exists(path.join(d, 'results.json')) || (kind === 'smoke' && fs.readdirSync(d).some((f) => f.endsWith('.json')));
      if (!live && !hasResults) continue;
      let mtime = 0;
      try { mtime = fs.statSync(path.join(d, 'live.ndjson')).mtimeMs; } catch { /* run without a live feed */ }
      out.push({ id: `${kind}/${stamp}`, kind, stamp, live, mtime, hasReport: exists(path.join(d, 'report.md')), suite: suiteLabel(live ? firstEvent(path.join(d, 'live.ndjson')) : undefined, kind) });
    }
  }
  // newest = most recently written live feed, so a RESUMED run (it writes into its old folder) is followed too; runs without a feed sort by folder stamp
  return out.sort((a, b) => (b.mtime - a.mtime) || (a.stamp < b.stamp ? 1 : a.stamp > b.stamp ? -1 : 0));
}

// median wall time per spec file over the earlier suite runs (used by the page for the ETA)
function history() {
  const per = new Map();
  const dir = KINDS.suite;
  if (!exists(dir)) return {};
  for (const stamp of fs.readdirSync(dir)) {
    const rows = readJson(path.join(dir, stamp, 'results.json'));
    if (!Array.isArray(rows)) continue;
    const sums = new Map();
    for (const r of rows) sums.set(r.file, (sums.get(r.file) ?? 0) + (r.duration || 0));
    // only specs that still exist (renamed / deleted ones would inflate the counts and the ETA)
    for (const [f, ms] of sums) { if (ms > 0 && exists(path.join(ROOT, f))) { if (!per.has(f)) per.set(f, []); per.get(f).push(ms); } }
  }
  const out = {};
  for (const [f, arr] of per) { arr.sort((a, b) => a - b); out[f] = arr[Math.floor(arr.length / 2)]; }
  return out;
}

// events for a run that has no live.ndjson: rebuilt from results.json (suite) so old runs can still be looked at
function replayEvents(id) {
  const d = runDir(id);
  const rows = d && readJson(path.join(d, 'results.json'));
  if (!Array.isArray(rows)) return [];
  const byFile = new Map();
  for (const r of rows) { if (!byFile.has(r.file)) byFile.set(r.file, []); byFile.get(r.file).push(r); }
  const ev = [{ ts: 0, t: 'runStart', run: id.split('/')[1], kind: id.split('/')[0], replay: true, files: [...byFile.keys()].map((file) => ({ file, headed: false })), doneEarlier: [] }];
  for (const [file, list] of byFile) {
    ev.push({ ts: 0, t: 'fileStart', file });
    for (const r of list) ev.push({ ts: 0, t: 'testEnd', file, title: r.title, status: r.status === 'crashed' ? 'failed' : r.status, ms: r.duration || 0, ...(r.error ? { error: r.error } : {}), ...(r.status === 'skipped' ? { note: (r.annotations || []).map((a) => a.description).filter(Boolean).join(' | ') } : {}) });
    ev.push({ ts: 0, t: 'fileEnd', file, ms: list.reduce((s, r) => s + (r.duration || 0), 0), exit: 0 });
  }
  ev.push({ ts: 0, t: 'runEnd', status: 'finished', replay: true });
  return ev;
}

function alive(pid) { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } }

function sse(req, res, id) {
  const d = runDir(id);
  if (!d) { res.writeHead(404); res.end('bad run'); return; }
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  const file = path.join(d, 'live.ndjson');
  const send = (name, data) => res.write(`event: ${name}\ndata: ${typeof data === 'string' ? data : JSON.stringify(data)}\n\n`);
  if (!exists(file)) { for (const e of replayEvents(id)) send('ev', e); send('status', { alive: false, replay: true }); send('end', {}); res.end(); return; }
  let offset = 0; let rest = ''; let pid; let ended = false;
  const pump = () => {
    let size; try { size = fs.statSync(file).size; } catch { return; }
    if (size < offset) { offset = 0; rest = ''; }
    if (size === offset) return;
    const fd = fs.openSync(file, 'r'); const buf = Buffer.alloc(size - offset);
    fs.readSync(fd, buf, 0, buf.length, offset); fs.closeSync(fd);
    offset = size;
    const lines = (rest + buf.toString('utf8')).split('\n'); rest = lines.pop();
    for (const line of lines) {
      if (!line.trim()) continue;
      try { const e = JSON.parse(line); if (e.t === 'runStart') { pid = e.pid; ended = false; } if (e.t === 'runEnd') ended = true; } catch { continue; }
      res.write(`event: ev\ndata: ${line}\n\n`);
    }
  };
  const status = () => send('status', { alive: pid ? alive(pid) : false, ended, now: Date.now() });
  pump(); status();
  const t1 = setInterval(pump, 400);
  const t2 = setInterval(status, 3000);
  req.on('close', () => { clearInterval(t1); clearInterval(t2); });
}

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------
// Starting runs (2026-11-19). The page has three buttons: Smoke, E2E, API. Each launches the existing runner as a detached hidden process, exactly like typing the command:
//   Smoke  node scripts/smoke-run.js [--stages preflight,tier0,tier1,tier2]
//   E2E    node scripts/suite-run.js [--only <text>] [--fix-fixtures]     (the full suite, API specs included; headed specs first)
//   API    node scripts/suite-run.js --only tests/API/ [--fix-fixtures]
// Guards: (1) never starts while a run is active (live feed with a living runner pid and no runEnd) or a Playwright / runner process is running (every spec logs in as the same account on
// TST703, two concurrent logins corrupt results); (2) POST only, JSON body, custom header, Host and Origin must be this server on localhost (blocks other web pages and DNS rebinding);
// (3) arguments are validated and passed as an array (no shell); (4) the page asks for a confirmation that spells out the headed / hands-off warning. Stop = taskkill of the runner's process tree.
// Console output of a launched run goes to reports/suite-ui-launches/<stamp>-<suite>.log.
const LAUNCH_DIR = path.join(DATA, 'reports', 'suite-ui-launches');
const SMOKE_STAGES = ['preflight', 'tier0', 'tier1', 'tier2'];

function runInfo(file) { // last runStart's pid + whether a runEnd followed it
  let text; try { text = fs.readFileSync(file, 'utf8'); } catch { return undefined; }
  let pid = 0; let ended = false; let first;
  for (const line of text.split('\n')) {
    if (line.includes('"t":"runStart"')) { try { const e = JSON.parse(line); pid = e.pid || 0; ended = false; first = first || e; } catch { /* partial line */ } }
    else if (line.includes('"t":"runEnd"')) ended = true;
  }
  return { pid, ended, first };
}

function activeRun() { // newest live runs only (a run older than a day cannot be active)
  for (const r of listRuns().filter((x) => x.live && Date.now() - x.mtime < 86400000).slice(0, 4)) {
    const info = runInfo(path.join(runDir(r.id), 'live.ndjson'));
    if (info && info.pid && !info.ended && alive(info.pid)) return { id: r.id, pid: info.pid, suite: r.suite };
  }
  return null;
}

const PS_SCAN = String.raw`Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match 'suite-run\.js|smoke-run\.js|npx-cli\.js\s+playwright|@playwright[\\/]test[\\/]cli\.js\s+test(\s|$)|workerProcessEntry' -and $_.CommandLine -notmatch 'suite-ui|ensure-suite-ui' } | ForEach-Object { "$($_.ProcessId)|$($_.CommandLine)" }`;
function scanBusy() { // runner / Playwright processes that are not in a live feed (a run started with an old runner, a plain `npx playwright test` in a terminal)
  return new Promise((resolve) => {
    execFile('powershell', ['-NoProfile', '-NonInteractive', '-Command', PS_SCAN], { timeout: 15000, windowsHide: true }, (err, stdout) => {
      resolve(String(stdout || '').split(/\r?\n/).filter(Boolean).map((l) => { const i = l.indexOf('|'); return { pid: Number(l.slice(0, i)), cmd: l.slice(i + 1).replace(/\s+/g, ' ').slice(0, 160) }; }));
    });
  });
}

function buildLaunch(body) {
  const fail = (m) => { const e = new Error(m); e.status = 400; throw e; };
  const fix = body.fixFixtures === true ? ['--fix-fixtures'] : [];
  if (body.suite === 'smoke') {
    const stages = Array.isArray(body.stages) ? SMOKE_STAGES.filter((s) => body.stages.includes(s)) : SMOKE_STAGES;
    if (!stages.length) fail('pick at least one smoke stage');
    return { label: 'Smoke', script: 'smoke-run.js', args: ['--stages', stages.join(',')] };
  }
  if (body.suite === 'e2e') {
    const args = []; // the full suite, API specs included (the API card runs them on their own)
    if (body.only) { if (!/^[\w\/.\- ]{1,80}$/.test(String(body.only))) fail('the filter text may only contain letters, digits, space and / . _ -'); args.push('--only', String(body.only).trim()); }
    return { label: 'E2E', script: 'suite-run.js', args: [...args, ...fix] };
  }
  if (body.suite === 'api') return { label: 'API', script: 'suite-run.js', args: ['--only', 'tests/API/', ...fix] };
  return fail('unknown suite');
}

let lastLaunch = 0; // double-click guard: the new run's live feed only appears a few seconds after the process starts
async function startRun(body) {
  const L = buildLaunch(body);
  const busy = (msg) => { const e = new Error(msg); e.status = 409; return e; };
  if (Date.now() - lastLaunch < 25000) throw busy('A run was just launched; wait for it to appear.');
  const act = activeRun();
  if (act) throw busy(`A ${act.suite} run is already in progress (${act.id}, pid ${act.pid}). Wait for it to finish or stop it first.`);
  const procs = await scanBusy();
  if (procs.length) throw busy(`A test process is already running (pid ${procs[0].pid}: ${procs[0].cmd}). Two runs against the same environment at once corrupt results, so nothing was started.`);
  fs.mkdirSync(LAUNCH_DIR, { recursive: true });
  const d = new Date(); const pad = (n) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  const logFile = path.join(LAUNCH_DIR, `${stamp}-${L.label}.log`);
  const fd = fs.openSync(logFile, 'a');
  const child = spawn(process.execPath, [path.join(__dirname, L.script), ...L.args], { cwd: ROOT, detached: true, stdio: ['ignore', fd, fd], windowsHide: true, env: process.env });
  child.unref(); fs.closeSync(fd);
  lastLaunch = Date.now();
  console.log(`${new Date().toISOString()} started ${L.label}: node scripts/${L.script} ${L.args.join(' ')} (pid ${child.pid}, log ${logFile})`);
  return { ok: true, label: L.label, pid: child.pid, command: `node scripts/${L.script} ${L.args.join(' ')}`, log: logFile };
}

function stopRun() {
  const act = activeRun();
  if (!act) { const e = new Error('No run is active.'); e.status = 409; throw e; }
  // /T kills the runner and every Playwright / browser process below it; the runner cannot write its own runEnd then, so the page's server records it
  return new Promise((resolve) => {
    execFile('taskkill', ['/PID', String(act.pid), '/T', '/F'], { windowsHide: true }, () => {
      try { fs.appendFileSync(path.join(runDir(act.id), 'live.ndjson'), JSON.stringify({ ts: Date.now(), t: 'runEnd', status: 'aborted', signal: 'stopped from the live page' }) + '\n'); } catch { /* ignore */ }
      console.log(`${new Date().toISOString()} stopped ${act.suite} run ${act.id} (pid ${act.pid})`);
      resolve({ ok: true, stopped: act });
    });
  });
}

// Pause / resume (2026-11-20): cooperative, between spec files (suite) or stages (smoke). Pause = create <run folder>/pause.flag; the runner holds before its next spec file / stage while the flag
// exists (the file that is running finishes: a spec cannot be frozen safely mid-test). Resume = remove the flag. Same guards as start / stop (this computer only).
const pauseFlagOf = (id) => path.join(runDir(id), 'pause.flag');
const liveEvent = (id, ev) => { try { fs.appendFileSync(path.join(runDir(id), 'live.ndjson'), JSON.stringify({ ts: Date.now(), ...ev }) + '\n'); } catch { /* ignore */ } };
function pauseRun() {
  const act = activeRun();
  if (!act) { const e = new Error('No run is active.'); e.status = 409; throw e; }
  fs.writeFileSync(pauseFlagOf(act.id), new Date().toISOString());
  liveEvent(act.id, { t: 'pause', state: 'requested' });
  console.log(`${new Date().toISOString()} pause requested for ${act.suite} run ${act.id}`);
  return { ok: true, run: act };
}
function resumeRun() {
  const act = activeRun();
  if (!act) { const e = new Error('No run is active.'); e.status = 409; throw e; }
  const f = pauseFlagOf(act.id);
  if (!exists(f)) { const e = new Error('The run is not paused.'); e.status = 409; throw e; }
  fs.unlinkSync(f);
  liveEvent(act.id, { t: 'pause', state: 'cancelled' }); // the runner adds "resumed" itself if it was already holding; if the pause was only requested this cancels it
  console.log(`${new Date().toISOString()} resumed ${act.suite} run ${act.id}`);
  return { ok: true, run: act };
}

// same-origin guard for the POST endpoints
function sameOrigin(req) {
  const ok = new Set([`127.0.0.1:${PORT}`, `localhost:${PORT}`]);
  if (!ok.has(String(req.headers.host || '').toLowerCase())) return false;
  if (req.headers.origin && ![`http://127.0.0.1:${PORT}`, `http://localhost:${PORT}`].includes(req.headers.origin)) return false;
  return req.headers['x-suite-ui'] === '1' && /^application\/json/i.test(req.headers['content-type'] || '');
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let s = ''; req.on('data', (c) => { s += c; if (s.length > 10000) { reject(new Error('body too large')); req.destroy(); } });
    req.on('end', () => { try { resolve(s ? JSON.parse(s) : {}); } catch { reject(new Error('bad JSON')); } });
    req.on('error', reject);
  });
}
const sendJson = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------
// Report download (2026-11-20): GET /report?run=<id>&fmt=html|md  ->  the run's report.md (written by suite-run.js / smoke-report.js when a run ends) as a file download.
//   md   the report.md as it is
//   html one self-contained page (styles inline, opens in any browser, prints cleanly) = the same report + the failure screenshots embedded
// A run that never wrote a report (stopped / killed) gets one built on demand, but only from this computer (it writes files into the run folder); other computers only get existing reports.
// A run that is still in progress has no report yet (409).
const escHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const inlineMd = (s) => escHtml(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>');
function mdToHtml(md) { // only what the two report builders emit: # headings, - bullets, | tables, **bold**, `code`, paragraphs
  const out = []; const lines = md.split(/\r?\n/); let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    let m;
    if ((m = /^(#{1,3}) (.*)$/.exec(l))) { out.push(`<h${m[1].length}>${inlineMd(m[2])}</h${m[1].length}>`); i++; }
    else if (/^\|/.test(l)) {
      const rows = []; while (i < lines.length && /^\|/.test(lines[i])) rows.push(lines[i++]);
      const cells = (r) => r.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const head = cells(rows[0]); const align = rows[1] && /^[\s|:\-]+$/.test(rows[1]) ? cells(rows[1]).map((c) => (/:$/.test(c) ? ' class="n"' : '')) : []; const body = rows.slice(align.length ? 2 : 1);
      out.push(`<table><thead><tr>${head.map((c, k) => `<th${align[k] || ''}>${inlineMd(c)}</th>`).join('')}</tr></thead><tbody>${body.map((r) => `<tr>${cells(r).map((c, k) => `<td${align[k] || ''}>${inlineMd(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
    } else if (/^- /.test(l)) { const items = []; while (i < lines.length && /^- /.test(lines[i])) items.push(lines[i++].slice(2)); out.push(`<ul>${items.map((t) => `<li>${inlineMd(t)}</li>`).join('')}</ul>`); }
    else if (l.trim()) { out.push(`<p>${inlineMd(l)}</p>`); i++; } else i++;
  }
  return out.join('\n');
}

function failureShots(dir) { // failed tests of the run that have a screenshot, from the live feed
  const out = [];
  try {
    for (const line of fs.readFileSync(path.join(dir, 'live.ndjson'), 'utf8').split('\n')) {
      if (!line.includes('"status":"failed"') || !line.includes('"shot"')) continue;
      try { const e = JSON.parse(line); const p = path.join(dir, 'shots', e.shot || ''); if (e.shot && /^[\w.\-]+\.(png|jpe?g)$/i.test(e.shot) && exists(p)) out.push({ title: e.title, file: e.file, error: e.error, p, ext: /png$/i.test(e.shot) ? 'png' : 'jpeg' }); } catch { /* partial line */ }
    }
  } catch { /* no live feed */ }
  return out.slice(0, 60);
}

function buildReport(id, dir) {
  return new Promise((resolve) => {
    const kind = id.split('/')[0];
    const args = kind === 'smoke' ? [path.join(__dirname, 'smoke-report.js'), dir] : [path.join(__dirname, 'suite-run.js'), '--report', dir];
    execFile(process.execPath, args, { timeout: 60000, windowsHide: true, cwd: ROOT }, () => resolve(exists(path.join(dir, 'report.md'))));
  });
}

async function sendReport(req, res, u) {
  const text = (code, msg) => { res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end(msg); };
  const id = u.searchParams.get('run'); const fmt = u.searchParams.get('fmt') === 'md' ? 'md' : 'html';
  const dir = runDir(id);
  if (!dir || !exists(dir)) return text(404, 'unknown run');
  const info = runInfo(path.join(dir, 'live.ndjson'));
  if (info && info.pid && !info.ended && alive(info.pid)) return text(409, 'This run is still in progress; its report is written when it ends.');
  const file = path.join(dir, 'report.md');
  if (!exists(file)) {
    if (!isLoopback(req)) return text(404, 'This run has no report (it did not finish). A report can be built from the computer the tests run on.');
    if (!(await buildReport(id, dir))) return text(500, 'The report could not be built for this run.');
  }
  const md = fs.readFileSync(file, 'utf8');
  const base = `ROBAR-${(suiteLabel(info && info.first, id.split('/')[0]) || 'run').replace(/[^\w]+/g, '-')}-${id.split('/')[1]}-report`;
  if (fmt === 'md') { res.writeHead(200, { 'Content-Type': 'text/markdown; charset=utf-8', 'Content-Disposition': `attachment; filename="${base}.md"` }); res.end(md); return; }
  const shots = failureShots(dir).map((s) => `<figure><figcaption><b>${escHtml(s.title)}</b><br><span>${escHtml(s.file)}</span>${s.error ? `<br><span>${escHtml(s.error)}</span>` : ''}</figcaption><img alt="failure screenshot" src="data:image/${s.ext};base64,${fs.readFileSync(s.p).toString('base64')}"></figure>`).join('\n');
  const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escHtml(base)}</title><style>
body{font:14px/1.5 system-ui,"Segoe UI",sans-serif;color:#1c2430;max-width:1100px;margin:24px auto;padding:0 16px}h1{font-size:22px}h2{font-size:17px;margin-top:26px;border-bottom:1px solid #e3e7ee;padding-bottom:4px}
table{border-collapse:collapse;margin:8px 0}th,td{border:1px solid #e3e7ee;padding:4px 10px;text-align:left}th{background:#f3f5f8}td.n,th.n{text-align:right;font-variant-numeric:tabular-nums}
li{margin:3px 0;word-break:break-word}code{background:#f3f5f8;padding:1px 4px;border-radius:3px}figure{margin:14px 0;page-break-inside:avoid}figcaption{font-size:13px;margin-bottom:4px}figcaption span{color:#667085}
img{max-width:100%;border:1px solid #e3e7ee}@media print{body{margin:0}}</style></head><body>${mdToHtml(md)}${shots ? `<h2>Failure screenshots (${failureShots(dir).length})</h2>${shots}` : ''}</body></html>`;
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Disposition': `attachment; filename="${base}.html"` });
  res.end(page);
}

const PAGE = path.join(__dirname, 'suite-ui.html');
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  try {
    if (!authOk(req)) { res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="ROBAR live run"', 'Content-Type': 'text/plain' }); res.end('login required'); return; }
    if (req.method === 'POST' && ['/api/start', '/api/stop', '/api/pause', '/api/resume'].includes(u.pathname)) {
      if (!isLoopback(req)) return sendJson(res, 403, { error: 'view only: runs can only be started or stopped from the computer the tests run on (http://127.0.0.1:' + PORT + ')' });
      if (!sameOrigin(req)) return sendJson(res, 403, { error: 'rejected: requests must come from this page on localhost' });
      try { return sendJson(res, 200, u.pathname === '/api/start' ? await startRun(await readBody(req)) : u.pathname === '/api/pause' ? pauseRun() : u.pathname === '/api/resume' ? resumeRun() : await stopRun()); }
      catch (e) { return sendJson(res, e.status || 500, { error: String(e.message || e) }); }
    }
    if (u.pathname === '/report') return await sendReport(req, res, u);
    if (u.pathname === '/api/state') { const a = activeRun(); return sendJson(res, 200, { active: a && { ...a, pauseFlag: exists(pauseFlagOf(a.id)) }, launching: Date.now() - lastLaunch < 25000, canControl: isLoopback(req) }); }
    if (u.pathname === '/') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' }); res.end(fs.readFileSync(PAGE)); return; }
    if (u.pathname === '/logo.png') { res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'max-age=86400' }); res.end(fs.readFileSync(path.join(__dirname, 'suite-ui-logo.png'))); return; } // ROBAR by Innovatum logo (Web Menu login page, Images/LoginLogo.bmp)
    if (u.pathname === '/api/runs') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(listRuns())); return; }
    if (u.pathname === '/api/history') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(history())); return; }
    if (u.pathname === '/events') return sse(req, res, u.searchParams.get('run'));
    if (u.pathname === '/shot') {
      const d = runDir(u.searchParams.get('run')); const f = u.searchParams.get('f') || '';
      if (!d || !/^[\w.\-]+\.(png|jpe?g)$/i.test(f)) { res.writeHead(404); res.end(); return; }
      const p = path.join(d, 'shots', f);
      if (!exists(p)) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': /png$/i.test(f) ? 'image/png' : 'image/jpeg', 'Cache-Control': 'max-age=3600' }); fs.createReadStream(p).pipe(res); return;
    }
    res.writeHead(404); res.end('not found');
  } catch (e) { res.writeHead(500); res.end(String(e && e.message)); }
});
server.on('error', (e) => { console.error(e.code === 'EADDRINUSE' ? `port ${PORT} is in use (another suite-ui running? try --port)` : String(e)); process.exit(1); });
server.listen(PORT, HOST, () => {
  const url = `http://127.0.0.1:${PORT}/`;
  const net = HOST === '127.0.0.1' || HOST === 'localhost' || HOST === '::1' ? 'this computer only' : `the network (${HOST})${AUTH ? ', login required off this computer' : ', NO login'}`;
  console.log(`ROBAR live progress: ${url}   visible to: ${net}; start / stop of runs only from this computer (Ctrl+C to stop)`);
  if (net.startsWith('the network')) console.log(`  network address: http://${require('os').hostname()}:${PORT}/`);
  if (argv.includes('--open')) exec(`start "" "${url}"`);
});
