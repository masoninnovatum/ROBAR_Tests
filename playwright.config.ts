import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  // Campaign Manager specs can legitimately need several Retrieve Items retries (see
  // tests/support/campaign-manager.ts) -- 5 attempts x up to ~19s worst-case each can exceed a
  // 60s budget even when nothing is actually wrong. 120s gives real retries room to finish.
  timeout: 120_000,
  retries: 0,
  // Confirmed live (2026-09-04): Campaign Manager's grid "Retrieve Items" reads/writes some
  // per-account (not per-session) server-side query state. Two concurrent logins as the same
  // WebMenu account can silently return one session's item in another's "exact match" search --
  // no error, just wrong data. Since every test here shares one account (mbuser1), keep workers
  // at 1 so no two tests ever hit the server at the same moment. See tests/support/campaign-manager.ts.
  workers: 1,
  reporter: [['html', { open: 'never' }]],
  use: {
    headless: true,
    viewport: { width: 1400, height: 950 },
    screenshot: 'only-on-failure',
    // Confirmed live (2026-09-04): trace: 'retain-on-failure' is NOT just overhead here -- it
    // changes real behavior. With it on, Campaign Manager's grid consistently gets stuck on
    // "Loading..." forever after Retrieve Items (even across 5 retries with generous timeouts),
    // for a flow that otherwise passes reliably; with tracing off, the exact same test passes in
    // ~30s. Root cause not confirmed, but tracing's CDP-level instrumentation appears to perturb
    // this legacy jQuery app's own timing-sensitive JS (see tests/support/campaign-manager.ts's
    // extensive comments on this module's other timing bugs) enough to break it. If you need a
    // trace to debug a specific failure, re-enable temporarily via `--trace=on` on the command
    // line rather than turning this back on globally.
    trace: 'off',
  },
});
