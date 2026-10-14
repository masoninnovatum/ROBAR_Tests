// Builds the one-page smoke report (report.md) from the per-stage Playwright JSON files of one run folder (see scripts/smoke-run.js).
//   node scripts/smoke-report.js reports/smoke/runs/<stamp>
// Failures get a first-guess class from the error text (environment / infrastructure / possible regression / unclassified). The class is a HINT for the person (or the Claude skill) who
// reads the evidence: "known deviation" is never guessed here, because deviations are annotations on tests that stay green (listed separately).

const fs = require('fs');
const path = require('path');

const dir = path.resolve(process.argv[2] ?? '');
if (!dir || !fs.existsSync(dir)) { console.error('usage: node scripts/smoke-report.js <run folder>'); process.exit(2); }

const ORDER = ['preflight', 'tier0', 'tier1', 'tier2'];
const LABEL = { preflight: 'Preflight (environment readiness)', tier0: 'Tier 0 (menu tiles, modules open, grids retrieve)', tier1: 'Tier 1 (writes data: item chain, MDM, import, dictionary, attachment, export master)', tier2: 'Tier 2 (headed: template workflow, Print by Lot to PDF, serialized print)' };

function* walk(suite, file) {
  for (const spec of suite.specs ?? []) for (const test of spec.tests ?? []) yield { spec, test, file: spec.file || file };
  for (const s of suite.suites ?? []) yield* walk(s, s.file || file);
}

