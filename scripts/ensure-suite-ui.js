// Makes sure the live progress page (scripts/suite-ui.js) is being served, so every run started by scripts/suite-run.js or scripts/smoke-run.js can be watched at http://127.0.0.1:4173
// without anybody starting the monitor first. Called by both runners at startup; safe to call any number of times and from any session or terminal.
//   - already serving on the port  -> does nothing
//   - not serving                  -> starts suite-ui.js detached and hidden (it keeps running after the run ends; stop it with  taskkill /IM node.exe  only if you really want it gone,
//                                     or by its PID: Get-NetTCPConnection -LocalPort 4173)
// It never opens a browser window (a headed run must not have another window pop up in front of it). Set SUITE_UI_AUTOSTART=0 to disable. Never throws: the monitor must not stop a run.
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

const PORT = Number(process.env.SUITE_UI_PORT || 4173);

function serving() {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port: PORT, path: '/api/runs', timeout: 1500 }, (res) => { res.resume(); resolve(res.statusCode === 200); });
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.on('error', () => resolve(false));
  });
}

async function ensureSuiteUi() {
  try {
    if (process.env.SUITE_UI_AUTOSTART === '0') return 'disabled';
    if (await serving()) return 'already running';
    const child = spawn(process.execPath, [path.join(__dirname, 'suite-ui.js')], { detached: true, stdio: 'ignore', windowsHide: true, env: process.env });
    child.unref();
    for (let i = 0; i < 10; i++) { await new Promise((r) => setTimeout(r, 300)); if (await serving()) return 'started'; }
    return 'start requested, not answering yet';
  } catch (e) { return 'not started: ' + (e && e.message); }
}

module.exports = { ensureSuiteUi };
if (require.main === module) ensureSuiteUi().then((s) => console.log(`live progress page http://127.0.0.1:${PORT}/ : ${s}`));
