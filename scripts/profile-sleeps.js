// Measures how much of each spec's run time is FIXED sleeping: preloads a patch that sums page.waitForTimeout / frame.waitForTimeout, runs each spec file once through the Playwright CLI directly
// (NODE_OPTIONS does not survive npx here) and prints "seconds slept / seconds run". Helper `delay()` calls (custom setTimeout sleeps in support files) are NOT counted: the real share is higher.
//   node scripts/profile-sleeps.js tests/Master-Data-Management/Quick_Edit.spec.ts tests/Lot-Management/Lot_Management_Requirements.spec.ts ...
// Needs the preload file written next to this script (scripts/_sleepprofile.js).
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const preload = path.join(__dirname, '_sleepprofile.js');
const outDir = path.join(os.tmpdir(), 'sleepprof');
fs.mkdirSync(outDir, { recursive: true });
const specs = process.argv.slice(2);
const rows = [];
for (const spec of specs) {
  for (const f of fs.readdirSync(outDir)) fs.unlinkSync(path.join(outDir, f));
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [path.join(ROOT, 'node_modules', '@playwright', 'test', 'cli.js'), 'test', spec, '--workers=1', '--reporter=line'], {
    cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28, env: { ...process.env, NODE_OPTIONS: `--require ${preload.replace(/\\/g, '/')}`, SLEEPPROF_DIR: outDir },
  });
  const secs = (Date.now() - t0) / 1000;
  let slept = 0, calls = 0;
  for (const f of fs.readdirSync(outDir)) { const j = JSON.parse(fs.readFileSync(path.join(outDir, f), 'utf8')); slept += j.total; calls += j.calls; }
  const status = /passed/.test(r.stdout + r.stderr) ? 'pass' : /skipped/.test(r.stdout + r.stderr) ? 'skip' : 'FAIL';
  rows.push({ spec, status, run: secs, slept: slept / 1000, calls });
  console.log(`${status.padEnd(4)} run ${secs.toFixed(0).padStart(4)} s  slept ${(slept / 1000).toFixed(0).padStart(4)} s (${((slept / 1000 / secs) * 100).toFixed(0).padStart(2)} %)  ${calls} calls  ${spec}`);
}
const tr = rows.reduce((s, x) => s + x.run, 0), ts = rows.reduce((s, x) => s + x.slept, 0);
console.log(`TOTAL run ${(tr / 60).toFixed(1)} min, slept ${(ts / 60).toFixed(1)} min (${((ts / tr) * 100).toFixed(0)} %)`);