const clean = (s) => String(s ?? '').replace(/\x1b\[[0-9;]*m/g, '').replace(/\s+/g, ' ').trim();

function classify(text) {
  const t = text;
  if (/environment not ready/i.test(t)) return ['Environment / configuration', 'a setting, config or build is not as the suite expects (see the preflight lines); fix the environment, do not change the tests'];
  if (/Page crashed|Target page, context or browser has been closed|net::ERR|ECONNREFUSED|ENOTFOUND|socket hang up/i.test(t)) return ['Infrastructure (retry once)', 'browser or network hiccup; rerun that stage once before investigating'];
  if (/BarTender|Sentinel|Signature Required|FlaUI|Gave up after|Template Editor|SentinelLauncher/i.test(t)) return ['Environment: BarTender / Sentinel / desktop', 'the headed desktop chain failed (someone touched the mouse, a prompt stole focus, BarTender was slow); rerun with hands off, then check the Sentinel client'];
  if (/Server Error|Unhandled|Internal Server Error|status.*5\d\d|Javascript is not functioning/i.test(t)) return ['Possible product regression', 'the product returned an error page or a script error; capture the page, check the DIT tracker for a known match'];
  if (/Timeout \d+ms exceeded|waiting for|toHaveCount|toBeVisible|toBeGreaterThan|Expected|Received/i.test(t)) return ['Unclassified: changed behaviour or slow page', 'an expectation did not hold; look at the screenshot, then decide regression vs. changed UI vs. flake (rerun once)'];
  return ['Unclassified', 'investigate'];
}

const stages = [];
for (const stage of ORDER) {
  const f = path.join(dir, `${stage}.json`);
  if (!fs.existsSync(f)) continue;
  let j;
  try { j = JSON.parse(fs.readFileSync(f, 'utf8')); } catch { continue; }
  const rows = [];
  for (const s of j.suites ?? []) for (const { spec, test, file } of walk(s, s.file)) {
    const last = (test.results ?? []).slice(-1)[0] ?? {};
    const err = clean((last.errors ?? []).map((e) => e.message).join(' | ') || last.error?.message || '');
    rows.push({
      title: spec.title, file, status: test.status === 'expected' ? 'passed' : test.status === 'skipped' ? 'skipped' : test.status === 'flaky' ? 'flaky' : 'failed',
      ms: (test.results ?? []).reduce((a, r) => a + (r.duration ?? 0), 0), err, annotations: test.annotations ?? [],
      shots: (last.attachments ?? []).filter((a) => a.path).map((a) => path.basename(path.dirname(a.path)) + '__' + path.basename(a.path)),
    });
  }
  stages.push({ stage, rows, wall: j.stats?.duration ?? 0 });
}

const all = stages.flatMap((s) => s.rows);
const failed = all.filter((r) => r.status === 'failed');
const flaky = all.filter((r) => r.status === 'flaky');
const preflight = stages.find((s) => s.stage === 'preflight');
const facts = (preflight?.rows ?? []).flatMap((r) => r.annotations).find((a) => a.type === 'preflight facts')?.description ?? '';
const build = (facts.match(/build banner = ([\d.]+)/) ?? [])[1] ?? 'unknown';
const mins = (ms) => (ms / 60000).toFixed(1);
const verdict = !stages.length ? 'NO RESULTS' : failed.length ? 'FAIL' : flaky.length ? 'PASS (with flaky retries)' : 'PASS';

const L = [];
L.push(`# ROBAR smoke test report`);
L.push('');
L.push(`**Verdict: ${verdict}** | build ${build} | run ${path.basename(dir)} | ${all.length} tests: ${all.filter((r) => r.status === 'passed').length} passed, ${failed.length} failed, ${all.filter((r) => r.status === 'skipped').length} skipped, ${flaky.length} flaky`);
L.push('');
L.push('| Stage | Tests | Passed | Failed | Minutes |');
L.push('|---|---|---|---|---|');
for (const s of stages) L.push(`| ${LABEL[s.stage]} | ${s.rows.length} | ${s.rows.filter((r) => r.status === 'passed').length} | ${s.rows.filter((r) => r.status === 'failed').length} | ${mins(s.wall)} |`);
const ran = new Set(stages.map((s) => s.stage));
const notRun = ORDER.filter((s) => !ran.has(s));
if (notRun.length) L.push(``, `Not run: ${notRun.join(', ')}${ran.has('preflight') && preflight.rows.some((r) => r.status === 'failed') ? ' (preflight failed: the environment is not ready)' : ''}.`);
L.push('');

if (failed.length) {
  L.push('## Failures');
  for (const r of failed) {
    const [cls, hint] = classify(r.err);
    L.push('', `### ${r.title}`, `- File: ${r.file}`, `- First guess: **${cls}** - ${hint}`, `- Error: ${r.err.slice(0, 500) || '(none captured)'}`);
    if (r.shots.length) L.push(`- Evidence: ${r.shots.map((x) => `attachments/${x}`).join(', ')}`);
  }
  L.push('');
}
if (flaky.length) L.push('## Flaky (passed on retry)', ...flaky.map((r) => `- ${r.title}`), '');

const dev = all.flatMap((r) => r.annotations.filter((a) => /^deviation/.test(a.type)).map((a) => `${a.type}: ${clean(a.description).slice(0, 160)} (${r.title.slice(0, 50)})`));
const notes = all.flatMap((r) => r.annotations.filter((a) => a.type === 'new tiles').map((a) => `New Main Menu tile(s): ${a.description}`));
if (dev.length || notes.length) L.push('## Notes (not failures)', ...dev.map((x) => `- Known deviation annotation: ${x}`), ...notes.map((x) => `- ${x}`), '');

if (facts) L.push('## Preflight facts', '', facts.split('; ').map((x) => `- ${x}`).join('\n'), '');
L.push('## Left behind on the environment (cannot be deleted)', '- Tier 1: one CLSmkItm item, CLSmkMdm record, two CLSmkXl records, one CLSmkDict phrase, one CLSmkAtt attachment group, an Export Master item per run.',
  '- Tier 2: one CLSmkTpl template and its workflow, print history rows, PID_*.pdf files in the OneDrive Documents folder of the Sentinel client user.', '');
L.push('## What this report does not do', '- It never changes settings and never files tickets; findings go to docs/agents/dit-tracker.md for the user to review.');

fs.writeFileSync(path.join(dir, 'report.md'), L.join('\n') + '\n');
console.log(`report: ${path.join(dir, 'report.md')}`);
console.log(`verdict: ${verdict}`);
