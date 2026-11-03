// Turns reports/formal-script-scan-share.csv (scripts/scan-word-properties.ps1) into writing time and execution time per script and per person.
// Word's Total editing time accumulates inside a file and is carried along when a script is copied, so the time spent on a version is the DIFFERENCE to the copy it came from:
//   execution time = Executed copy minus the For_Execution copy of the same release;
//   writing time   = For_Execution copy minus the closest earlier copy (of the same script, earlier release) whose total is not larger (the copy it was probably made from).
// Attributed to the person who last saved the copy (Last Saved By). Ben Faulkner and Dana Buker (original template authors) are excluded.   node scripts/analyze-script-times.js
const fs = require('fs');
const path = require('path');

const INS = ['formal-script-scan-share.csv', 'formal-script-scan-share-old.csv', 'formal-script-scan-unlocked.csv'].map((n) => path.join(__dirname, '..', 'reports', n)).filter((f) => fs.existsSync(f)); // all scan files that exist
const OUT_MD = path.join(__dirname, '..', 'reports', 'formal-script-times.md');
const OUT_CSV = path.join(__dirname, '..', 'reports', 'formal-script-times-pairs.csv');
const EXCLUDE = /^(Ben Faulkner|Dana Buker)$/i;

function parseCsv(text) {
  const rows = []; let row = [], f = '', q = false;
  text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n') { row.push(f.replace(/\r$/, '')); rows.push(row); row = []; f = ''; }
    else f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  const head = rows.shift();
  return rows.filter((r) => r.length === head.length).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}

const docs = INS.flatMap((f) => parseCsv(fs.readFileSync(f, 'utf8'))).filter((d) => !d.Error && d.Path).map((d) => {
  const rel = /Release[\\/]((\d{4})\.(\d{2})\.(\d{2}|XX))/.exec(d.Path);
  const base = d.Name.replace(/\.(docx?|DOCX?)$/, '').replace(/-SS$/i, '');
  const m = /^(.*?)[-_ ]*v?(\d+(?:\.\d+)*)$/.exec(base);
  return {
    ...d,
    kind: /For_Execution/i.test(d.Path) ? 'F' : /Executed_MSWord/i.test(d.Path) ? 'E' : /Unlocked_Test_Cases/i.test(d.Path) ? 'U' : 'other',
    release: rel ? rel[1] : (/Unlocked_Test_Cases/i.test(d.Path) ? 'unlocked master' : '?'), relKey: rel ? `${rel[2]}${rel[3]}${rel[4] === 'XX' ? '99' : rel[4]}` : '0', // unlocked masters have relKey 0: a baseline for any release
    key: (m ? m[1] : base).toLowerCase().replace(/[^a-z0-9]/g, ''), version: m ? m[2] : '', edit: Number(d.EditMinutes) || 0, rev: Number(d.Revisions) || 0, ff: Number(d.FormFields) || 0,
    who: d.LastAuthor,
  };
}).filter((d) => d.kind !== 'other' && d.kind !== 'U' && d.ff > 0); // unlocked masters are scanned for reference only: they hold the CURRENT state, newer than every release snapshot, so they cannot be a baseline

const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor((s.length - 1) / 2)] : NaN; };
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor((s.length - 1) * p)] : NaN; };
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const fmt = (n) => (Number.isFinite(n) ? Math.round(n).toString() : 'n/a');

const pairs = [];
const byKey = {};
docs.forEach((d) => { (byKey[d.key] = byKey[d.key] || []).push(d); });

