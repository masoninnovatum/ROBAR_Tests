---
name: robar-smoke-test
description: >
  Run the ROBAR / Innovatum Suite 7 smoke test on a new build (default environment TST703): preflight (environment readiness), Tier 0 (61 menu tiles, 43 modules open, 20 grids retrieve),
  Tier 1 (writes CL test data: item chain, Master Data, Excel import, Dictionary, attachment, Export Master) and Tier 2 (headed, real mouse: template workflow, Print by Lot to PDF,
  serialized print), then read the results, sort every failure into environment / infrastructure flake / possible product regression / unclassified, and write the one-page build report.
  Use when the user says "smoke test", "run the smoke test on the new build", "is this build OK", "check the new drop", or asks for the build report. Never changes settings, never files tickets.
---

# ROBAR smoke test

Playwright suite in `C:\Users\Mason\ROBAR_Tests` (tests under `tests/Smoke/`, plus existing specs tagged `@tier1` / `@tier2`). This skill runs it, reads the evidence and writes the report. The tests are deterministic and can run without Claude; Claude's job is the judgment: is a failure the environment, a flake, or a real regression?

## Before starting (ask / check, in this order)
1. **Which environment and build?** Default TST703 (`.env` ROBAR_BASE_URL). VAL703 only if the user says so: Tier 1 and Tier 2 WRITE data (CL-prefixed, undeletable). Ask for the expected build (for example 7.0.3.20285) and pass it as env `SMOKE_EXPECTED_BUILD` so the preflight fails on a mismatch. The login page banner is the build truth (TST703 showed 7.0.3.20260 while the newest source snapshot was 20285).
2. **Tier 2 is HEADED and takes the real mouse (FlaUI).** Tell the user: nobody touches the mouse or keyboard for about 8 minutes; no other Chrome window should be in front. If the user cannot give the machine for that time, run `--stages preflight,tier0,tier1` and say Tier 2 was not run.
3. **Never run two Playwright sessions at once** (same seed user Claude01: concurrent logins corrupt each other's server-side query state).
4. Settings are the user's: if the preflight says "environment not ready: X is Y", report it and STOP; follow `robar-setting-flip-protocol` (list the wanted change, the user flips it).

## Run
```
cd C:\Users\Mason\ROBAR_Tests
node scripts/smoke-run.js                       # all stages, ~22 min: preflight 3, tier0 4, tier1 7, tier2 8
node scripts/smoke-run.js --stages tier0,tier1  # a subset
node scripts/smoke-run.js --continue            # keep going after a failed preflight (default: stop)
```
Run it with `run_in_background` and wait for the notification (do not poll). Output: `reports/smoke/runs/<stamp>/` with `<stage>.json`, `attachments/<stage>/` (failure screenshots, copied because Playwright wipes `test-results`), and **`report.md`** (the one-page report: verdict, build, per-stage table, failures with a first-guess class and evidence paths, notes, preflight facts, data left behind). The npm shortcuts (`npm run smoke:fast | smoke:tier1 | smoke:headed | smoke:full`) run the stages without the report.

## Reading a failure (the part that needs judgment)
`report.md` gives a FIRST GUESS class; confirm with the screenshot (`attachments/...`) and the error text, then rerun that stage ONCE before calling it real (`node scripts/smoke-run.js --stages tier1`).
- **Environment / configuration:** preflight line. A setting, Print Config or build is not what the suite expects. Fix = the user, not the tests.
- **Infrastructure flake (rerun once):** "Page crashed" (renderer crash, usually after clicking `#btnReset` on a Dynamic UI page with saved criteria: the helpers remove criteria rows by hand instead), "context or browser has been closed", network errors, the web menu session timeout (clicks land nowhere; re-login).
- **Desktop chain (Tier 2):** "Gave up after ... BarTender", Sentinel / Signature Required / FlaUI errors. Usually someone moved the mouse, the Chrome "Open SentinelLauncher?" prompt stole focus, or BarTender was slow (readiness can exceed 90 s; the smoke spec allows 240 s). Rerun hands off. If it fails twice check the Sentinel client and BarTender (`\\vmsrvtst703\c$\Innovatum\BarTenderLogs\<MMDDYYYY>.txt`).
- **Possible product regression:** a Server Error page, a script error box ("Javascript is not functioning properly"), a message or count that changed. Check `docs/agents/dit-tracker.md` for a known match first (search the module name), then capture exactly what changed.
- **Known quirks that look like failures but are test-side races** (already handled, so a NEW occurrence is information): the Master Data grid restores the account's LAST saved criteria shortly after load (use `mdm.retrieveVerified`), Attachment Management Exactly Matches once raised a JS error (the smoke uses Contains), View and Vote can take more than 5 s to appear, `Print by lot` result text is `Printed PID_<id>.prn to ...` for normal labels and `Printed PID_<id> to ...` (no `.prn`) for S_USerial.
- **Known deviations** are annotations on green tests (`deviation <id>`), listed under Notes: not failures.
- Do NOT "fix" a test to make a real regression disappear. A test change needs the user's go-ahead; say what you would change and why.

## Report to the user (keep it to one page)
Lead with the verdict and the build. Then: per-stage pass/fail and minutes; each failure as one line (what, class, evidence file); anything new (a new Main Menu tile appears as a note); what was not run and why; data left behind (CL test data is undeletable: items, records, a template, PDFs in the OneDrive Documents folder of the Sentinel client user). Offer, do not do: adding findings to `docs/agents/dit-tracker.md`, committing, rerunning a stage.

## Recording
- New product findings -> `docs/agents/dit-tracker.md` (running list; nothing is filed from here, the user reviews with developers).
- New test-side learnings -> the relevant `docs/agents/modules/*.md` and the project memory `project_smoke_test_plan.md`.

## Guardrails
- Test data is `CL`-prefixed (`MB` is legacy). Printing is ONLY to "Microsoft Print to PDF", never a live printer, Copy 1.
- Never change Global Settings, Print Config, security of non-CL users, or the seed user's security; never file tickets; never send the report anywhere unless the user asks.
- The e-signature is filled from `seed.ts` (the user allowed this for smoke runs).
- Do not delete anything on the environment; templates, items, records and print history cannot be deleted anyway.

## Extending the suite
Add a spec under `tests/Smoke/tier0|tier1|tier2/` (or tag an existing proven spec in its title: `@smoke @tier1` / `@smoke @tier2`). Tier 0 = read-only and headless; Tier 1 = headless, writes CL data, each ≤ 3 min; Tier 2 = headed. Each new test must pass three consecutive runs before it is trusted. Related: `robar-playwright-patterns`, `robar-setting-flip-protocol`, `robar-dit-tracking`, memory `project_smoke_test_plan.md`.
