# Live run UI (progress of an E2E / smoke run while it happens)

Added 2026-11-18. Until 2026-11-19 it was read-only; now the page can also START a Smoke / E2E / API run and STOP the one in progress (see "Starting runs").

## Use

```
node scripts/suite-ui.js            # then open http://127.0.0.1:4173  (--port N, --open)
node scripts/suite-run.js ...       # in another terminal: the page follows the newest run by itself
node scripts/smoke-run.js ...       # smoke runs show up in the same page (stages = tier0/tier1/...)
```

The page shows: status (running / finished / aborted / runner stopped), elapsed, estimated time left, spec files done / total,
passed / failed / skipped, a progress bar, the spec + test + `test.step` running now (with a headed-spec "hands off" banner),
a module grid (click a module to list its spec files), failures as they happen (error text + failure screenshot), an activity
feed and the skipped tests with their precondition text. The run picker replays older runs (from `results.json`; no timings
inside a spec file). A "no test activity for 3 min" banner flags a stuck spec (screen lock, VPN drop, Sentinel prompt).

## Starting runs (2026-11-19)

The **▶ Start Run** button (header) opens a dialog with three cards; each asks for a confirmation that spells out the headed / hands-off warning. It runs the same commands as the terminal, as a detached hidden process
(console output: `reports/suite-ui-launches/<stamp>-<suite>.log`):

| Card | Command | Notes |
|---|---|---|
| Smoke | `node scripts/smoke-run.js --stages <ticked stages>` | preflight, tier 0/1/2 (~22 min); tier 2 is headed |
| E2E | `node scripts/suite-run.js [--only <text>] [--fix-fixtures]` | the full suite, API specs included (~8 h, headed specs first) |
| API | `node scripts/suite-run.js --only tests/API/ [--fix-fixtures]` | the API specs on their own, headless, ~5 min; they are also part of E2E |

(Changed 2026-11-20: the E2E card briefly excluded the API specs via `--exclude tests/API/`. `--exclude <text>` still exists in suite-run.js, skipping spec files whose path contains the text, but the page no longer uses it.) The **■ Stop Run** button (visible while a run is active) does `taskkill /T /F` on the runner and everything below it,
then records `runEnd` "aborted" in the live feed; it can leave test data or a fixture group changed, the next run's fixture check reports that.

No console windows (fixed 2026-11-20): a run started from the page has no terminal, so before the fix each spec file's `cmd.exe` (behind `npx playwright test`) opened a visible console window that could steal focus from headed specs.
`suite-run.js` and `smoke-run.js` now pass `windowsHide` to their child processes when stdout is not a terminal (`HIDE`); from a terminal nothing changes. Untested on a real launch as of this note.

Guards (all in `scripts/suite-ui.js`): nothing starts while a run is active (live feed with a living runner pid and no `runEnd`) or while ANY runner / Playwright process is running (process scan; this also catches a plain `npx playwright test`
in a terminal or another session, because every spec uses the same TST703 account and two concurrent logins corrupt results; there is no override); POST only with JSON body + `X-Suite-UI: 1` header and Host / Origin = this server on localhost (so other
web pages and DNS rebinding cannot trigger a run); inputs are validated and passed as an argument array (no shell); 25 s double-click guard. The server still binds to 127.0.0.1 only.

## Always on + visible on the network (2026-11-20)

- **Always on:** scheduled task `ROBAR Live Run UI` (current user, "run only when logged on") runs `conhost --headless node scripts\suite-ui.js` (no window) at logon and every 5 minutes (a second instance is ignored while it runs, so the repeat only matters
  after a crash; verified: killed server was back at the next trigger). Remove: `Unregister-ScheduledTask -TaskName "ROBAR Live Run UI" -Confirm:$false`. It stops when the laptop sleeps, is shut down or the user logs off; the Balanced power plan sleeps it.
- **Network:** `scripts/suite-ui.config.json` (gitignored, local) sets `"host": "0.0.0.0"`; delete the file (or set 127.0.0.1) to go back to this-computer-only. Optional `"auth": "user:password"` (or env `SUITE_UI_AUTH`) makes every request from another computer
  need that HTTP basic-auth login; this computer never needs it. Without `auth` there is NO login, and the page shows run errors and failure screenshots.
