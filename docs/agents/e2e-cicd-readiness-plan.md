# E2E CI/CD Readiness Plan — ROBAR Browser/Sentinel Automation

Hypothetical future-state plan, written 2026-09-16 in response to "if ROBAR moves from SVN to
Git, what's the exact setup to run these E2E flows fully automated on every build?" **ROBAR is
still on SVN today** — nothing here is implemented; this documents what would need to exist.
Grounded in what this session actually confirmed while building `ROBAR_Tests`' Browser-Printing
suite, plus what's already true for the existing Template-Management/Campaign-Manager/
Master-Data-Management suites. Where a specific setting/process is asserted, it's cited to where
it was confirmed; anything not yet verified is flagged as needing an audit, not guessed.

---

## 1. CI runner requirements

**Must be a self-hosted Windows runner, not a hosted/cloud Linux runner.** Confirmed reasons from
this session and the existing suite:
- Template Management's BarTenderEdit flow requires **FlaUI** (`FlaUIAutomation.exe`, .NET 8) to
  drive native Windows UI Automation — confirmed working, but only because a real Windows desktop
  session with BarTender installed exists (`ROBAR_Tests\tests\Template-Management\
  Create_and_Approve_Template.spec.ts:40-160`).
- Browser Printing's `ClientPrintMethod=Sentinel` setting means print submission itself depends on
  a live **Sentinel Tray** process being installed, running, and able to complete a handshake —
  confirmed today as the actual blocker (`"Timeout waiting for Sentinel."` server response), not
  merely a dialog to click through.
