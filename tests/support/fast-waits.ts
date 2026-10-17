// OPT-IN (env FAST_WAITS=1): turns the fixed `page.waitForTimeout(ms)` sleeps of the specs into "wait until the page's AJAX traffic has gone quiet, but never longer than ms".
// Measured 2026-10-17 (scripts/profile-sleeps.js): fixed waits were 50-90 % of the run time of most specs, usually generous "let the grid / dialog settle" pauses after a click. Rules:
//  - waits of 500 ms or less are left alone (cheap, and they often cover pure client-side rendering);
//  - longer waits end early once (a) at least min(ms, 600) ms have passed, (b) no request is in flight and (c) the last request activity is >= 400 ms old; otherwise they run the full ms (pages that poll
//    in the background simply behave as before).
// It cannot see purely client-side delays (animations, knockout rendering) which is why the 600 ms floor exists. Not enabled by default: compare a run with and without FAST_WAITS=1 before trusting it.
// Installed from playwright.config.ts (the config is loaded in every worker). `npm run` scripts can set the variable; nothing in the specs changes.

type PageLike = {
  on: (e: string, cb: (...a: unknown[]) => void) => void;
  waitForTimeout: (ms: number) => Promise<void>;
  mainFrame: () => { waitForTimeout: (ms: number) => Promise<void> };
};

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const state = new WeakMap<object, { pending: number; last: number }>();

function track(page: PageLike): { pending: number; last: number } {
  let s = state.get(page);
  if (s) return s;
  const st = { pending: 0, last: Date.now() };
  state.set(page, st);
  page.on('request', () => { st.pending++; st.last = Date.now(); });
  const done = () => { st.pending = Math.max(0, st.pending - 1); st.last = Date.now(); };
  page.on('requestfinished', done);
  page.on('requestfailed', done);
  return st;
}

async function quietWait(st: { pending: number; last: number }, ms: number): Promise<void> {
  const start = Date.now();
  const floor = Math.min(ms, 600);
  for (;;) {
    const elapsed = Date.now() - start;
    if (elapsed >= ms) return;
    if (elapsed >= floor && st.pending === 0 && Date.now() - st.last >= 400) return;
    await sleep(50);
  }
}

export function installFastWaits(): void {
  if (process.env.FAST_WAITS !== '1') return;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pw = require('playwright-core');
  const BT = Object.getPrototypeOf(pw.chromium);
  if (BT.__fastWaits) return;
  BT.__fastWaits = true;
  const patchPage = (p: PageLike) => {
    const st = track(p);
    const proto = Object.getPrototypeOf(p);
    if (!proto.__fastWaits) {
      proto.__fastWaits = true;
      const orig = proto.waitForTimeout;
      proto.waitForTimeout = function (this: PageLike, ms: number) {
        const s = state.get(this);
        return ms > 500 && s ? quietWait(s, ms) : orig.call(this, ms);
      };
    }
    void st;
  };
  const wrapCtx = (ctx: { newPage: (...a: unknown[]) => Promise<PageLike> }) => {
    const np = ctx.newPage;
    ctx.newPage = async function (...a: unknown[]) { const p = await np.apply(this, a); patchPage(p); return p; };
    return ctx;
  };
  const launch = BT.launch;
  BT.launch = async function (...a: unknown[]) {
    const b = await launch.apply(this, a);
    const nc = b.newContext;
    b.newContext = async function (...c: unknown[]) { return wrapCtx(await nc.apply(this, c)); };
    const np = b.newPage;
    b.newPage = async function (...c: unknown[]) { const p = await np.apply(this, c); patchPage(p); return p; };
    return b;
  };
}
