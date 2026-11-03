// Copies everything that would be lost if this PC crashed to a OneDrive folder (copy only: NOTHING is ever deleted; a file is overwritten only when the source is newer):
//   memory/        Claude memory of the ROBAR project (C:\Users\Mason\.claude\projects\C--DB-Copies-703-20198\memory)
//   skills/        the ROBAR / QA-script skills of C:\Users\Mason\.claude\skills (not the generic QA skills)
//   repo-uncommitted/   files of ROBAR_Tests that git has not committed yet (modified + untracked, no lock files, no reports/suite run folders except report.md / results.json)
//   BACKUP-INFO.txt    when it ran + how to restore
// Run after each working session:   node scripts/backup-knowledge.js [destination folder]
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

const HOME = os.homedir();
const DEST = path.resolve(process.argv[2] || path.join(HOME, 'OneDrive - Innovatum, Inc', 'ROBAR_Claude_Backup'));
const REPO = path.join(__dirname, '..');
const MEMORY = path.join(HOME, '.claude', 'projects', 'C--DB-Copies-703-20198', 'memory');
const SKILLS = path.join(HOME, '.claude', 'skills');
const SKILL_NAMES = /^(robar|ROBAR|formal-test-script|Formal_Test_Script|UAT_Execution|uat-creation|Update_Release_Notes|Retrieve_Latest_703_Code)/i;
const SECRET = /(password|passwd|pwd|api[_-]?key|secret|token)\s*[:=]\s*['"]?[A-Za-z0-9!@#$%^&*_\-+=]{6,}/i;

const stats = { copied: 0, same: 0, secretHits: [] };

function copyFile(src, dst) {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  if (fs.existsSync(dst) && fs.statSync(dst).mtimeMs >= fs.statSync(src).mtimeMs && fs.statSync(dst).size === fs.statSync(src).size) { stats.same++; return; }
  fs.copyFileSync(src, dst);
  stats.copied++;
  if (/\.(md|txt|js|ts|json|ps1|cs|yml|yaml)$/i.test(src) && fs.statSync(src).size < 2_000_000) {
    const hit = fs.readFileSync(src, 'utf8').split(/\r?\n/).findIndex((l) => SECRET.test(l));
    if (hit >= 0) stats.secretHits.push(`${src}:${hit + 1}`);
  }
}

function copyTree(srcDir, dstDir) {
  for (const e of fs.readdirSync(srcDir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git') continue;
    const s = path.join(srcDir, e.name);
    if (e.isDirectory()) copyTree(s, path.join(dstDir, e.name));
    else copyFile(s, path.join(dstDir, e.name));
  }
}

fs.mkdirSync(DEST, { recursive: true });
copyTree(MEMORY, path.join(DEST, 'memory'));
for (const e of fs.readdirSync(SKILLS, { withFileTypes: true })) if (e.isDirectory() && SKILL_NAMES.test(e.name)) copyTree(path.join(SKILLS, e.name), path.join(DEST, 'skills', e.name));

// uncommitted repo files (git status --porcelain: " M", "??", "A "; skip deletions, lock files and the bulky suite run folders)
const lines = execSync('git status --porcelain --untracked-files=all', { cwd: REPO, encoding: 'utf8' }).split(/\r?\n/).filter(Boolean);
let repoFiles = 0;
for (const l of lines) {
  if (/^\s*D/.test(l)) continue;
  const rel = l.slice(3).replace(/^"|"$/g, '');
  if (rel.includes('~$')) continue;
  if (rel.startsWith('reports/suite/') && !/\/(report\.md|results\.json)$/.test(rel)) continue;
  const src = path.join(REPO, rel);
  if (fs.existsSync(src) && fs.statSync(src).isFile()) { copyFile(src, path.join(DEST, 'repo-uncommitted', rel)); repoFiles++; }
}

fs.writeFileSync(path.join(DEST, 'BACKUP-INFO.txt'), [
  `Last backup: ${new Date().toISOString()} from ${os.hostname()} (node scripts/backup-knowledge.js)`,
  'memory/  -> copy back into C:\\Users\\Mason\\.claude\\projects\\C--DB-Copies-703-20198\\memory\\',
  'skills/  -> copy each folder back into C:\\Users\\Mason\\.claude\\skills\\',
  'repo-uncommitted/ -> the same relative paths inside C:\\Users\\Mason\\ROBAR_Tests (everything else of the repo is on GitHub, branch exploratory-learning)',
  'Nothing is ever deleted by the script; a file is overwritten only when the source is newer.',
].join('\r\n') + '\r\n');

console.log(`destination: ${DEST}`);
console.log(`copied ${stats.copied}, unchanged ${stats.same}; uncommitted repo files seen: ${repoFiles}`);
if (stats.secretHits.length) console.log(`POSSIBLE SECRETS (review; text looks like name = value):\n  ${stats.secretHits.join('\n  ')}`);