- **Concrete runner requirements:**
  - Windows Server or Windows 10/11, GUI session available (not Server Core headless) — FlaUI and
    Sentinel both need a real interactive desktop, not just a background service host.
  - BarTender installed and licensed (or a licensed floating/network seat reachable from the
    runner).
  - Sentinel Launcher/Tray installed and configured to point at the target test environment's
    `Innovatum.API` (the `SentinelExeVersions.ClientWcfURL`/server-address pattern documented in
    this repo's `CLAUDE.md` "Adding a new Sentinel plugin installer" section).
  - A printer target available to the runner's Windows session — "Microsoft Print to PDF" is
    sufficient and is the one already approved for use in this codebase's automation (never a
    real physical printer, per this project's constraints).
  - Chromium/Chrome for Testing (Playwright's bundled browser) — already working today.
  - Self-hosted GitHub Actions runner / Azure DevOps self-hosted agent / Jenkins agent, registered
    against this specific machine — the actual CI product doesn't matter much here, the
    **Windows-desktop-with-BarTender-and-Sentinel** requirement is the hard constraint regardless
    of which CI system triggers it.
  - Running as a real interactive Windows user session (not `NT AUTHORITY\SYSTEM` / a service
    account with no desktop) — FlaUI and Sentinel's native windows won't exist otherwise. This
    usually means an auto-logon VM with the runner's agent configured to run "interactively," which
    has its own security tradeoffs worth a deliberate decision, not a default.

## 2. Test environment / deployment target

**Revised per Mason (2026-09-16): this doesn't need to be invented from scratch.** A per-version
VM already exists as "the server" for each release series (6.0.7, 7.0.3, etc. — this session used
`vmsrvtst703` for 7.0.3, DB presumably `robartst607` per this repo's porting guidance). The CI plan
should build on this existing topology rather than propose a parallel one:

- **Server role (existing model, reused):** the per-version VM hosts the five websites, the
  Windows services (including `Innovatum.ServiceHost`), and the database. For CI, the pipeline
  redeploys the new build to the VM matching the branch under test (`7.0.3`'s VM for `7.0.3`
  builds, etc.) — the same VM-per-version model already in place, just triggered automatically
  instead of manually.
- **Client/runner role (new, needed for automation):** Sentinel, BarTender, and FlaUI are all
  **client-side** technologies — they run on the machine acting as the browser-print requester,
  not on the app-server VM. So the CI runner from section 1 (self-hosted Windows, BarTender +
  Sentinel Tray installed) is logically a **separate client machine** pointed at the version VM's
  URL, not the VM itself. Two reasonable topologies:
  - One shared client runner, parameterized by target environment URL (`seed.ts`'s `ROBAR_BASE_URL`
    pattern already supports this) — simplest, reuse across versions being tested.
  - One client runner paired per version VM — avoids any cross-version config confusion (e.g., a
    runner that's had Sentinel plugins registered for 7.0.3 shouldn't also be relied on for
    6.0.7's different plugin versions) at the cost of more machines to maintain. Recommend this if
    more than one version is ever tested in parallel; the shared-runner approach otherwise.
- Not a shared environment other manual testers are actively using concurrently while CI runs
  against it, to avoid state collisions (the Label Type Exclusion Maintenance section of
  `robar-module-reference.md` already documents one real instance of cross-session state bleed on
  a shared environment) — if the existing per-version VM doubles as a manual-QA environment today,
  CI runs need to either be scheduled around that or the model needs a second, CI-only VM per
  version cloned from the same baseline.
- Given ROBAR is on-premise, per-customer software (per `qa-project-context.md`: "no shared
  production URL, no centrally controlled environment parity") — this VM is explicitly an
  **internal QA/test stand-in**, not a customer environment; test results validate the build, not
  any specific customer's configuration.
- Deployment automation to push a fresh build to the version's VM before each test run (IIS
  app-pool recycle / redeploy of the five websites + relevant Windows services) — not designed
  here, but is a prerequisite: the pipeline needs to know the build succeeded and was deployed
  before kicking off Playwright. See section 4 for the settings-change restart procedure
  specifically.

## 3. Security processes (test account setup)

**Principle:** the CI service account needs a role/group with exactly the security processes the
in-scope test scenarios require — no more (least privilege, and matching a real customer's likely
posture rather than testing against an all-access superuser, which the module reference already
flags as a distortion — see `MBAllSecurity`'s over-broad default behavior for
`BP_AllowMfgChangeAtPrint`/`BP_AllowMfgSetAtPrint`).

**Confirmed relevant to Browser Printing, from this session + module reference:**
| Security Process | Governs |
|---|---|
| `Print_Unapproved_Items` / `Print_Ineffective_Items` / `Print_Unapproved_Labels` / `Print_Ineffective_Labels` | Version Printing override flow (SC-06) |
| `BP_AllowMfgChangeAtPrint` / `BP_AllowMfgSetAtPrint` | Manufactured-date editing at print time |
| `Override_Lot_At_Print` | Lot override checkbox visibility |
| `BP_Reprint_Label` (live message says this; formal script `BPSecurity1.3` says `Reprint_Label` — cosmetic discrepancy, confirm which is real before relying on either name) | Reprint gating |
| `BP_Test_Print` / `BP_Test_Print_Override` | Test Print feature and override (out of scope this pass) |
| `Specify_Starting_Serial_Num` | Serialized-label starting serial entry (out of scope this pass) |
| `MD_Create_Records`, `MD_AssignLabels_Option`, `MD_MassApprove_Option`, `MD_SaveAsNew_Version` | MDM fixture creation/linking (needed for SC-07/08/09/10 once the Sentinel blocker is resolved) |

**Not yet audited:** a full enumeration of every security process this scenario set touches would
need a live pass against Security Management for the specific test role, the same way this
session did for the modules it actually exercised. Don't assume the table above is exhaustive —
treat it as "confirmed so far," and audit before relying on it for CI account provisioning.

**Provisioning approach for CI:** a dedicated, clearly-named service account (not a shared human
tester's login) with a Security Management role scoped to exactly the above, recreated/verified
as part of environment setup rather than assumed to already exist correctly — Security Management
changes are one of the things a stale test environment silently drifts on.

## 4. PrintConfig settings

**Confirmed relevant, from this session:**
| Setting | Scope (ConfigName/PrintFunction) | Required value for automation |
|---|---|---|
| `ClientPrintMethod` | per printing module | `Sentinel` for Chrome-based clients (confirmed by Mason) — this is the setting driving the Sentinel-Tray dependency in section 1, not something to "turn off" for CI, since it's testing the real customer-facing configuration |
| `AddLotReasonRequired` | `LotNumber`/`MultiDocPrint`/etc. | Whichever value matches the scenario under test — SC-01 (auto-create Lot) needs to know this setting's state going in, since `Y` adds a Reason Code step this session's scenarios didn't design for |
| `TestPrintShow` / `TestPrintRequiredForLot` / `TestPrintRequiredForSession` | `LotNumber` | Out of scope this pass, but noted for a future Test Print scenario set — remember the IISRESET requirement above |
| `PrintServerTimeout` | print-server-dependent flows | Needs to be long enough that a real (if slow) Sentinel/print-server round-trip doesn't get misclassified as a CI infra failure vs. a genuine defect |
| `NeedESignatureForReprint` | reprint flows | Should be left in its default/off state for automation, or any reprint scenario needs to stop short of the e-signature step per this codebase's hard automation constraint (never drive e-signature fields) |
| `EnforceMasterDataStatus` | MDM-linked printing | Directly relevant to SC-07/SC-10 — confirm its value in the CI environment matches what the FRS requirements (REQ-12/13) assume |

**Not yet audited:** `AllowManualDateEntry`, `ManualEntryDateFormat`, `WarnWhenPrintedLabelsExceedsValue`,
`SecurityPrefix`, and the Miscellaneous/Destination-Labeling-specific PrintConfig families are
documented in `robar-module-reference.md` but weren't scenario-relevant this pass — audit before
expanding scenario coverage into those areas.

**Provisioning approach:** bake required PrintConfig values into the version VM's baseline (via
`Innovatum.Install`/seed data, matching this codebase's own schema-authority convention) rather
than having the test suite flip settings at runtime on every run — restart costs (below) make
runtime toggling expensive for CI. If a specific scenario genuinely needs a non-default PrintConfig
value, that's a signal that scenario belongs in its own isolated environment/pipeline stage, not
squeezed into the same run as everything else.

## 5. GlobalSettings

**Confirmed relevant, from module reference (Browser Printing + Destination Labeling sections):**
`ShelfLifeShareName`, `Image_Version_Management_On`, `ViewCompareAutoAlignment`,
`DefaultDestination`. None of these were exercised by this session's delivered scenarios (SC-04,
SC-05), so their required values for CI aren't yet confirmed live — needs the same live-audit
treatment as the PrintConfig table above before depending on them.

## 6. Settings-change restart procedure — mandatory, confirmed by Mason (2026-09-16)

**Any GlobalSetting update on the version VM requires BOTH of the following, every time, no
exceptions:**
1. Restart the **`Innovatum.ServiceHost`** Windows service on that VM.
2. Run **`iisreset`** on that VM.

This is a hard, deterministic rule (not the per-setting inconsistency noted for some PrintConfig
values below) — build the CI pipeline around it rather than trying to detect which settings need
it. Practical implications for automation:

- **Never toggle a GlobalSetting mid-suite.** Every restart+IISRESET cycle takes the whole VM's
  websites and services offline for its duration — doing this between test files would serialize
  the entire suite around service bounces and multiply total run time. Bake every GlobalSetting
  the suite depends on into the VM's baseline configuration once, before the suite starts, not as
  a per-scenario setup step.
- **The restart must be a scripted, remote-executable pipeline stage**, not a manual step someone
  performs before triggering CI — e.g. a PowerShell Remoting (`Invoke-Command`) or WinRM step from
  the CI orchestrator to the version VM: update the GlobalSettings row(s), `Restart-Service
  Innovatum.ServiceHost` (confirm the actual registered service name matches this repo's service
  installer naming), then `iisreset` on that same VM, then a readiness check (poll the WebMenu
  login page until it responds) before the pipeline proceeds to seeding/running tests.
- **This directly shapes the pipeline's stage ordering** (see section 7's revision): any
  GlobalSettings baseline check/correction has to happen, with its restart+IISRESET, strictly
  *before* the seed step and *before* Sentinel Tray / IIS app pools are assumed to be warm and
  ready — a test that starts probing the app mid-restart will fail for infrastructure reasons that
  look like product defects if this ordering isn't respected.
- **PrintConfig, by contrast, is confirmed inconsistent per-setting** — `robar-module-reference.md`
  documents that `PrintConfig.EnforceMasterDataStatus` changes are *not* followed by a restart
  step, while the `TestPrint*` family *is* IISRESET-dependent. Don't assume PrintConfig follows the
  same always-restart rule as GlobalSettings — audit each PrintConfig value the suite depends on
  individually, but treat every GlobalSettings dependency as restart-required by default.

## 7. Test data / fixtures strategy

**Recommendation: seed via API/DB, not live UI clicks, for anything that must exist before a test
run starts.** This session's fixture plan for SC-07/08/09/10 (MDM record → approve → link via
Assign Labels → template check) was designed as live UI automation because that's how this
session validated it interactively — but for a CI pipeline that runs on every build, driving
5+ minutes of UI clicks just to get to a starting state on every single run is slow and adds
its own flakiness surface. Prefer:
- A one-time or idempotent seed script (direct DB insert via `Innovatum.Install`'s schema
  definitions, or a dedicated internal API call) that creates the MDM record, ROBAR item, Lot,
  and Order fixtures needed, checking for existence first so re-runs don't duplicate.
- Reserve live-UI-driven fixture creation for the tests that are *specifically testing* that
  creation flow (e.g., Master Data Management's own `Create_New_Record.spec.ts`) — don't make
  every other test pay that cost as a side effect.
- This is a design change from what this session actually did live (necessarily, since it was
  exploring/discovering the flow for the first time) — flagging it as the CI-appropriate
  approach going forward, not a criticism of today's approach.

## 8. Pipeline stages (proposed)

1. **Trigger** — on merge to the relevant branch (mirroring today's `7.0.3` release-branch model)
   or on a build-server event, matching how `Build.proj`/`SvnRevision` already trigger builds.
2. **Build** — existing `Build.proj` MSBuild pipeline, unchanged.
3. **Deploy** — push the new build to the branch's version VM (websites + Windows services +
   Sentinel plugin installers, per `Innovatum.Install`'s dynamic installer system).
4. **Reconcile settings, then restart** — compare the VM's current GlobalSettings/PrintConfig/
   Security state against the suite's required baseline (sections 3-5); if anything needed
   correcting, apply it, then unconditionally run the section 6 procedure
   (`Restart-Service Innovatum.ServiceHost` + `iisreset`) before proceeding — even if this stage
   *thinks* nothing changed, prefer restarting anyway after a fresh deploy rather than trusting a
   diff to catch every drift case. Follow with a readiness poll (WebMenu login page responds)
   before moving on.
5. **Seed** — idempotent fixture/test-data seed script (section 7), run only after step 4 confirms
   the app is back up.
6. **Run** — `npm test` (or a scoped subset) from `ROBAR_Tests`, on the self-hosted Windows client
   runner with BarTender + Sentinel Tray live (section 1), pointed at the version VM.
7. **Report** — HTML/JSON test report as a build artifact; feed pass/fail back to the build
   pipeline as a gate (or, initially, as a non-blocking nightly report while the suite matures —
   recommend starting here rather than gating releases on a suite that's still finding its own
   false positives, like the Campaign Manager server error this session hit and didn't root-cause).
8. **Tracking** — any newly-confirmed defect from a CI run should still flow into
   `.agents/dit-tracker.md`'s convention, ideally automated (a bot comment/ticket-filing step)
   rather than manual, once the manual process is well-understood.

## 9. Credentials and secrets

- CI service account credentials (section 3) via the CI system's secret store, never checked into
  either repo — `ROBAR_Tests`' existing `.env`/`seed.ts` pattern (env vars, `.env` gitignored)
  already points the right direction; a CI pipeline supplies these as real secrets, not a
  committed `.env`.
- **Hard constraint, unchanged by any of this:** automated tests never drive password or
  e-signature fields, even in CI, even with a dedicated service account — this is a standing rule
  in this codebase (`formal-test-script-execution`'s credential-boundary note), not a CI-specific
  relaxation. Any scenario needing an e-signature step stops short of it in CI exactly as it does
  today.

## 10. Known blockers to resolve before any of this is buildable

1. **Sentinel Tray print-submission timeout** (this session's actual finding) — need to confirm
   whether a properly-running Sentinel Tray on the CI runner resolves this, or whether there's a
   deeper reason print submission can't complete outside an interactive human session at all.
   This is the single biggest open question — worth a focused, small investigation before
   investing in the rest of this plan.
2. **Legacy WebForms postback not firing from Playwright's native `.click()`** — this session's
   `nativeClick` (`frame.evaluate(() => el.click())`) workaround in `tests/support/printing.ts`
   handled two of three wizard transitions; confirm it's robust across the rest of Browser
   Printing and doesn't mask timing issues that would flake under CI's likely-different
   performance characteristics.
3. **Campaign Manager ASP.NET Runtime Error** (reproduced twice, not root-caused) — needs
   diagnosis; if it's environment-specific to `vmsrvtst703`'s current state, a dedicated CI
   environment might not even reproduce it, but that should be confirmed, not assumed.
4. **Restart/IISRESET automation itself needs building** — confirm the exact `Innovatum.ServiceHost`
   service name and whether the account running the CI pipeline has the rights to restart a
   Windows service and run `iisreset` remotely on the version VM (PowerShell Remoting/WinRM needs
   to be enabled and reachable from the CI orchestrator) — this is new infrastructure work, not
   something to assume already exists just because manual restarts happen today.
5. **Regulated-environment consideration** — if this suite ever gates an actual release build
   (not just reports nightly), that gating logic itself likely falls under this codebase's "changes
   to validated functionality may require formal validation activities" principle (per this
   repo's `CLAUDE.md`). Worth a deliberate conversation with whoever owns validation/QA process
   before wiring E2E results into a release gate, separate from the purely technical setup above.

---

## Summary: minimum viable version

If the goal is "something real running automatically" rather than full coverage immediately:
1. One self-hosted Windows **client** runner (separate from the existing per-version server VM),
   BarTender + Sentinel Tray installed and confirmed working interactively against that version's
   VM (test this in isolation before wiring up CI).
2. A scripted, remote-executable restart procedure (`Restart-Service Innovatum.ServiceHost` +
   `iisreset`, section 6) for that version's VM, proven reliable before it's trusted as an
   unattended pipeline stage.
3. A small, currently-unblocked scenario slice (SC-04, SC-05 — already delivered and passing
   today) running nightly first, reporting only — no gating — while the Sentinel print-submission
   blocker (item 10.1) gets solved separately.
4. Expand scenario coverage (SC-01/07/08/09/10, then SC-02/03/06) only once that blocker is
   resolved and the seed-based fixture strategy (section 6) replaces today's live-UI fixture
   approach.
