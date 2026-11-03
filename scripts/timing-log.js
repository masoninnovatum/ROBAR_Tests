// Appends a timestamped line to reports/script-creation-timing/<project>.log and prints the elapsed time since START.   node scripts/timing-log.js <project> <START|STEP|END> "<note>"
const fs = require('fs');
const path = require('path');
const [project, kind, ...rest] = process.argv.slice(2);
const file = path.join(__dirname, '..', 'reports', 'script-creation-timing', `${project}.log`);
fs.mkdirSync(path.dirname(file), { recursive: true });
const now = new Date();
let startMs = now.getTime();
if (fs.existsSync(file)) { const m = /^(\S+) \| START/m.exec(fs.readFileSync(file, 'utf8')); if (m) startMs = new Date(m[1]).getTime(); }
const el = Math.round((now.getTime() - startMs) / 1000);
fs.appendFileSync(file, `${now.toISOString()} | ${kind} | +${Math.floor(el / 60)}m${String(el % 60).padStart(2, '0')}s | ${rest.join(' ')}\n`);
console.log(`${kind} +${Math.floor(el / 60)}m${String(el % 60).padStart(2, '0')}s ${rest.join(' ')}`);
