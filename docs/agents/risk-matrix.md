# Risk Matrix — Innovatum Suite 7 (branch 7.0.3)

Deepens the Risk Areas table in `.agents/qa-project-context.md` into full impact×probability
scoring, failure mode analysis, and coverage-gap tracking per `risk-based-testing`. Six risk
items carried forward, no new items invented — scored independently on Impact and Probability
rather than as a single pre-multiplied number.

**Known limitation:** the skill's Phase-6 churn signal uses `git log`; this project is SVN, and
no `svn.exe` CLI is available in this environment (confirmed unavailable — see
`.agents/qa-project-context.md`). Churn-by-module ranking is deferred until run from a machine
with SVN CLI access, or via TortoiseSVN's log export. Not fabricated here.

## Phase 2: Classification

| # | Risk Item | Impact | Probability | Score | Zone |
|---|---|---|---|---|---|
| 1 | Label print correctness (ROBAR print path) | 5 – Catastrophic | 4 – Likely | 20 | CRITICAL |
| 2 | Sentinel plugin chain (Launcher→Tray→Plugin) | 4 – Major | 4 – Likely | 16 | CRITICAL |
| 3 | Campaign Manager approval workflow | 5 – Catastrophic | 3 – Possible | 15 | CRITICAL |
| 4 | Installer/upgrade seed-data drift | 3 – Moderate | 4 – Likely | 12 | HIGH |
| 5 | Trading-partner data submission (GUDID) | 4 – Major | 2 – Unlikely | 8 | MEDIUM |
| 6 | CSP rollout regressions | 2 – Minor | 3 – Possible | 6 | MEDIUM |

Scores match `docs/qa-strategy.md` §5 — no drift between the two documents.

## Phase 3: Failure Mode Analysis (score ≥ 10)

### 1. Label print correctness (ROBAR print path) — Score 20, CRITICAL

```
Failure Mode 1: Stale Master Data reaches a printed label
  Trigger:            Timing gap between a Master Data (EAV) edit in DataManagement.Web and
                       ROBAR pulling item data at print time
  Blast Radius:       Every label printed during the stale window — direct patient-safety and
                       FDA-labeling risk, since this is the product's core regulated function
  Detection Method:   None automated identified. No E2E coverage of the print path exists
                       (test-architecture-audit.md). Manual visual verification is the only
                       known safety net.
  Current Mitigation: Print-server-dependent unit tests exist but are disabled:
                       PrintRequestManagerTests.cs ("This Requires PrintServer"),
                       PrintRequestRemoteTests.cs ("Data Dependent and Print Server...")
  Gap:                No integration/E2E test exercises "Master Data change → print output."
                       The tests closest to this exact concern are the ones currently ignored.
  UPDATE 2026-09-16:  This is no longer a theoretical gap for the MDM-linked-item sub-case.
                       A code-trace investigation (see .agents/test-generation-browser-printing.md
                       SC-10, and the "Confirmed bug" entry in robar-module-reference.md's
                       "Browser Printing" section) confirmed the exact mechanism: the print
                       wizard checks MDM approved/effective status once, at initial item entry,
                       and caches it in PrintSubSession for the rest of the flow — the final
                       Print submit never re-checks it. Recommend filing a DIT ticket; a
                       regression test asserting the FRS-required (currently failing) behavior
                       is being added to ROBAR_Tests.

Failure Mode 2: BarTender print job silently fails or produces malformed output
  Trigger:            BarTender API error, print-server/BarTender version mismatch, malformed
                       print request payload
  Blast Radius:       Missing or corrupted physical label at the point of use
  Detection Method:   Unknown — depends on Innovatum.Logging output; no automated check found
  Current Mitigation: PrintingServiceTests.cs is disabled ("Setup/Teardown need label data and
                       printers")
  Gap:                Zero automated coverage of the BarTender handoff itself
```

### 2. Sentinel plugin chain — Score 16, CRITICAL