- **View only unless approved (changed 2026-11-20, see "Accounts" below):** Start / Stop / Pause (POST /api/start, /api/stop, ...) are refused unless the request comes from this computer (loopback address) or from a signed-in account the owner approved; everybody else sees the page with a "view only" tag and a Sign in button. Open the page on this laptop as http://127.0.0.1:4173 to control runs
  (http://MASON-LAPTOP:4173 from the laptop itself counts as "another computer").
- **Reachability:** an inbound Windows Firewall rule "Node.js JavaScript Runtime" (Allow, Domain profile only, TCP+UDP) already existed, so no rule was added. Only computers that reach the laptop over a Domain-profile adapter can connect (on 2026-11-20 that was the
  "Local Area Connection" adapter, 192.168.113.7, i.e. the corporate VPN; the Wi-Fi adapter was on the Public profile, where the rule does not apply: expected blocked, not verified from another computer). Addresses change with the network, so share the name `http://MASON-LAPTOP:4173`.
- Tested (2026-11-20, spare ports): other-computer requests get `canControl:false` and a 403 on start/stop; with `auth` set they get 401 without / with a wrong password and 200 with the right one; this computer needs none.

## Hands-free signal (2026-11-20)

The E2E runner already runs every headed spec first (a spec file containing `headless: false` counts as headed; checked 2026-11-20: 47 files, no headed spec missed, the six other files that use `page.mouse` only use Playwright's virtual mouse). The page now says when that block is over:
once every headed spec file of the run has finished while others still wait, it shows a green banner "Headed specs finished at hh:mm: you can use the computer now. The remaining N spec files run headless.", prefixes the browser tab title with "hands-free" and, if the header box **notify when hands-free** is ticked,
shows one desktop notification (opt-in, remembered in the browser; the browser asks for permission the first time; only for a phase that just ended, never for one replayed when the page is opened). Smoke runs have their headed stage (tier 2) last, so no banner there.

The **Tests** tile (E2E / API runs; smoke runs keep **Stages**) shows tests finished / total tests. A spec file only announces its tests when it starts, so for files that have not started the total is estimated from the most recent earlier run that included them (`GET /api/testcounts`, rows per file in `results.json`) and shown with a "~" until every file has started; new specs with no history count 0 until they start.

## Accounts: control from other computers with the owner's approval (2026-11-20)

Everybody on the network can still WATCH. People on other computers can now also start / pause / resume / stop runs, but only with an account the owner (the user of the test computer) has approved. This replaces "view only for everyone off this computer".
Flow: someone opens `http://MASON-LAPTOP:4173` -> **Sign in** -> **Request access** (name + password >= 8 characters) -> they are signed in as "awaiting approval" (view only). The owner opens `http://127.0.0.1:4173` ON THE TEST COMPUTER (the header shows **Users (n waiting)** and a banner) ->
**Approve / Deny (Revoke) / Delete**. The remote page picks it up within ~5 s, no re-login; revoking / denying / deleting works on the next request. Nobody is approved by default, so nothing changes until the owner approves someone.
- Code: `scripts/suite-ui-auth.js` (accounts, scrypt password hashes, sessions, audit); routes `POST /api/auth/register|login|logout` (anybody), `GET /api/users`, `POST /api/users/approve|deny|delete` (this computer only); `/api/state` now also returns `me`, `admin`, `pending`, and `canControl` = this computer OR approved account.
- Storage: `scripts/suite-ui.users.json` (gitignored; hashed passwords, status, timestamps). Sessions are in memory and last 8 h sliding, so a server restart signs everybody out (accounts stay). Env `SUITE_UI_USERS` points at another accounts file (tests).
- Audit: every start / stop / pause / resume, approval, login and failed login goes to `reports/suite-ui-audit.log` (tab-separated: time, who, from, action, detail; "local" = this computer).
- Guards: session cookie is HttpOnly + SameSite=Strict; POSTs still need the `X-Suite-UI` header + JSON; from other computers the Host must be this computer's exact name or IP (`USERDNSDOMAIN` variant too) and Origin must equal it (look-alike names / DNS rebinding refused); from this computer only 127.0.0.1 / localhost as before.
  Login: 5 wrong passwords for the same name from the same address lock it for 5 min; 5 registrations per address per hour; 50 accounts maximum. The run guards are unchanged (nothing starts while any runner / Playwright process runs).
- Preview and on-demand report: approved accounts get the Live preview; building a missing report is still this computer only.
- Caveats: plain http, so a password can be sniffed on a shared network (the dialog says to use a password used nowhere else). An approved remote user can start E2E or smoke tier 2, whose headed specs take over THIS computer's mouse and keyboard: the start dialog warns them and the audit log says who did it, but there is no "API only" permission level yet (easy to add).
  The optional config `auth` (basic auth for the whole page) still works in front of all of this.
- Tested 2026-11-20 on a spare port with a throw-away accounts file: not signed in / pending / denied / deleted = 403; approved = permission passes (409 "a test process is already running" because the real run was going); approve / deny only from this computer; wrong Host, foreign Origin, missing header = 403; lockout after 5 failures; then the page flow (request, Users dialog, approve, remote buttons appear, revoke). Not tested from a second physical computer.

## Live preview (2026-11-20)

The **Live preview** box (top of the right column, closed by default) shows the browser of the spec that is running: a JPEG about every 2 s, never video. Mechanism: `tests/support/live-preview.ts`, installed from `playwright.config.ts` (same pattern as `fast-waits.ts`, no spec changes),
wraps `chromium.launch` / `newContext` / `newPage` and remembers the newest open page of the worker. While the box is open the page asks `GET /preview.jpg?run=<id>` every 2 s (only with the tab visible and a run in progress); the server touches `<run folder>/preview.want` on each ask, and the worker
captures `page.screenshot` (JPEG q50, 4 s timeout, best effort) into `<run folder>/preview.jpg` + `preview.json` (page address without query) only while `preview.want` is younger than 8 s. Nobody watching = no capture, no cost. Works for headless and headed pages; native windows
(BarTender, Sentinel prompt) are not part of a page, so those steps show the last web page. It needs `LIVE_EVENTS_FILE` (set by suite-run / smoke-run), so an ad hoc `npx playwright test` is untouched. A spec file that was already running when the preview was installed starts sending with the next spec file.
Network viewers: the route answers 403 off this computer unless `auth` is configured (the preview shows real app screens). Tested with a local probe (no viewer: no frames; viewer: frames follow the page; viewer stops: capture stops within 8 s) and live on the 2026-11-20 E2E run (Campaign Manager page, 68 KB frames).
Caveat: a screenshot is a CDP call; tracing (also CDP) once broke Campaign Manager's grid (see playwright.config.ts), so if a spec behaves differently with the box open, close it and tell Mason.

The **Failures** card is collapsible (click its title; open by default; the choice is remembered per browser in localStorage `robarFailsOpen`).

## Pause / resume (2026-11-20)

While a run is active (this computer only, like Start / Stop) the header shows **⏸ Pause Run**, which becomes **▶ Resume Run** once a pause is requested. The pause is cooperative and happens **between spec files** (smoke: between stages):
the spec file that is running always finishes, then the runner holds before the next one; nothing is frozen mid-test (a spec can be mid-click on the real mouse or mid-print, holds a server session, and Playwright timeouts would fire on resume).
Mechanism: the button creates `<run folder>/pause.flag` (POST /api/pause); `suite-run.js` / `smoke-run.js` check it before each spec file / stage, log `pause` events (`requested` from the server, `paused` / `resumed` from the runner, `cancelled` when Resume is clicked
before the runner reached the boundary) and wait while it exists; Resume (POST /api/resume) deletes it. The flag is removed at runner start and at the end. While paused the page shows a "paused" tag and banner (the idle-spec warning is off), and the computer is free to use.
Elapsed time keeps counting during a pause. Stop still works while paused. Tested with local probe specs (pause held before the next spec, real button click resumed it, requested-then-cancelled pause did not hold); the smoke-run stage pause is the same code but untested.

## Report download (2026-11-20)

When a run is not in progress the header shows **⬇ Report (HTML)** and **⬇ Report (.md)** (`GET /report?run=<id>&fmt=html|md`), in the same button group as Start / Pause / Stop on the right of the title row (the group wraps below the title as a whole on a narrow window; the run details line sits under the header). `.md` is the run's `report.md` as it is; the HTML is one self-contained file (styles inline, prints cleanly)
with the same report plus the failure screenshots embedded (from the run's `shots/`, up to 60). File names: `ROBAR-<API|E2E|Smoke>-<stamp>-report.<ext>`. A run still in progress answers 409 (its report is written when it ends).
A run that never wrote a report (stopped / killed) gets one built on demand (`suite-run.js --report <dir>` / `smoke-report.js <dir>`), only for requests from this computer; other computers only get existing reports.
Also fixed the same day: the "view only" tag showed on this computer too (its own display rule overrode the `hidden` attribute); `[hidden]{display:none !important}` now covers it.

## Crashed specs in the report (2026-11-20)

`suite-run.js` used to leave a spec file out of `report.md` / `results.json` when its Playwright process died without writing a result (killed, console window closed, crash): its tests silently vanished
(found when 20261120-074639 showed 300 tests instead of 368: `Items_API_Requirements` exited 3221225786 = 0xC000013A, "terminated by Ctrl+C / console closed"). Now the runner writes a marker
`<run folder>/<spec>.json` = `{"crashed":true,"file":...,"exit":...,"stderr":...}`; the report lists it under Failures as `crashed`, and `--resume` (with or without `--redo-failed`) runs that spec again.
That run's folder got a hand-written marker and a rebuilt report. `--report <dir>` now also reads the wall-clock time from the run's `live.ndjson`.

## How it works

- The header logo is the "ROBAR by Innovatum" image from the Web Menu login page (`Images/LoginLogo.bmp`, converted to `scripts/suite-ui-logo.png`, served at `/logo.png`); since 2026-11-20 the PNG has a transparent background (white converted to alpha), so it blends with the light page; in dark mode it sits on a white badge because its text is dark. After changing `suite-ui.js` the running server must be restarted to pick up new routes.

- `scripts/live-reporter.js` is a Playwright reporter. It is active only when `LIVE_EVENTS_FILE` is set and appends one JSON line per event
  (`tests`, `testBegin`, `step`, `testEnd`, `error`) to `<run folder>/live.ndjson`; failure screenshots are copied to `<run folder>/shots/`
  (Playwright wipes `test-results` on the next run). Ad hoc: `LIVE_EVENTS_FILE=reports/live.ndjson npx playwright test <spec> --reporter=list,./scripts/live-reporter.js`.
- `scripts/suite-run.js` (now `spawn`, async) adds runner events to the same file: `runStart` (file list, pid, resume info), `canary`, `fileStart`,
  `fileEnd`, `runEnd` (`finished` / `aborted` on Ctrl+C or SIGTERM / `canary-failed`), and a `hb` heartbeat every 10 s.
  Everything else it does (JSON + JUnit per file, report.md, `--resume`, `--redo-failed`, `--datadog`) is unchanged.
- `scripts/smoke-run.js` writes the same events (one "file" per stage; no heartbeat because it uses `spawnSync`).
- `scripts/suite-ui.js` tails `live.ndjson` and pushes it to the page over server-sent events; it also reports whether the runner pid is alive,
  which is how "runner stopped" (killed / crashed) is shown. The ETA is weighted by the median wall time of each spec file in earlier
  `reports/suite/runs/*/results.json`. Listens on 127.0.0.1 only.

## Notes

- A run that was started with the old runner (before 2026-11-18) has no `live.ndjson`; the page can only replay it after it ends.
- `--resume`: events are appended to the same `live.ndjson`; specs finished in an earlier part of the folder are counted as "already done".
- `SUITE_UI_ROOT=<dir>` points the server at another folder with `reports/{suite,smoke}/runs` (used to test the page with simulated runs).
