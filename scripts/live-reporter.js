// Playwright reporter that streams run progress to a live event file (one JSON object per line), read by scripts/suite-ui.js.
//   Active only when LIVE_EVENTS_FILE is set (scripts/suite-run.js and scripts/smoke-run.js set it); otherwise it does nothing, so it is safe in any --reporter list.
//   Ad hoc:  LIVE_EVENTS_FILE=reports/live.ndjson npx playwright test <spec> --reporter=list,./scripts/live-reporter.js
// Env: LIVE_EVENTS_FILE  target file (appended, flushed after every event, so a killed spec loses nothing)
//      LIVE_SHOTS_DIR    where failure screenshots are copied (Playwright wipes test-results on the next run); defaults next to the events file (shots/)
//      LIVE_STAGE        optional stage label (smoke tiers) attached to every event
// Read-only: it never touches the app under test.

const fs = require('fs');
const path = require('path');

const FILE = process.env.LIVE_EVENTS_FILE;
const SHOTS = process.env.LIVE_SHOTS_DIR || (FILE ? path.join(path.dirname(FILE), 'shots') : undefined);
const STAGE = process.env.LIVE_STAGE || undefined;

function clean(s) { return String(s ?? '').replace(/\u001b\[[0-9;]*m/g, ''); }

function emit(ev) {
  if (!FILE) return;
  try { fs.appendFileSync(FILE, JSON.stringify({ ts: Date.now(), ...(STAGE ? { stage: STAGE } : {}), ...ev }) + '\n'); } catch { /* never break the run for the UI */ }
}

class LiveReporter {
  constructor() { this.root = process.cwd(); this.currentFile = ''; }

  rel(p) { return path.relative(this.root, p || '').split(path.sep).join('/'); }

  onBegin(config, suite) {
    this.root = (config && config.configFile) ? path.dirname(config.configFile) : this.root; // specs are reported as tests/...
    const byFile = new Map();
    for (const t of suite.allTests()) { const f = this.rel(t.location.file); byFile.set(f, (byFile.get(f) ?? 0) + 1); }
    for (const [file, count] of byFile) emit({ t: 'tests', file, count });
  }

  onTestBegin(test) {
    this.currentFile = this.rel(test.location.file);
    emit({ t: 'testBegin', file: this.currentFile, title: test.title });
  }

  onStepBegin(test, _result, step) {
    if (step.category !== 'test.step') return; // only the author's own test.step titles; hooks and API calls are too noisy
    emit({ t: 'step', file: this.rel(test.location.file), title: clean(step.title).slice(0, 160) });
  }

  onTestEnd(test, result) {
    const outcome = test.outcome(); // expected | unexpected | flaky | skipped
    const status = outcome === 'skipped' ? 'skipped' : outcome === 'expected' ? 'passed' : outcome === 'flaky' ? 'flaky' : 'failed';
    let shot;
    if (status === 'failed' && SHOTS) {
      const a = (result.attachments ?? []).find((x) => x.path && /\.(png|jpe?g)$/i.test(x.path) && fs.existsSync(x.path));
      if (a) {
        try {
          fs.mkdirSync(SHOTS, { recursive: true });
          shot = `${Date.now()}_${path.basename(path.dirname(a.path)).slice(0, 60)}_${path.basename(a.path)}`.replace(/[^\w.\-]+/g, '_');
          fs.copyFileSync(a.path, path.join(SHOTS, shot));
        } catch { shot = undefined; }
      }
    }
    const skipNote = status === 'skipped' ? (test.annotations ?? []).map((x) => x.description).filter(Boolean).join(' | ').slice(0, 300) : '';
    const err = status === 'failed' ? clean(result.error?.message ?? (result.errors ?? [])[0]?.message).split('\n').filter(Boolean).slice(0, 4).join(' | ').slice(0, 500) : '';
    emit({ t: 'testEnd', file: this.rel(test.location.file), title: test.title, status, ms: result.duration ?? 0, ...(err ? { error: err } : {}), ...(skipNote ? { note: skipNote } : {}), ...(shot ? { shot } : {}) });
  }

  onError(error) { emit({ t: 'error', file: this.currentFile, error: clean(error?.message).split('\n').slice(0, 3).join(' | ').slice(0, 400) }); }
}

module.exports = LiveReporter;
