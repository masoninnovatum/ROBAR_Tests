// Static sweep (2026-10-09): InnoUserException keys used in the 7.0.3 source tree (`new InnoUserException(Err_X.Key ...)`) that have NO seed record in
// Innovatum.Install/ROBARDB/BaseProductTables/LocalizationResourceDef/Default_Localizations -> such an error shows the raw text
// "Localizable Exception thrown with ResourceType: ... and ResourceKey: ..." (seen live: Destination Labeling Order_Already_Exists).
// Usage: node scripts/sweep-localizations.js [MsBuildRoot]
const fs = require('fs');
const path = require('path');

const root = process.argv[2] || 'C:/DB_Copies/703_20198/MsBuild';
const SKIP = new Set(['staging', 'packages', '.svn', 'node_modules', 'bin', 'obj', 'Testing']);
const norm = (p) => p.split(path.sep).join('/');

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.cs')) out.push(p);
  }
  return out;
}

const LOC_DIR = 'BaseProductTables/LocalizationResourceDef/Default_Localizations';
const files = walk(root, []);
const seeded = new Set();
for (const f of files.filter((x) => norm(x).includes(LOC_DIR))) {
  const s = fs.readFileSync(f, 'utf8');
  const re = /Generate\(\s*"Innovatum\.InnoUserException\.(Err_\w+)",\s*"(\w+)"/g;
  let m;
  while ((m = re.exec(s))) seeded.add(`${m[1]}.${m[2]}`);
}
const used = new Map();
for (const f of files) {
  if (norm(f).includes(LOC_DIR)) continue;
  const s = fs.readFileSync(f, 'utf8');
  const re = /new InnoUserException\(\s*(Err_\w+)\.(\w+)/g;
  let m;
  while ((m = re.exec(s))) {
    const k = `${m[1]}.${m[2]}`;
    if (!used.has(k)) used.set(k, norm(f));
  }
}
const missing = [...used].filter(([k]) => !seeded.has(k)).sort((a, b) => a[0].localeCompare(b[0]));
console.log(`seeded keys: ${seeded.size}; keys used in code: ${used.size}; used but NOT seeded: ${missing.length}`);
for (const [k, f] of missing) console.log(`${k}   <- ${f.split('/').slice(-3).join('/')}`);
