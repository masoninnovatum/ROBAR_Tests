# Test Architecture Audit — Innovatum Suite 7 (branch 7.0.3)

Scope: `team_maturity` = **established** (long-lived, regulated LTS product with an existing
35-project test suite) → full five-dimension audit, as called for by `qa-project-bootstrap`.
Numbers below are measured directly from `Testing/`, not estimated.

## 1. Coverage and Distribution

- **327** source `.csproj` files (excluding `Testing/`, `obj/`, `packages/`) vs. **35**
  dedicated `*.UnitTest` projects — only **~10.7%** of source projects have a matching unit
  test project.
- **814** `[Test]` methods across **251** `[TestFixture]` classes (~3.2 tests/fixture average).
- **Unit-only pyramid.** No integration or E2E test layer exists anywhere in the repo — the
  `WatiN` folder under `Testing/Lib/Bin` is that third-party library's own bundled examples, not
  product tests (confirmed in `.agents/qa-project-context.md`).
- Code coverage % is not measured/tracked today (no coverage tool config found).

## 2. Reliability

- **Not measured.** No CI flakiness history is accessible from this checkout (see CI/CD gap in
  `.agents/qa-project-context.md`) — recorded as unknown rather than guessed.
- Indirect signal: of the tests that *do* exist, several are permanently disabled specifically
  because they were unreliable in a way no one fixed (see Risks below) — the suite appears to
  route around reliability problems rather than resolve them.

## 3. CI Health

- **Not measured.** Whether this suite runs automatically on the build server and whether a
  failure blocks a build is unconfirmed (same open question as in the project context file).
  This audit cannot report duration, pass rate, or retry rate until that's answered.

## 4. Technical Debt

- **30 actively-`[Ignore]`d tests** (~3.7% of all `[Test]` methods), plus **6 more** `[Ignore]`
  lines that are themselves commented out (dead remnants in `CreatePDFServiceTest.cs` and
  `ViewAndVoteTests.cs` — the attribute has no effect, so those tests currently run; the leftover
  comment is stale documentation, not a live skip). 0 `[Explicit]`. Reasons on the active 30 are
  recorded inline and cluster around environment coupling, e.g.:
  - `"This test is coupled to RS connection. Revisit after injecting the rs connection."`
  - `"This test relies on Data. Need to insert data as part of test or Setup method"`
  - `"Data Dependent and Print Server> Don't think it's maintainable but there's a lot of work
    here"` / `"This Requires PrintServer"`
  - `"I don't think these are maintainable, but need someone to confirm before I delete these."`
  - `"We need these tests, but need to set them up programatically."`
- **31 `Thread.Sleep` calls** — timing-based waits rather than explicit conditions.
- **7 files** contain hardcoded connection strings (`Server=` / `Data Source=`) — a plausible
  root cause for several of the `[Ignore]`s above.
- **9 `TODO`/`FIXME`** markers remaining in test code.
- Only **1** file uses the `DbTestBase` real/test-database base class despite it existing in
  `Innovatum.UnitTest` — real-DB-backed integration-style testing is set up but essentially
  unused in practice.

## 5. Conventions

- **57 files** use RhinoMocks (`MockRepository`/`mocks.`) — isolated, mock-driven unit testing
  is the dominant and consistent pattern.
- Naming and layout are consistent: `{ClassName}Tests.cs`, one `*.UnitTest` project per source
  assembly, feature subfolders mirroring source structure (already captured in
  `.agents/qa-project-context.md` → Conventions).

---

## Findings

**Strengths**
- A genuinely broad unit-test footprint for a 15+ year old enterprise codebase: 814 tests, 251
  fixtures, consistently named and organized 1:1 against source assemblies.
- Isolation discipline — RhinoMocks is used deliberately and widely rather than tests reaching
  for real dependencies by default.
- Skips are explained, not silent — every `[Ignore]` sampled carries a human-readable reason,
  which is rare and valuable context most suites lose.

**Gaps**
- No integration or E2E layer at all. The three Critical risk areas from
  `.agents/qa-project-context.md` (ROBAR print path, Sentinel plugin chain, Campaign Manager
  approval workflow) have no automated coverage above whatever unit tests happen to touch their
  edges.
- ~290 of 327 source projects (89%) have no dedicated unit test project — including several
  Sentinel/Pages/API plugin projects.
- CI enforcement status is unknown, so even the unit tests that exist may not currently gate
  anything.

**Risks**
- The 30 actively-ignored tests are disproportionately clustered on exactly the areas already flagged
  Critical in the project context — print server dependency and RS-connection coupling map
  directly to the ROBAR print path and Sentinel chain risk entries.
- 31 `Thread.Sleep` calls are a standing source of slow and/or silently-flaky tests.
- Several `[Ignore]` reasons are explicitly undecided ("need someone to confirm before I delete
  these") with no owner or date — this is debt that has been sitting indefinitely, not debt with
  a plan.

**Quick Wins**
- Triage all 30 actively-ignored tests (and delete the 6 stale, already-inert `[Ignore]` comments) into delete-vs-fix with an owner and date; a few already
  self-identify as candidates for deletion.
- Replace the 31 `Thread.Sleep` calls with explicit wait/poll conditions where the underlying
  call supports it.
- Move the 7 hardcoded connection strings into `Innovatum.TestingUtilities` so the
  environment-dependent tests they block can actually run instead of staying permanently skipped.

**Strategic Work**
- Stand up an integration/E2E layer for the Critical risk-area flows — today they are
  effectively untested above the unit boundary.
- Extend unit coverage into the ~290 source projects with no test project, prioritized by the
  Risk Areas table in `.agents/qa-project-context.md` rather than uniformly.
- Confirm (and if absent, establish) real CI enforcement of this suite — until that's resolved,
  this audit's numbers describe a test suite, not a quality gate.

## Scope Note

The onboarding-specific parts of `qa-project-bootstrap` (30-Day Ramp Checklist, Mentorship
Patterns, Framework Walkthrough) were intentionally skipped — there is no specific new hire
being onboarded right now, so producing a ramp plan or walkthrough doc would be inventing a
scenario. Re-run those sections of the skill when an actual person needs onboarding.
