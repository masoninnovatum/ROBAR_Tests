// preload for scripts/profile-sleeps.js: sums the time spent in page.waitForTimeout / frame.waitForTimeout in this process and writes it to $SLEEPPROF_DIR/sleepprof_<pid>.json on exit.
let total = 0;
let calls = 0;
const patch = (proto) => {
  if (!proto || proto.__sleepPatched) return;
  const o = proto.waitForTimeout;
  if (typeof o !== 'function') return;
  proto.waitForTimeout = function (ms) { total += Number(ms) || 0; calls++; return o.call(this, ms); };
  proto.__sleepPatched = true;
};
const patchPage = (p) => { patch(Object.getPrototypeOf(p)); patch(Object.getPrototypeOf(p.mainFrame())); };
try {
  const pw = require(require('path').join(__dirname, '..', 'node_modules', 'playwright-core'));
  const BT = Object.getPrototypeOf(pw.chromium);
  const wrapCtx = (ctx) => {
    const np = ctx.newPage;
    ctx.newPage = async function (...a) { const p = await np.apply(this, a); patchPage(p); return p; };
    return ctx;
  };
  const launch = BT.launch;
  BT.launch = async function (...a) {
    const b = await launch.apply(this, a);
    const nc = b.newContext;
    b.newContext = async function (...c) { return wrapCtx(await nc.apply(this, c)); };
    const np = b.newPage;
    b.newPage = async function (...c) { const p = await np.apply(this, c); patchPage(p); return p; };
    return b;
  };
} catch (e) { /* profiling is best effort */ }
process.on('exit', () => {
  try {
    const dir = process.env.SLEEPPROF_DIR;
    if (dir) require('fs').writeFileSync(require('path').join(dir, 'sleepprof_' + process.pid + '.json'), JSON.stringify({ total, calls }));
  } catch (e) { /* ignore */ }
});
