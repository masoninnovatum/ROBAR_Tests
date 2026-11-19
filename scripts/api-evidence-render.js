#!/usr/bin/env node
// Renders the evidence JSON that the REST API specs write (runs/API/<suite>_<stamp>/<requirement id>.json) as PNG screenshots for the Result column of a project-level UAT:
// one image per API call (method + full URL, user, request body, status + response body) and one per SQL check (query + result table). Setup calls are hidden unless --all.
//
//   node scripts/api-evidence-render.js [evidence dir] [--all] [--only F.3.]
//
// Default evidence dir = the newest runs/API/Items_* folder. Output: <dir>/screenshots/<requirement id>/<nn>_http|sql.png, <dir>/screenshots/index.json (id -> files) and
// <dir>/screenshots/index.html (contact sheet). Passwords and Authorization headers are never in the evidence, so they cannot appear in an image.
const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');

const args = process.argv.slice(2);
const ALL = args.includes('--all');
const onlyIdx = args.indexOf('--only');
const ONLY = onlyIdx >= 0 ? args[onlyIdx + 1] : null;
const scaleIdx = args.indexOf('--scale');
const SCALE = scaleIdx >= 0 ? Number(args[scaleIdx + 1]) || 1 : 1; // 2 = sharper pictures for Word (device scale factor)
const positional = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--only' && args[i - 1] !== '--scale' && args[i - 1] !== '--suite');
const apiRoot = path.join(__dirname, '..', 'runs', 'API');
const dir = positional[0] ? path.resolve(positional[0]) : (() => {
  // newest evidence folder (runs/API/<suite>_<yyyymmddThhmm>); --suite Items|DL|... limits it to one suite
  const sIdx = args.indexOf('--suite');
  const suite = sIdx >= 0 ? args[sIdx + 1] : '';
  const all = fs.readdirSync(apiRoot, { withFileTypes: true }).filter((e) => e.isDirectory() && /_\d{8}T\d{4}$/.test(e.name) && (!suite || e.name.startsWith(suite + '_')))
    .map((e) => ({ name: e.name, t: fs.statSync(path.join(apiRoot, e.name)).mtimeMs })).sort((a, b) => a.t - b.t);
  if (!all.length) throw new Error('no evidence folder in runs/API');
  return path.join(apiRoot, all[all.length - 1].name);
})();
const outDir = path.join(dir, 'screenshots');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const MAX_LINES = 110;

function jsonHtml(value) {
  let text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  if (text === undefined) text = '';
  let lines = text.split('\n');
  let cut = 0;
  if (lines.length > MAX_LINES) { cut = lines.length - MAX_LINES; lines = lines.slice(0, MAX_LINES); }
  const html = lines.map((l) => esc(l)
    .replace(/^(\s*)&quot;|^(\s*)"([^"]+)":/, (m) => m) // (no-op, keeps the line as is)
    .replace(/("(?:[^"\\]|\\.)*")(\s*:)/g, '<span class="k">$1</span>$2')
    .replace(/:\s*("(?:[^"\\]|\\.)*")/g, (m, v) => m.replace(v, `<span class="s">${v}</span>`))
    .replace(/:\s*(true|false|null|-?\d+(?:\.\d+)?)(,?)$/g, (m, v, c) => m.replace(v, `<span class="n">${v}</span>`))).join('\n');
  return html + (cut ? `\n<span class="cut">… ${cut} more line(s) not shown</span>` : '');
}

const CSS = `
*{box-sizing:border-box}body{margin:0;background:#fff;font:13px/1.45 Consolas,"Cascadia Mono",monospace;color:#1b1f23}
.card{width:1160px;border:1px solid #b8c0cc;background:#fff}
.bar{display:flex;gap:10px;align-items:center;padding:8px 12px;background:#e9eef5;border-bottom:1px solid #b8c0cc;font-family:Segoe UI,Arial,sans-serif;font-size:13px}
.bar .t{font-weight:600}.bar .sp{flex:1}.meth{background:#1f6feb;color:#fff;padding:1px 8px;border-radius:3px;font-weight:700}
.sql .meth{background:#6e40c9}.chip{padding:1px 8px;border-radius:3px;color:#fff;font-weight:700}.ok{background:#1a7f37}.warn{background:#9a6700}.err{background:#cf222e}
.url{padding:8px 12px;border-bottom:1px solid #d8dee6;word-break:break-all;background:#fafbfc}.meta{padding:4px 12px;color:#57606a;border-bottom:1px solid #d8dee6;font-family:Segoe UI,Arial,sans-serif;font-size:12px}
.sec{padding:6px 12px 0;font-family:Segoe UI,Arial,sans-serif;font-weight:600;color:#57606a;font-size:12px;text-transform:uppercase;letter-spacing:.04em}
pre{margin:0;padding:6px 12px 10px;white-space:pre-wrap;word-break:break-word}
.k{color:#0550ae}.s{color:#0a3069}.n{color:#953800}.cut{color:#8a2be2;font-style:italic}
table{border-collapse:collapse;margin:6px 12px 12px;font-size:12px}th,td{border:1px solid #c5ccd6;padding:3px 6px;text-align:left;white-space:normal;word-break:break-word;font-size:11px;vertical-align:top}th{background:#eef1f6;white-space:nowrap;word-break:normal}
.q{color:#0a3069}`;

