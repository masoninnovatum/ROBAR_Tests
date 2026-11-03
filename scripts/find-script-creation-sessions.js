// Lists every Skill invocation of formal-test-script-creation (and -execution for context) in the Claude session transcripts, with the timestamp, session file and the next 3 user prompts' first words,
// so the time Claude spent creating formal scripts can be read from the transcripts. Read only.   node scripts/find-script-creation-sessions.js [skillName]
const fs = require('fs');
const os = require('os');
const path = require('path');

const SKILL = process.argv[2] || 'formal-test-script-creation';
const root = path.join(os.homedir(), '.claude', 'projects');
const out = [];
for (const proj of fs.readdirSync(root)) {
  const dir = path.join(root, proj);
  if (!fs.statSync(dir).isDirectory()) continue;
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.jsonl'))) {
    const lines = fs.readFileSync(path.join(dir, f), 'utf8').split('\n').filter(Boolean);
    lines.forEach((l, i) => {
      if (!l.includes(SKILL)) return;
      let j;
      try { j = JSON.parse(l); } catch { return; }
      const content = j.message && Array.isArray(j.message.content) ? j.message.content : [];
      for (const c of content) {
        if (c.type === 'tool_use' && c.name === 'Skill' && c.input && c.input.skill === SKILL) out.push({ proj, file: f, line: i, ts: j.timestamp, args: String(c.input.args || '').slice(0, 160) });
      }
    });
  }
}
out.sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
for (const o of out) console.log(`${o.ts} | ${o.proj} | ${o.file} line ${o.line} | ${o.args}`);
console.log(`${out.length} invocation(s) of ${SKILL}`);
