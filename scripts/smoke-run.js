// Runs the ROBAR smoke stages in order, one Playwright JSON result file per stage, then builds the one-page report (scripts/smoke-report.js).
//   node scripts/smoke-run.js                      all stages: preflight, tier0, tier1, tier2
//   node scripts/smoke-run.js --stages tier0,tier1
//   node scripts/smoke-run.js --continue           keep going after a failed preflight (default: stop, the environment is not ready)
// Output: reports/smoke/runs/<yyyymmdd-hhmmss>/ (<stage>.json, attachments/<stage>/*, report.md). Playwright clears test-results between stages, so failure screenshots are copied right after each stage.
// tier2 is HEADED and uses the real mouse (FlaUI): nobody may touch the mouse or keyboard while it runs. Nothing here changes settings or files tickets.

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const STAGES = {
  preflight: ['tests/Smoke/preflight'],
  tier0: ['tests/Smoke/tier0'],
  tier1: ['--grep', '@tier1'],
  tier2: ['--grep', '@tier2'],
};

const argv = process.argv.slice(2);
const opt = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
const stages = (opt('--stages') ?? 'preflight,tier0,tier1,tier2').split(',').map((s) => s.trim()).filter(Boolean);
const keepGoing = argv.includes('--continue');
for (const s of stages) if (!STAGES[s]) { console.error(`unknown stage "${s}" (use ${Object.keys(STAGES).join(', ')})`); process.exit(2); }

const pad = (n) => String(n).padStart(2, '0');
const d = new Date();
const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
const outDir = path.join(ROOT, 'reports', 'smoke', 'runs', stamp);
fs.mkdirSync(path.join(outDir, 'attachments'), { recursive: true });

function* walkTests(suite) {
  for (const spec of suite.specs ?? []) for (const t of spec.tests ?? []) yield { spec, test: t };
  for (const s of suite.suites ?? []) yield* walkTests(s);
}

let preflightFailed = false;
for (const stage of stages) {
  console.log(`\n=== SMOKE STAGE ${stage} ===`);
  const jsonFile = path.join(outDir, `${stage}.json`);
  const r = spawnSync('npx', ['playwright', 'test', ...STAGES[stage], '--reporter=list,json'], {
    cwd: ROOT, stdio: 'inherit', shell: true, env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: jsonFile },
  });
  // keep the failure evidence: test-results is wiped by the next Playwright run
  if (fs.existsSync(jsonFile)) {
    try {
      const j = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
      for (const s of j.suites ?? []) for (const { test } of walkTests(s)) for (const res of test.results ?? []) for (const a of res.attachments ?? []) {
        if (!a.path || !fs.existsSync(a.path)) continue;
        const dest = path.join(outDir, 'attachments', stage);
        fs.mkdirSync(dest, { recursive: true });
        fs.copyFileSync(a.path, path.join(dest, `${path.basename(path.dirname(a.path))}__${path.basename(a.path)}`));
      }
    } catch (e) { console.log(`(could not copy attachments for ${stage}: ${String(e).slice(0, 100)})`); }
  }
  if (stage === 'preflight' && r.status !== 0) {
    preflightFailed = true;
    if (!keepGoing) { console.log('\nPreflight failed: the environment is not ready, so the later stages were NOT run (use --continue to run them anyway).'); break; }
  }
}

console.log(`\nBuilding the report in ${outDir}`);
spawnSync('node', [path.join(__dirname, 'smoke-report.js'), outDir], { cwd: ROOT, stdio: 'inherit', shell: true });
if (preflightFailed) process.exitCode = 1;