const wrap = (inner, cls = '') => `<html><head><meta charset="utf-8"><style>${CSS}</style></head><body><div class="card ${cls}" id="c">${inner}</div></body></html>`;

// Big responses: keep the records that belong to this test (step.focus), summarise the rest, and shorten long attribute lists.
function compactBody(body, focus) {
  const note = [];
  let K = 3; // how many entries of a long list are shown (fewer when several records are shown)
  const shorten = (v) => {
    if (Array.isArray(v) && v.length > K && v.every((x) => x && typeof x === 'object')) return [...v.slice(0, K).map(shorten), '… ' + (v.length - K) + ' more item(s)'];
    if (Array.isArray(v)) return v.map(shorten);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shorten(x)]));
    return v;
  };
  if (body && typeof body === 'object' && Array.isArray(body.results)) {
    const total = body.results.length;
    let recs = body.results;
    if (focus && total > 3) {
      const mine = recs.filter((r) => JSON.stringify(r).includes(focus));
      if (mine.length && mine.length < total) { recs = mine; note.push(total + ' record(s) returned in total; ' + mine.length + ' created by this test run shown, ' + (total - mine.length) + ' other record(s) not shown'); }
    }
    K = recs.length >= 2 ? 1 : 3;
    const shownRecs = recs.slice(0, 6).map((r) => (r && r.attributes ? { ...r, attributes: shorten(r.attributes) } : shorten(r)));
    if (recs.length > 6) note.push((recs.length - 6) + ' more record(s) not shown');
    return { body: { ...body, results: shownRecs }, note };
  }
  return { body: shorten(body), note };
}

function httpCard(s) {
  const cls = s.status >= 500 ? 'err' : s.status >= 400 ? 'warn' : 'ok';
  const c = compactBody(s.responseBody, s.focus);
  const req = s.requestBody === undefined ? '' : `<div class="sec">Request body</div><pre>${jsonHtml(s.requestBody)}</pre>`;
  return wrap(
    `<div class="bar"><span class="meth">${esc(s.method)}</span><span class="t">${esc(s.title)}</span><span class="sp"></span><span class="chip ${cls}">HTTP ${s.status}</span><span>${s.ms} ms</span></div>` +
      `<div class="url">${esc(s.url)}</div>` +
      `<div class="meta">Authorization: Basic · user: ${s.user ? esc(s.user) : '(none - no Authorization header sent)'}${s.at ? ' · ' + esc(s.at.replace('T', ' ').slice(0, 19)) + ' UTC' : ''}</div>` +
      req +
      `<div class="sec">Response</div><pre>${jsonHtml(c.body)}</pre>` +
      (c.note.length ? `<div class="meta">${esc(c.note.join(' · '))}</div>` : ''),
  );
}

function sqlCard(s) {
  const rows = Array.isArray(s.rows) ? s.rows : [];
  const cols = [...new Set(rows.flatMap((r) => (r && typeof r === 'object' ? Object.keys(r) : [])))];
  const shown = rows.slice(0, 25);
  const table = cols.length
    ? `<table><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join('')}</tr>${shown.map((r) => `<tr>${cols.map((c) => `<td>${esc(r[c] ?? '')}</td>`).join('')}</tr>`).join('')}</table>` +
      (rows.length > shown.length ? `<div class="meta">… ${rows.length - shown.length} more row(s) not shown</div>` : '')
    : `<pre>${rows.length ? jsonHtml(rows) : '(no rows)'}</pre>`;
  return wrap(
    `<div class="bar"><span class="meth">SQL</span><span class="t">${esc(s.title)}</span><span class="sp"></span><span>${rows.length} row(s)</span></div>` +
      `<div class="meta">sqlcmd, read-only, Windows login${s.at ? ' · ' + esc(s.at.replace('T', ' ').slice(0, 19)) + ' UTC' : ''}</div>` +
      `<div class="sec">Query</div><pre class="q">${esc(s.query)}</pre><div class="sec">Result</div>${table}`,
    'sql',
  );
}

