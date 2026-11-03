// Uploads the JUnit XML files of one suite run (or any folder of .xml reports) to Datadog Test Optimization, the same way RONOVA does it:
//   npx @datadog/datadog-ci junit upload --service <service> <files>
// Needs the user's own environment variables DD_API_KEY (never printed, never stored by this script) and DD_SITE (default datadoghq.com).
//   node scripts/datadog-upload.js <run folder or xml folder> [--service robar-e2e] [--env tst703] [--tags suite:full]
// Run it from the ROBAR_Tests repo (datadog-ci reads the git commit / repository from the current folder).
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const target = argv.find((a) => !a.startsWith('--') && argv[argv.indexOf(a) - 1] !== '--service' && argv[argv.indexOf(a) - 1] !== '--env' && argv[argv.indexOf(a) - 1] !== '--tags');
if (!target) { console.error('usage: node scripts/datadog-upload.js <run folder> [--service robar-e2e] [--env tst703] [--tags suite:full]'); process.exit(2); }
if (!process.env.DD_API_KEY) { console.error('DD_API_KEY is not set in this process: set it as an environment variable (not in chat or in a file), restart the app that starts this, and try again.'); process.exit(3); }

const dir = fs.existsSync(path.join(target, 'junit')) ? path.join(target, 'junit') : target;
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.xml')).map((f) => path.join(dir, f));
if (!files.length) { console.error(`no .xml reports in ${dir}`); process.exit(4); }

let env = opt('--env');
if (!env) { try { const m = /ROBAR_BASE_URL\s*=\s*https?:\/\/([^\/\s]+)/i.exec(fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8')); if (m) env = m[1].replace(/^vmsrv/i, '').toLowerCase(); } catch { /* no .env */ } }
const args = ['@datadog/datadog-ci', 'junit', 'upload', '--service', opt('--service', 'robar-e2e'), ...(env ? ['--env', env] : []), ...(opt('--tags') ? ['--tags', opt('--tags')] : []), ...files];
console.log(`uploading ${files.length} report(s) from ${dir} as service ${opt('--service', 'robar-e2e')}${env ? ', env ' + env : ''} (site ${process.env.DD_SITE || 'datadoghq.com'})`);
const r = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', args, { cwd: path.join(__dirname, '..'), shell: process.platform === 'win32', stdio: 'inherit', env: { ...process.env, DD_SITE: process.env.DD_SITE || 'datadoghq.com' } });
process.exit(r.status ?? 1);