```
Failure Mode 1: Plugin fails silently with BadImageFormatException
  Trigger:            A ported/older plugin DLL built for x86 loaded into a 64-bit Tray/host
                       process — CLAUDE.md explicitly documents this as a known porting hazard
  Blast Radius:       The affected plugin fails to launch; per CLAUDE.md this "does not surface
                       as a meaningful user-facing error" — the user sees a dead end
  Detection Method:   None automated — would require a smoke test that actually launches each
                       plugin and confirms its handshake
  Current Mitigation: Manual verification during porting, per CLAUDE.md's porting checklist
  Gap:                Zero dedicated unit test projects exist for any Sentinel plugin
                       (confirmed: no *Sentinel* project under Testing/) — this whole risk area
                       has 0% unit coverage, not just missing integration/E2E

Failure Mode 2: Misconfigured ClientWcfURL breaks the launch handshake
  Trigger:            A Sentinel plugin installer registered with the ServiceHost-side WCF
                       address instead of the plugin's own hosted PluginClientInterfaceService
                       pipe — CLAUDE.md flags this as an easy, documented mistake
  Blast Radius:       Tray can't verify plugin liveness or deliver tokens; launch chain breaks
                       "without a clear error" (CLAUDE.md's own wording)
  Detection Method:   None automated
  Current Mitigation: Manual cross-check against SentinelExeVersions.ClientWcfURL in the
                       reference database, per CLAUDE.md
  Gap:                No automated test validates a plugin's registered ClientWcfURL against
                       what the plugin actually exposes
```

### 3. Campaign Manager approval workflow — Score 15, CRITICAL

```
Failure Mode 1: An item reaches print without completing ViewAndVote
  Trigger:            Authorization gap or race condition in MassApprove/MassPrint against an
                       item still mid-ViewAndVote
  Blast Radius:       A label change reaches print without the approval this regulated
                       environment requires — direct compliance/audit-trail impact
  Detection Method:   None automated confirmed — ViewAndVoteControllerTests.cs has 9 disabled
                       tests with no recorded reason at all (bare [Ignore])
  Current Mitigation: Unverified — the tests most likely to cover this are the disabled ones
  Gap:                The 9 unexplained ignores are themselves the finding: someone needs to
                       determine whether they were disabled for a mundane reason (missing test
                       double) or because they exposed a real gap — see sprint-1-test-plan.md G4

Failure Mode 2: Audit trail doesn't reliably capture who approved what, when
  Trigger:            Approval action fails to persist actor/timestamp correctly, or persists it
                       in a form that's editable after the fact
  Blast Radius:       Regulatory audit failure if approval history can't be reconstructed
  Detection Method:   Unknown — no test found asserting audit-trail immutability specifically
                       (as distinct from approval-state transition)
  Current Mitigation: Unknown
  Gap:                No test found for audit-trail integrity as its own concern
```

### 4. Installer/upgrade seed-data drift — Score 12, HIGH

```
Failure Mode 1: Fresh-install seed data isn't mirrored into the upgrade script
  Trigger:            Manual, memory-dependent cross-check process — CLAUDE.md itself instructs
                       "Always cross-check every seed data type added by the feature against its
                       upgrade script before the feature reaches QA"
  Blast Radius:       Every existing customer upgraded via script (not fresh-installed) silently
                       misses the new data — localizations, GlobalSettings, Securities,
                       Processes, Codes
  Detection Method:   None automated; relies entirely on developer discipline and code review
  Current Mitigation: Documented process in CLAUDE.md, enforced by convention only
  Gap:                No scripted diff between fresh-install seed definitions
                       (Innovatum.Install/ROBARDB/.../Default_Localizations/, etc.) and the
                       corresponding upgrade-script INSERTs
```

## Phase 4: Heatmap

```
                    Rare(1)   Unlikely(2)     Possible(3)         Likely(4)              Frequent(5)
  Catastrophic(5)                                                 ROBAR print path(20)
  Major(4)                    GUDID(8)                             Sentinel chain(16)
  Moderate(3)                                  CSP regressions(6)  Seed-data drift(12)
  Minor(2)
  Negligible(1)
```