for (const group of Object.values(byKey)) {
  const fs_ = group.filter((d) => d.kind === 'F');
  for (const f of fs_) {
    // execution: Executed copy of the same release and version
    const e = group.find((d) => d.kind === 'E' && d.relKey === f.relKey && d.version === f.version);
    if (e) pairs.push({ type: 'execute', script: f.key + ' ' + f.version, release: f.release, who: e.who, minutes: e.edit - f.edit, ff: f.ff, revs: e.rev - f.rev, from: f.edit, to: e.edit });
    // writing: closest earlier copy not larger than f
    const earlier = group.filter((d) => d.relKey < f.relKey && d.edit <= f.edit);
    const base = earlier.sort((a, b) => b.edit - a.edit)[0];
    if (base) pairs.push({ type: 'write', script: f.key + ' ' + f.version, release: f.release, who: f.who, minutes: f.edit - base.edit, ff: f.ff, revs: f.rev - base.rev, from: base.edit, to: f.edit, baseRelease: base.release });
    else pairs.push({ type: 'write-no-baseline', script: f.key + ' ' + f.version, release: f.release, who: f.who, minutes: f.edit, ff: f.ff, revs: f.rev, from: 0, to: f.edit });
  }
}

const usable = (p) => !EXCLUDE.test(p.who || '');
const people = ['Mason Baxter', 'Nyya Adams', 'Maurice Almon'];
const L = [];
L.push('# Time to write and execute formal test scripts (from Word editing time)', '');
L.push(`Generated ${new Date().toISOString().slice(0, 10)} from ${docs.length} scripts scanned on the QA share (release folders 2019 to 2026${INS.some((f) => /unlocked/.test(f)) ? ' plus the #Unlocked_Test_Cases masters' : ''}; documents with form fields only; -SS screenshot documents skipped). Minutes, from Word's "Total editing time", attributed to Last Saved By. Ben Faulkner and Dana Buker excluded.`, '');
L.push('Limits: Word counts only time the file is open and being edited (not reading ValMaster, checking the live product or taking screenshots), so every figure is a LOWER BOUND. Writing time uses the closest earlier copy of the same script as the baseline, which is a guess about which copy was reused.', '');

function table(title, rows, extraNote) {
  L.push(`## ${title}`, '');
  if (extraNote) L.push(extraNote, '');
  L.push('| Person | Scripts | Mean min | Median min | 25th-75th pct min | Median min per 100 form fields | Zero or negative |', '|---|---:|---:|---:|---|---:|---:|');
  const groups = [...people, 'All others', 'Team (the three plus others)'];
  for (const g of groups) {
    const sel = rows.filter((r) => (g === 'All others' ? !people.includes(r.who) : g.startsWith('Team') ? true : r.who === g));
    const ok = sel.filter((r) => r.minutes > 0);
    const perField = ok.map((r) => (r.minutes / r.ff) * 100);
    L.push(`| ${g} | ${ok.length} | ${fmt(mean(ok.map((r) => r.minutes)))} | ${fmt(median(ok.map((r) => r.minutes)))} | ${fmt(q(ok.map((r) => r.minutes), 0.25))} - ${fmt(q(ok.map((r) => r.minutes), 0.75))} | ${fmt(median(perField))} | ${sel.length - ok.length} |`);
  }
  L.push('');
}
const W = pairs.filter((p) => p.type === 'write' && usable(p));
const X = pairs.filter((p) => p.type === 'execute' && usable(p));
const N = pairs.filter((p) => p.type === 'write-no-baseline' && usable(p));
table('Execution time per script (Executed copy minus For_Execution copy)', X, `${X.length} pairs found; "Scripts" counts pairs with a positive difference.`);
table('Writing time per script version (For_Execution minus the copy it was made from)', W, `${W.length} versions had an earlier copy to compare with.`);
L.push(`## Versions with no earlier copy (cumulative editing time, possibly inherited): ${N.length}`, '');
L.push(`Median ${fmt(median(N.map((r) => r.minutes)))} min, but these totals include whatever the original author spent, so they are NOT writing times.`, '');
L.push('Per-script rows are in formal-script-times-pairs.csv (type, script, release, who, minutes, form fields, revisions, from/to totals).', '');
fs.writeFileSync(OUT_MD, L.join('\n') + '\n');
const csv = ['type,script,release,who,minutes,formFields,revisionsDelta,fromTotal,toTotal'].concat(pairs.map((p) => [p.type, p.script, p.release, p.who, p.minutes, p.ff, p.revs, p.from, p.to].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')));
fs.writeFileSync(OUT_CSV, csv.join('\n') + '\n');
console.log(L.join('\n'));
