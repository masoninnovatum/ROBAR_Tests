# QA Project Context — Innovatum Suite 7 (branch 7.0.3)

## Product

**Name:** Innovatum Suite 7

**Summary:** Enterprise label management and printing platform for regulated medical device
environments — spans label design/approval workflows, master data management, print execution
via BarTender, and trading-partner/regulatory data submission (e.g. FDA GUDID).

**Type:** On-premise enterprise software installed per customer site (regulated medical device
manufacturers) — not a multi-tenant SaaS product. No single shared production URL; see
Environments.

**Key user journeys:**
1. User authenticates via `Web/WebMenu` (legacy) or `Innovatum.WebMenu` (OWIN/OpenIdConnect) and
   prints a label from `Web/ROBAR/Printing`.
2. Master Data (EAV item attributes) is created/edited in `Innovatum.DataManagement.Web` and
   feeds label content at print time.
3. Campaign Manager workflow: import items (XLS), route through approval (`ViewAndVote`), then
   mass approve / mass print / mass update.
4. Sentinel chain: browser launches Launcher → Tray → a desktop plugin (BarTenderEdit,
   DocumentEdit, GenericTemplateEdit, ItemRtfEdit, PrintTimeRedlineCompare,
   Printing.SinglePieceFlow) to edit or print a label outside the browser sandbox.
5. ROBAR Print Server polls the database for queued print jobs and drives BarTender (3rd-party)
   to fulfill them.
6. Communications Manager transmits item data to external trading partners, including FDA GUDID
   submissions.
7. InnoPages-hosted features (Item Management, Template Management, Workflow Management, Master
   Data XLS Import) served as plugin DLLs inside `Innovatum.Pages.Web`.
8. System Monitor tracks health of services/websites for operations visibility.
9. New customer/environment onboarding via ConfigManager + `Innovatum.Install` (schema + seed
   data generation) and Setup Factory installers for client-side Sentinel deployment.

## Tech Stack

- **Frontend:** Knockout.js 3.5.1 + knockout-secure-binding (CSP-compatible binding provider),
  jQuery 3.7.0, jQuery UI 1.13.2, jqGrid, Bootstrap CSS.
- **Backend:** C# / .NET Framework 4.x. ASP.NET Web Forms (legacy) + ASP.NET MVC (modern) across
  five websites; WCF services hosted in `Innovatum.ServiceHost`.
- **API style:** Mix of ASP.NET MVC/Web API (`Innovatum.API`) and WCF contracts (`IXxxService`
  interfaces) for internal service-to-service calls.
- **Database:** Custom `InnoRow` / `InnoDbConnection` abstraction — not Entity Framework (a
  `DataManagement` EF migration was started but abandoned; `Entity<T>` extends `InnoRow`
  directly). Supports both SQL Server (`InnoDbConnectionMsSql`) and MySQL
  (`InnoDbConnectionMySql`, `RobarDbMySql`) backends.
- **IoC:** Unity, wired per-project in `UnityConfig.cs`.
- **Hosting:** On-premise IIS at customer sites; no CDN or cloud hosting model.
- **Version control:** SVN (not Git) — this checkout tracks branch `7.0.3`.
- **Build:** MSBuild via `Build.proj`; version format `7.0.x.{SvnRevision}`.

## Test Stack

### Unit
- **Framework:** NUnit 2.6.3 + RhinoMocks 3.6.1
- **Test Directory:** `Testing/` — one `*.UnitTest` project per source assembly (e.g.
  `Innovatum.Web.UnitTest`, `Innovatum.DataManagement.Data.UnitTest`), ~35 projects total
- **Shared helpers:** `Innovatum.TestingUtilities`; a `DbTestBase` base class in
  `Innovatum.UnitTest` indicates some tests run against a real/test database connection rather
  than pure mocks

### E2E / UI
- **No committed automated regression suite** — `Testing/Lib/Bin/WatiN` contains only the WatiN
  library's own bundled example projects (third-party distribution), not active product tests.
- **Ad-hoc Playwright + FlaUI hybrid automation exists and is confirmed working**, built by the
  `formal-test-script-execution` skill for one-off formal test script execution (not a
  maintained regression suite): Playwright (Node.js, headless Chromium) drives the browser/
  InnoPages iframe UI; for features that hand off to a native Windows process via the Sentinel
  chain (Template Management's BarTenderEdit confirmed end-to-end 2026-09-01; also applies to
  DocumentEdit, GenericTemplateEdit, ItemRtfEdit, PrintTimeRedlineCompare,
  Printing.SinglePieceFlow), FlaUI (.NET 8, a standalone CLI bridge) takes over for the native
  window. See that skill's "Native Windows desktop automation (FlaUI)" section for confirmed
  selectors, gotchas, and scope (wrapper chrome only, not third-party app internals). A hard rule
  applies to any of this automation: it must never enter passwords/credentials or drive an
  e-signature dialog, even with explicit authorization — see that skill's credential-boundary
  note.