(Campaign Manager approval workflow: Catastrophic(5) × Possible(3) = 15, same row as ROBAR print
path's column-3 but shown separately above for clarity — both are CRITICAL.)

## Phase 5: Coverage Alignment — Gap Analysis Worksheets

```
Feature: ROBAR print path                          Risk Zone: CRITICAL   Score: 20
Required Coverage (per zone):
  Unit:        90%+ branch coverage    Current: unit tests exist but 3 disabled (PrintRequest*)  Gap: re-enable + expand
  Integration: all service boundaries  Current: none                                             Gap: 100%
  E2E:         full journey+errors     Current: none                                             Gap: 100%
  Monitoring:  real-time alerts        Current: none confirmed                                   Gap: 100%
Priority: P0   Estimated Effort: TBD — scope during qa-strategy.md Phase 2/3
Owner: TBD     Target Sprint: qa-strategy.md Phase 2 (Weeks 5-10) for integration,
               Phase 3 (Weeks 11-16) for E2E

Feature: Sentinel plugin chain                     Risk Zone: CRITICAL   Score: 16
Required Coverage:
  Unit:        90%+ branch coverage    Current: 0% — no dedicated test project exists  Gap: 100%, largest gap in this matrix
  Integration: all service boundaries  Current: none                                   Gap: 100%
  E2E:         full journey+errors     Current: none                                   Gap: 100% (browser-side leg only, per qa-strategy.md §7)
  Monitoring:  real-time alerts        Current: none confirmed                         Gap: 100%
Priority: P0   Estimated Effort: TBD — larger than other CRITICAL items since unit tier is also missing
Owner: TBD     Target Sprint: qa-strategy.md Phase 2-3

Feature: Campaign Manager approval workflow        Risk Zone: CRITICAL   Score: 15
Required Coverage:
  Unit:        90%+ branch coverage    Current: tests exist, but 11 disabled across ViewAndVote*  Gap: triage (sprint-1-test-plan.md G4-G5), then expand
  Integration: all service boundaries  Current: none                                              Gap: 100%
  E2E:         full journey+errors     Current: none                                              Gap: 100%
  Monitoring:  real-time alerts        Current: none confirmed                                    Gap: audit-trail-specific alerting not found
Priority: P0   Estimated Effort: TBD
Owner: TBD     Target Sprint: triage this sprint (sprint-1-test-plan.md); integration/E2E in qa-strategy.md Phase 2-3

Feature: Installer/upgrade seed-data drift         Risk Zone: HIGH   Score: 12
Required Coverage:
  Unit:        80%+ branch coverage    Current: N/A — this is a process gap, not a code-unit gap  Gap: needs a scripted check, not unit tests
  Integration: key interactions        Current: none                                              Gap: 100%
  E2E:         happy+top3 errors       Current: none required at this zone for a build-time check Gap: N/A
  Monitoring:  dashboard+daily review  Current: none                                               Gap: 100%
Priority: P1   Estimated Effort: Small — a diff script between seed definitions and upgrade inserts
Owner: TBD     Target Sprint: Quick Win, per test-architecture-audit.md — candidate for Phase 1
```

## Phase 6: Reassessment

- **Cadence:** quarterly at minimum, aligned with `docs/qa-strategy.md`'s quarterly review trigger.
- **Triggers:** within 48 hours of any production incident touching a scored item; when a new
  Sentinel plugin or InnoPages feature ships; when a critical dependency changes (BarTender SDK
  version, GUDID API version); when team composition changes.
- **Churn signal:** deferred — no `svn.exe` CLI available in this environment. Next reassessment
  should run `svn log -v` (or TortoiseSVN's log export) over the last 3 months and rank
  modification frequency by module, the SVN equivalent of the skill's `git log` churn command.
- **Near-misses:** none logged yet — start tracking any staging/QA catch on a CRITICAL/HIGH item
  as a near-miss with the same rigor as a production incident, per Core Principle 4.

## Related Documents

- `.agents/qa-project-context.md` — source Risk Areas table this matrix deepens.
- `.agents/test-architecture-audit.md` — coverage evidence (disabled tests, `Thread.Sleep` count,
  RhinoMocks usage) cited throughout the failure mode analyses above.
- `docs/qa-strategy.md` §5, §11 — this matrix's scores and target sprints are the same ones
  referenced there; kept in sync deliberately.
- `docs/sprint-1-test-plan.md` — the concrete triage tasks (G1-G17) that address the Campaign
  Manager and print-path unit-test gaps identified here.