function logCard(s) {
  return wrap(
    `<div class="bar"><span class="meth" style="background:#57606a">LOG</span><span class="t">${esc(s.title)}</span><span class="sp"></span><span>${esc(s.source)}</span></div>` +
      `<div class="meta">server application log, read only${s.at ? ' · ' + esc(s.at.replace('T', ' ').slice(0, 19)) + ' UTC' : ''}</div>` +
      `<pre class="q">${s.lines.length ? s.lines.map(esc).join('\n') : '(no matching lines)'}</pre>`,
  );
}

// Five or more API calls in one requirement (for example "every endpoint rejects a call without credentials") become ONE overview table instead of five or more pictures.
const SUMMARY_FROM = 5;
const cut = (v, n) => { const t = v === undefined ? '' : typeof v === 'string' ? v : JSON.stringify(v); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
function summaryCard(calls) {
  const rows = calls.map((s, i) => {
    const cls = s.status >= 500 ? 'err' : s.status >= 400 ? 'warn' : 'ok';
    return `<tr><td>${i + 1}</td><td>${esc(s.method)} ${esc(s.url.replace(/^https?:\/\/[^\/]+/, ''))}</td><td style="white-space:nowrap">${s.user ? esc(s.user) : '(no credentials)'}</td><td style="white-space:nowrap"><span class="chip ${cls}" style="white-space:nowrap">${s.status}</span></td><td>${esc(cut(s.responseBody, 190))}</td></tr>`;
  }).join('');
  return wrap(
    `<div class="bar"><span class="meth">${esc(calls[0].method)}${new Set(calls.map((c) => c.method)).size > 1 ? ' / GET' : ''}</span><span class="t">${calls.length} API calls</span><span class="sp"></span><span>${esc(calls[0].url.replace(/^(https?:\/\/[^\/]+\/[^\/]+\/).*$/, '$1'))}</span></div>` +
      `<table style="width:calc(100% - 24px)"><tr><th>#</th><th>Call</th><th>User</th><th>HTTP</th><th>Response</th></tr>${rows}</table>`,
  );
}

const natural = (a, b) => a.localeCompare(b, undefined, { numeric: true });

(async () => {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'index.json').sort(natural)
    .filter((f) => !ONLY || f.includes(ONLY));
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: SCALE });
  const index = {};
  let images = 0;
  for (const f of files) {
    const ev = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const id = f.replace(/\.json$/, '');
    if (!ALL && !/\.[FU]\.\d/.test(id)) continue; // not a requirement row (for example the security restore step)
    let steps = ev.steps.filter((s) => (ALL || !s.setup) && !(s.kind === 'sql' && s.query === '' && !ALL));
    const httpSteps = steps.filter((s) => s.kind === 'http');
    if (!ALL && httpSteps.length >= SUMMARY_FROM) steps = [{ kind: 'summary', calls: httpSteps }, ...steps.filter((s) => s.kind !== 'http')];
    const idDir = path.join(outDir, id);
    fs.rmSync(idDir, { recursive: true, force: true });
    if (!steps.length) { index[id] = { test: ev.test, status: ev.status, files: [], annotations: ev.annotations || [] }; continue; }
    fs.mkdirSync(idDir, { recursive: true });
    const made = [];
    let n = 0;
    for (const s of steps) {
      n++;
      await page.setContent(s.kind === 'summary' ? summaryCard(s.calls) : s.kind === 'http' ? httpCard(s) : s.kind === 'log' ? logCard(s) : sqlCard(s));
      const file = `${String(n).padStart(2, '0')}_${s.kind}.png`;
      await page.locator('#c').screenshot({ path: path.join(idDir, file) });
      made.push(`${id}/${file}`);
      images++;
    }
    index[id] = { test: ev.test, status: ev.status, files: made, annotations: ev.annotations || [] };
  }
  await browser.close();
  fs.writeFileSync(path.join(outDir, 'index.json'), JSON.stringify(index, null, 2));
  const html = `<html><head><meta charset="utf-8"><title>API evidence</title><style>body{font:14px Segoe UI,Arial,sans-serif;margin:16px;background:#f6f8fa}h2{margin:24px 0 4px}.a{color:#9a6700;font-size:12px}img{max-width:100%;border:1px solid #c5ccd6;margin:6px 0;display:block}.f{color:#cf222e}</style></head><body><h1>${esc(path.basename(dir))}</h1>` +
    Object.entries(index).map(([id, v]) => `<h2 class="${v.status === 'passed' ? '' : 'f'}">${esc(v.test)} <small>(${esc(v.status)})</small></h2>` + (v.annotations || []).map((a) => `<div class="a">wording difference: ${esc(a)}</div>`).join('') +
      v.files.map((p) => `<img src="${p}">`).join('')).join('\n') + '</body></html>';
  fs.writeFileSync(path.join(outDir, 'index.html'), html);
  console.log(`${images} image(s) for ${Object.keys(index).length} requirement(s) -> ${outDir}`);
})().catch((e) => { console.error(e); process.exit(1); });
