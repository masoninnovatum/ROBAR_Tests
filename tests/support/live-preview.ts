// Live preview for scripts/suite-ui.js (the "Live preview" box of the run monitor page). Installed from playwright.config.ts (like fast-waits.ts); no spec changes.
// While somebody is watching the preview (the server touches <run folder>/preview.want on every request of the page, the page asks every 2 s), the newest open page of this
// worker is captured as a small JPEG every ~1.5 s into <run folder>/preview.jpg (+ preview.json with the page address). Nobody watching = nothing is captured, no cost.
// Active only in a run that has LIVE_PREVIEW_DIR or LIVE_EVENTS_FILE set (suite-run.js / smoke-run.js set the latter), so a plain `npx playwright test` is untouched.
// Everything is best effort: a failed or slow capture (page navigating, JS dialog open) is dropped after 4 s and never affects the test.
// Caveat (docs/agents/live-run-ui.md): a screenshot is a CDP call; tracing (also CDP) was once found to break Campaign Manager's grid, so the preview is OFF unless the page asks for it.

import * as fs from 'fs';
import * as path from 'path';

type PageLike = {
  isClosed: () => boolean;
  url: () => string;
  screenshot: (o: object) => Promise<Buffer>;
  on: (e: string, cb: (...a: unknown[]) => void) => void;
};
type CtxLike = { newPage: (...a: unknown[]) => Promise<PageLike>; on: (e: string, cb: (p: PageLike) => void) => void };

const INTERVAL_MS = 1500;
const WATCH_WINDOW_MS = 8000; // the page asks every 2 s; capture while the last ask is younger than this

export function installLivePreview(): void {
  const dir = process.env.LIVE_PREVIEW_DIR || (process.env.LIVE_EVENTS_FILE ? path.dirname(process.env.LIVE_EVENTS_FILE) : '');
  if (!dir) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pw = require('playwright-core');
    const BT = Object.getPrototypeOf(pw.chromium);
    if (BT.__livePreview) return;
    BT.__livePreview = true;

    const want = path.join(dir, 'preview.want');
    const jpg = path.join(dir, 'preview.jpg');
    const meta = path.join(dir, 'preview.json');
    const pages = new Set<PageLike>();
    let busy = false;
    let timer: NodeJS.Timeout | undefined;

    const tick = (): void => {
      if (busy) return;
      try {
        const page = [...pages].reverse().find((p) => !p.isClosed());
        if (!page) return;
        let age = Infinity;
        try { age = Date.now() - fs.statSync(want).mtimeMs; } catch { /* nobody ever asked */ }
        if (age > WATCH_WINDOW_MS) return;
        busy = true;
        page.screenshot({ type: 'jpeg', quality: 50, scale: 'css', timeout: 4000 })
          .then((buf) => {
            const tmp = jpg + '.tmp';
            fs.writeFileSync(tmp, buf);
            fs.renameSync(tmp, jpg);
            let url = '';
            try { const u = new URL(page.url()); url = u.origin + u.pathname; } catch { /* about:blank etc. */ }
            fs.writeFileSync(meta, JSON.stringify({ ts: Date.now(), url }));
          })
          .catch(() => { /* dropped frame */ })
          .finally(() => { busy = false; });
      } catch { busy = false; }
    };

    const register = (p: PageLike): void => {
      if (!p || pages.has(p)) return;
      pages.add(p);
      p.on('close', () => pages.delete(p));
      if (!timer) { timer = setInterval(tick, INTERVAL_MS); timer.unref(); }
    };
    const wrapCtx = (ctx: CtxLike): CtxLike => {
      try { ctx.on('page', register); } catch { /* ignore */ }
      const np = ctx.newPage;
      ctx.newPage = async function (this: CtxLike, ...a: unknown[]) { const p = await np.apply(this, a); register(p); return p; };
      return ctx;
    };

    const launch = BT.launch;
    BT.launch = async function (this: unknown, ...a: unknown[]) {
      const b = await launch.apply(this, a);
      try {
        const nc = b.newContext;
        b.newContext = async function (this: unknown, ...c: unknown[]) { return wrapCtx(await nc.apply(this, c)); };
        const np = b.newPage;
        b.newPage = async function (this: unknown, ...c: unknown[]) { const p = await np.apply(this, c); register(p); return p; };
      } catch { /* the browser still works without the preview */ }
      return b;
    };
  } catch { /* never let the preview stop a test run */ }
}