- Recommended default for a real maintained suite if/when one is started: Playwright (see
  `playwright-automation`), for `Web/ROBAR/Printing` and InnoPages browser flows.

### API
- **None selected yet.** No dedicated test project found for `Innovatum.API`.

### Visual / Performance
- **None selected yet.**

## CI/CD

- **Build entry point:** `Build.proj` (MSBuild), invoked by a build server that supplies
  `SvnRevision`. No `.github/workflows`, `.gitlab-ci.yml`, or `Jenkinsfile` exist in this repo —
  if pipeline config exists, it lives outside the SVN tree (e.g. configured directly in a build
  server UI).
- **Gap — unconfirmed:** whether the `Testing/*.UnitTest` projects run automatically as part of
  that build server pipeline, and whether a test failure blocks a build, is not currently known.
  Flagging this as an open question rather than guessing.
- Local development builds happen via Visual Studio + `Innovatum.Suite.sln`.

## Environments

- **Internal Dev → internal QA/Test → per-customer, on-premise Production.** An internal test
  database instance (e.g. `robartst607`, referenced in this project's Sentinel-plugin porting
  guidance) is used before release; each regulated medical device customer then runs their own
  on-premise installation.
- No shared production URL and no centrally controlled environment parity — each customer
  install is its own environment, so staging-green does not guarantee prod-green across the
  install base.

## Quality Goals

- **None set yet.** No current numeric coverage, flakiness, or suite-duration targets are
  tracked for this codebase. Recorded as-is rather than inventing aspirational numbers; revisit
  with `qa-metrics` once there's appetite to set baselines.

## Risk Areas

| Area | Risk Level | Business Impact | Notes |
|---|---|---|---|
| Label content / print correctness (ROBAR print path) | Critical | Direct patient-safety and FDA-labeling impact — this is the core purpose of the product | High-impact, high-likelihood given ongoing changes to printing plugins |
| Sentinel plugin chain (Launcher → Tray → Plugin handshake) | Critical | Launch-chain failures are silent by design | CLAUDE.md documents two known silent-failure modes: a 32-bit DLL loaded in a 64-bit host throws `BadImageFormatException` without a meaningful user-facing error, and a misconfigured `ClientWcfURL` "silently breaks the Sentinel launch chain without a clear error" |
| Campaign Manager approval workflow (ViewAndVote / MassApprove) | Critical | Governs which label changes are approved before print in a regulated environment | Audit-trail integrity here has direct compliance implications |
| Installer / upgrade seed-data drift (`Innovatum.Install` / `DynamicInstallers.cs`) | Important | Existing customers upgraded via script can silently miss new seed data (localizations, GlobalSettings, Securities, etc.) | CLAUDE.md explicitly calls out that fresh-install seed data must be mirrored into idempotent upgrade-script inserts; no automated check found for this today |
| Trading-partner data submission (Communications Manager / GUDID) | Important | Incorrect data submitted to the FDA GUDID database has direct regulatory consequences | Moderate likelihood — external, less frequently touched integration |
| CSP rollout regressions | Monitor | Breaks page functionality (inline scripts/styles) rather than data integrity | Live source of breakage risk when touching views; `DataManagement.Web`'s `Edit.cshtml` already carries one explicit CKEditor-incompatibility exception |
| Automation/credential boundary at e-signature dialogs | Process constraint, not a product defect risk | An e-signature (e.g. Template Management's Approve flow) is a regulatory attestation that a human personally reviewed and approved a record | Standing rule for any QA automation in this codebase: never enter passwords/credentials or drive an e-signature dialog programmatically, even with explicit authorization — pause and hand off to a live tester, then verify the result. See `formal-test-script-execution`'s FlaUI section. |

## Team

- **Small dedicated QA team, high dev:QA ratio.** Ownership model: developers write most tests
  themselves; QA focuses on strategy, critical-path testing, and exploratory testing rather than
  writing the bulk of automated coverage.
- **Methodology and QA engagement point:** not yet captured — revisit if this becomes relevant to
  a specific skill (e.g. `test-strategy`).

## Conventions

- **Test naming:** `{ClassName}Tests.cs` (occasional singular `{ClassName}Test.cs`), organized
  into feature subfolders that mirror the corresponding source project's structure.
- **Test project layout:** one `*.UnitTest` project per source assembly, kept separate from
  source (not co-located); shared helpers live in `Innovatum.TestingUtilities`.
- **Branching / review:** SVN, not Git — `7.0.3` is a release/maintenance branch. No PR-based
  workflow; changes are reviewed via `svn diff`/`svn status` under a propose-before-edit protocol
  before committing (see this project's `CLAUDE.md`).
- **Code style:** explicit types everywhere (`var` is avoided), mandatory braces on every `if`/
  `else` block even single-statement, `#region`/`#endregion` blocks used for organization.
- **Data access:** prefer `InnoRow` subclasses, `Entity<T>`, or `IRepository<T>` over ad-hoc SQL;
  `RobarDb.cs` is a legacy accumulation point new methods should rarely be added to.
- **Selector strategy:** not applicable yet — no E2E framework is in use.
