# AI Test Generation — ROBAR Browser Print Path (Pass 1)

Pipeline output of the `ai-test-generation` skill (Steps 1–5). Target: the highest-scored,
zero-E2E-coverage risk area per `.agents/risk-matrix.md` (Score 20, CRITICAL — "Label print
correctness"). Scope for this pass: **Print by Order / Print by Lot core flow, Version Printing,
and Master-Data-to-print correctness.** Out of scope for this pass (candidates for a follow-up
run): Print Signatures/reprint e-signature flow, Test Print, Miscellaneous Printing, Localization,
Batch Quantity, Exact Reprint history.

**Step 6 (test code) is deliberately not done here.** Per the plan agreed with Mason, the scenarios
and oracles below are handed to the `playwright-automation` skill next, to be written as
`.spec.ts` files in the sibling `C:\Users\Mason\ROBAR_Tests` repo under a new `tests/Browser-Printing/`
folder, reusing `tests/support/robar.ts`'s login/nav helpers and following the Page Object
conventions already used in `tests/Template-Management/`.

**Sources used:**
- `ValMaster - Innovatum (5).xlsx` (network share export via Mason, 2026-09-16) — modules
  `WEB - Print Request`, `Print by Order`, `Version Printing`, `WEB - Printing`. This is the
  authoritative FRS/URS requirements catalog (8,863 rows across the whole product).
  **Known data artifact:** many `Description` cells in this workbook are missing the word "Lot"
  mid-sentence (e.g. "Print by /Order multi modules" should read "Print by Lot/Order multi
  modules") — confirmed present in the raw XML, not an extraction bug on this end. Restored from
  context/the module reference doc where unambiguous; flagged inline below with `[Lot restored]`
  wherever a description required it.
- `.agents/robar-module-reference.md` §"Browser Printing" — distilled live-tested behavior.
- `.agents/exploratory-session-log-robar-print.md` — live exploratory findings (2026-09-16),
  including a confirmed-working happy-path data combo (Print Entity=England,
  OrderNum/Lot/ItemNumber=MI080301).
- `.agents/risk-matrix.md` Phase 3, item 1 ("Label print correctness") — failure modes.

---

## Step 1: Requirements and Entities

### Entities
- **Order** — a shop order number; may be associated with one or multiple items.
- **Lot** — lot data (number, manufacture date, expiration date, reassay date) tied to an
  Order+Item combination; can be auto-created or manually entered/overridden at print time.
- **Item** (ROBAR item) — the label-bearing entity; has an approval/effective status.
- **MDM Item** (separate Master Data record, `DataManagement.Web`) — may be linked to a ROBAR
  item and has its own version/approval/effective status, independent of the ROBAR item's.
- **Template/Label Type** — determines which fields (including MDM components) render on the
  printed label.
- **Print Entity** — a named context (e.g. "England", "ROBAR") that scopes which lot/order data
  is visible.

### Explicit Requirements (from ValMaster)

| ID | FRS# | GXP | Risk | Requirement |
|----|------|-----|------|-------------|
| REQ-1 | FRS-8.1.3.5 | Yes | 6.0 | System allows retrieval of Lot information using Lot number or Order number. |
| REQ-2 | FRS-8.1.3.1 | Yes | 7.0 | Web Printing provides the ability to add a Lot automatically if one does not exist. |
| REQ-3 | FRS-8.1.3.12 | Yes | 6.0 | Print by Lot with a Lot number assigned to multiple items → display an error. |
| REQ-4 | FRS-8.1.3.13 | Yes | 6.0 | Print by Order with an Order number assigned to multiple items → display an error. |
| REQ-5 | FRS-8.1.3.10 | Yes | 6.0 | Print by Order Multi allows assigning an *existing* Order number to items at print time, given the Order+Lot combination is unique to those items. |
| REQ-6 | FRS-8.1.3.11 | Yes | 5.0 | Print by Order Multi allows printing labels for any Order number associated with multiple items. |
| REQ-7 | FRS-8.1.3.2 | Yes | 7.0 | Manufacturing date defaults to Server date if empty; offsets for workstation/server time-zone difference. |
| REQ-8 | FRS-8.1.4.2 | Yes | 5.0 | Shelf life is calculated automatically and written back to the Lot table if expiration date is blank/null. |
| REQ-9 | FRS-8.1.4.3 | Yes | 5.0 | Web Printing calculates expiration date from manufacturing date + shelf life. |
| REQ-10 | FRS-8.1.15.1 | No | — | Web Printing allows the user to select the item and template version for any item/template in the system. |
| REQ-11 | FRS-8.1.15.2 | Yes | 4.0 | Security controls whether a user can change versions and select unapproved/ineffective items and templates. |
| REQ-12 | MDM20150514100F1.0.1 | Yes | 4.0 | For a ROBAR item associated with an MDM item, when the template contains MDM components, the printing modules print the **latest approved effective** MDM data on the label in addition to the latest approved effective ROBAR item data. |
| REQ-13 | MDM20150514100F1.0.2 | Yes | 5.0 | If the associated MDM item is **ineffective or retired**, the printing modules will **not** print the MDM data on the label even if MDM components exist on the template. |
| REQ-14 | MDM20150514100F2.0.1 | No | — | Version Printing: if the ROBAR item's associated MDM item has multiple versions, the module requires the user to select an MDM item version. |
| REQ-15 | MDM20150514100F2.0.2 | No | — | Version Printing: if only MDM version 0 exists and it is approved+effective, it is auto-selected. |
| REQ-16 | MDM20150528100F1.0.4 | Yes | 5.0 | MDM data prints on summary labels if the label contains MDM components. |
| REQ-17 | FRS-8.1.16.1 | Yes | 7.0 | Web Printing accepts an order number and Lot number as input and verifies the existence of the ROBAR order. |
| REQ-18 | FRS-8.1.16.2 | Yes | 8.0 | Lot data can be automatically entered by Web Printing or the user can enter Lot data manually. |

### Implicit Requirements (inferred — flag for confirmation)
- **[IMP-1]** When an MDM item transitions from effective→ineffective *between* the last approval
  and the moment of print, the print path must re-check effective status at print time, not at
  page-load time — this is the literal mechanism of Risk-Matrix Failure Mode 1 ("stale Master
  Data reaches a printed label"). REQ-13 states the *rule*; it does not state *when* the check
  happens. **Needs human confirmation**: is the effective-status check performed on the final
  Print submit, or only when the print screen is first rendered? If the latter, a MDM
  edit made after the print screen loads but before Print is clicked would not be caught —
  this is the actual gap the risk matrix is worried about.
- **[IMP-2]** REQ-12/13 don't state what happens to the *rest* of the label (ROBAR item fields)
  when MDM data is suppressed for being ineffective/retired — assumed the label still prints
  with ROBAR fields only, MDM fields blank, but this needs confirmation to avoid asserting a
  guessed behavior as fact.
  Also unconfirmed: FRS-8.1.5.4 ("if there are multiple label types associated with a particular
  item, the system will prompt the user to select which label type to print") interacts here.
- **[IMP-3]** REQ-2/REQ-5 (auto-create vs. assign-existing Lot) — the module reference confirms
  auto-creation "with sensible defaults" but doesn't specify exactly which fields get defaulted
  beyond Expires/Manufactured/Reassay dates seen live. Scenario oracles below assert only the
  fields already confirmed live.

---

## Step 2: Risk Analysis and Invariants

| Risk | Likelihood | Impact | Source |
|---|---|---|---|
| Stale/retired MDM data still renders on a printed label because the effective-status check runs too early (IMP-1) | Possible | Catastrophic | Risk-matrix Failure Mode 1; REQ-12/13 |
| Auto-created Lot gets a wrong manufacturing/expiration date (server/workstation time-zone offset logic, REQ-7) silently propagates to every subsequent print of that Lot | Possible | Major | REQ-7, REQ-8, REQ-9 |
| Multi-item Order/Lot ambiguity error (REQ-3/REQ-4) is bypassable, letting a label print with data from the wrong item | Unlikely | Catastrophic | REQ-3, REQ-4 |
| Version Printing silently prints the wrong (non-latest) MDM version when multiple exist (REQ-14 requires explicit selection — a UI regression that pre-selects one without prompting would violate this silently) | Unlikely | Major | REQ-14, REQ-15 |
| Unapproved/ineffective item or template becomes selectable in Version Printing for a user who shouldn't have that permission (REQ-11) | Possible | Catastrophic | REQ-11 |

**Invariants (must ALWAYS hold):**
- INV-1: A label never renders MDM component data sourced from an MDM item version that is not
  both *approved* and *effective* at the moment of print (REQ-12, REQ-13).
- INV-2: Expiration date on a printed label is always `manufacturing date + shelf life` when
  expiration was blank at entry — never blank, never stale from a prior calculation (REQ-9).
- INV-3: A Print by Lot/Order action against a Lot or Order number matching >1 item always blocks
  with an error — it never silently resolves to "the first match" (REQ-3, REQ-4).
- INV-4: Version Printing never auto-advances past an MDM version-selection prompt when more than
  one MDM version exists (REQ-14).

**Ambiguities needing human answers (do not silently pick one):**
- **[AMB-1] RESOLVED 2026-09-16 — confirmed real bug, not a non-issue.** Code investigation traced
  the full call chain:
  - The MDM approved/effective check happens **once**, live against the DB, at the *first*
    data-entry step of the print wizard: `PrintMasterItem.MasterDataItem`
    (`Web\ROBAR\Printing\PrintMasterItem.cs:98-185`) calls
    `MasterDataRepository.GetLatestApprovedEffectiveItem(ItemNumber)`
    (`Innovatum.DataManagement.Data\Repositories\MasterDataRepository.cs:621-624`,
    `onlyApproved=true, onlyEffective=true`) and **caches** the result in `_masterDataItem`.
  - First touched during item/order/lot entry (`PrintPageMode.CustomDataDE`) in
    `Web\ROBAR\Printing\Screens\PrintScreen.aspx.cs:740-766` (`GetCustomDataFromUI()`), which also
    throws `Master_Data_Not_Approved_Effective` if it fails *at that moment*.
  - The same `PrintMasterItem` instance is carried forward across every subsequent postback via
    `PrintSubSession` (`Web\ROBAR\Printing\PrintSubSession.cs:44,276-290`,
    `Web\ROBAR\Printing\PrintPageUtils.cs:171-180`) — a plain dictionary keyed by PageID, no
    re-fetch, no TTL tied to MDM status.
  - Later wizard steps (Lot entry → Template/Label Type select at `PrintScreen.aspx.cs:348` →
    Prompts at `:537` → Print Options) all read the same cached object.
  - The final print submission, `Web\Controllers\PrintOptionSelectionController.cs` (e.g.
    lines 264-268, 392-396, 619-623), calls `engine.DoReplaceForPrint(item,
    subsession.MasterItemToPrint.MasterDataItem, ...)` using that cached value — **no
    re-instantiation, no `MasterDataItemVersion` reset, no `IsApproved`/`IsEffective` re-check
    anywhere in the final submit path.**
  - **Conclusion: if an MDM item is retired/made ineffective after the user completes item entry
    but before clicking the final Print button, the label still prints with the stale, now-invalid
    MDM data.** This directly violates FRS MDM20150514100F1.0.2 and is exactly risk-matrix Failure
    Mode 1 ("stale Master Data reaches a printed label"), now confirmed exploitable rather than
    theoretical.
  - **Caveat:** `PrintScreenByVersion.aspx.cs:174` (explicit-version print, `MasterDataItemVersion`
    set directly) is a distinct, intentional "pin a specific historical version" flow — do not
    conflate it with this bug when writing the regression test; it's out of scope here.
  - SC-10 below is **un-deferred** and reclassified as a confirmed-bug regression test (see Step 4).
- **[AMB-2]** Whether "Microsoft Print to PDF" as the print target reaches the same
  MDM-data-resolution code path as a real label printer. **Resolved 2026-09-16 (Mason): yes** —
  treat SC-01/SC-07's print-target choice as settled; proceed to Step 6 for those without further
  verification of this point.
- **[AMB-3]** Whether to reuse an existing MDM-linked item/template fixture or create a new one.
  **Resolved 2026-09-16 (Mason): create a new, dedicated fixture** rather than depend on existing
  QA-environment data, so SC-07/08/09 aren't reliant on data that could change or disappear. See
  "Fixture Plan" below.

---

## Step 3: Coverage Matrix

| Req | Scenario | Category | Priority | Oracle Type |
|---|---|---|---|---|
| REQ-1 | Retrieve existing Lot data via Lot number and via Order number (two paths, same result) | Happy path | P1 | State: retrieved fields match |
| REQ-2 | Print by Order with a brand-new Order+Item combo auto-creates a Lot with server-defaulted dates | Happy path | P0 | State + UI |
| REQ-3 | Print by Lot with a Lot number tied to multiple items | Negative | P0 | UI: error, no navigation past step |
| REQ-4 | Print by Order with an Order number tied to multiple items | Negative | P0 | UI: error, no navigation past step |
| REQ-3/4 | Invalid/nonexistent Order+Lot+Item combination | Negative | P0 | UI: "No item found" gating (already confirmed live — regression-lock it) |
| REQ-7 | Auto-created Lot's manufacturing date defaults to server date when left blank | Happy path | P1 | Data: Lot row's ManufactureDate |
| REQ-8/9 | Blank expiration date is auto-calculated as manufacturing date + shelf life | Happy path | P0 | Data + UI: expiration field/label content |
| REQ-10/11 | Version Printing: user without version-change permission cannot select an unapproved/ineffective item or template version | Security/Negative | P0 | UI: control disabled or absent |
| REQ-10/11 | Version Printing: authorized user can explicitly select a prior approved version | Happy path | P1 | State: selected version reflected on label preview |
| REQ-12 | MDM-linked item + effective, approved MDM data + MDM-component template → label preview includes latest approved effective MDM data | Happy path | P0 | UI: label preview content; Data: matches MDM record |
| REQ-13 | MDM-linked item whose MDM record is retired/ineffective → label preview does NOT include MDM data, even though the template has MDM components | Negative / Invariant (INV-1) | P0 | UI: MDM fields absent; Negative: no MDM text present |
| IMP-1 (AMB-1) | MDM item is retired *after* the item-entry step completes, before final Print is clicked | State transition / Race — **confirmed bug** | P0 | Data: label still contains stale MDM data (test expected to fail until fixed) |
| REQ-14 | Version Printing with an MDM item that has multiple versions requires explicit version selection (no auto-advance) | State transition / Invariant (INV-4) | P0 | UI: selection prompt shown; Negative: does not auto-navigate |
| REQ-15 | Version Printing with only MDM version 0 (approved+effective) auto-selects it, no prompt | Happy path | P1 | UI: no prompt shown; State: version 0 selected |
| REQ-16 | Summary label with MDM components on the template pulls MDM data same as a regular label | Happy path | P2 | UI: summary label preview content |

**Verification pass:** every P0/P1 requirement above has ≥1 scenario; INV-1 through INV-4 each
have a direct scenario; both Risk-Analysis top risks have a scenario; no two rows test the same
thing. IMP-1's scenario is marked DEFER, not silently dropped, per AMB-1.

---

## Step 4: Candidate Scenarios (Given/When/Then)

### SC-01 — Print by Order auto-creates a Lot with server-defaulted dates (REQ-2, REQ-7)
**Given** a real Order number and Item number combination with no existing Lot record
**When** the tester submits Print by Order with that Order+Item and leaves Manufactured/Expires
blank
**Then** a new Lot record is created; ManufactureDate defaults to the server's current date
(adjusted for any workstation/server time-zone offset); the print-execution screen shows the
newly created Lot data, not an error

### SC-02 — Print by Lot rejects a Lot number shared by multiple items (REQ-3, INV-3)
**Given** a Lot number known (via Print History Inquiry or test fixture) to be associated with
more than one Item
**When** the tester submits Print by Lot with only that Lot number
**Then** the system displays an error and does not advance to the print-execution screen

### SC-03 — Print by Order rejects an Order number shared by multiple items (REQ-4, INV-3)
Mirror of SC-02 for Order by Order number — same oracle shape, different entry field. (Consolidate
with SC-02 into one parametrized test rather than duplicating — flagged per the pipeline's
duplicate-scenario guardrail.)

### SC-04 — Invalid Order/Lot/Item combination is blocked at every retry (regression-lock)
**Given** a nonexistent Order/Lot/Item combination (e.g. `ZZZ-NONEXISTENT-99999`)
**When** the tester clicks Next repeatedly without correcting the data
**Then** the system keeps blocking with "No item found." / "No Lot found..." and never lets the
flow through to the print-execution screen — this is already confirmed live
(`.agents/exploratory-session-log-robar-print.md` Finding 1); this test locks that behavior as a
regression guard, and should also assert the (currently misleading) message text as a known-issue
snapshot so a future copy fix is a deliberate, visible test update rather than a silent pass

### SC-05 — Blank expiration date is calculated from manufacturing date + shelf life (REQ-8, REQ-9, INV-2)
**Given** a Lot with a manufacturing date set and expiration date blank
**When** the print screen loads / recalculates
**Then** expiration date = manufacturing date + the item's configured shelf life, and this value
is what's shown on the label preview (not blank, not the manufacturing date itself)

### SC-06 — Version Printing blocks version/status changes for an unauthorized user (REQ-11, negative/security)
**Given** a user role without the version-change security permission
**When** they open Version Printing for an item with multiple versions, including unapproved/
ineffective ones
**Then** the version-selection control either does not offer unapproved/ineffective versions or
is disabled entirely for that user — needs the module reference's confirmed selector/permission
name cross-checked before coding (see Step 5 note)

### SC-07 — MDM data prints only when the linked MDM item is approved and effective (REQ-12, REQ-13, INV-1) — the risk-matrix core scenario
**Given** a ROBAR item linked to an MDM item, and a template containing MDM components
**When** the MDM item is (a) approved+effective, then separately (b) retired/ineffective
**Then** (a) the label preview includes the latest approved effective MDM data; (b) the label
preview does NOT include MDM data even though the template still has MDM components — same
ROBAR item, same template, only the MDM item's status changed between runs

### SC-08 — Version Printing requires explicit MDM version selection when multiple exist (REQ-14, INV-4)
**Given** an MDM item with 2+ versions linked to the ROBAR item being printed via Version Printing
**When** the tester opens Version Printing for that item
**Then** the system prompts for MDM version selection and does not auto-advance; selecting a
specific version is required before the print-execution screen is reachable

### SC-09 — Version Printing auto-selects the sole MDM version when it's the only one (REQ-15)
**Given** an MDM item with only version 0, approved and effective
**When** the tester opens Version Printing for the linked ROBAR item
**Then** version 0 is auto-selected with no prompt shown

### SC-10 — MDM item retired mid-wizard still prints stale MDM data (CONFIRMED BUG, REQ-13, INV-1, risk-matrix Failure Mode 1)
**Given** an MDM-linked item, approved+effective, used to begin a Print by Order/Lot flow through
the item/order/lot entry step
**When** the MDM item is retired (or made ineffective) in a separate session/tab *after* that
entry step completes but *before* the final Print button is clicked, and the original session then
completes the remaining wizard steps (Lot entry → Template/Label Type → Prompts → Print Options →
Print)
**Then** — **currently** the label prints with the now-stale MDM data (confirmed via code trace:
`PrintSubSession` caches the `PrintMasterItem`/`MasterDataItem` object from the initial
`GetLatestApprovedEffectiveItem` call and never re-checks `IsApproved`/`IsEffective` before the
final `DoReplaceForPrint` call). **Expected** per FRS MDM20150514100F1.0.2: the MDM data must NOT
appear on the printed label once the linked MDM item is retired/ineffective, regardless of when
in the wizard that happens.

This is written as a test that **asserts the expected (FRS-compliant) behavior and is expected to
FAIL against current code** — per the ai-test-generation pipeline's bug-report handling, this
becomes a real regression test that will start passing once the underlying defect is fixed, not a
scenario that gets softened to match current (wrong) behavior. File as a defect alongside adding
this test; do not silently adjust the oracle to match the bug.

---

## Step 5: Oracle Design

| Scenario | UI oracle | Data oracle | Negative oracle |
|---|---|---|---|
| SC-01 | Print-execution screen shows Lot data, no error dialog | New `Lot` row exists with `ManufactureDate` = server date (± TZ offset) | No "No Lot found" / "No item found" message |
| SC-02/03 | Error message shown; screen does not advance | — | Print-execution screen never reached (URL/step assertion, not just a toast check) |
| SC-04 | "No item found." / "No Lot found..." shown on every retry | — | Never reaches print-execution screen across N retries; flow doesn't silently accept the "...or continue" wording as license to proceed |
| SC-05 | Label preview / entry screen shows calculated expiration date | `Lot.ExpirationDate` = `Lot.ManufactureDate` + item's shelf-life setting | Expiration field is not blank and not still equal to a stale/previous value |
| SC-06 | Version dropdown excludes unapproved/ineffective entries, or control is disabled | — | Unauthorized user cannot reach a print-execution screen carrying unapproved/ineffective item or template data |
| SC-07(a) | Label preview image/DOM contains the MDM field values | Preview data matches the *latest approved effective* MDM record, by field | — |
| SC-07(b) | Label preview does NOT contain MDM field values/placeholders | — | No MDM-sourced text present anywhere in the rendered preview, even though template markup still defines those regions |
| SC-08 | Version-selection prompt is shown and blocks progress | — | No auto-navigation past the prompt when 2+ MDM versions exist |
| SC-09 | No prompt shown; screen proceeds directly | Selected MDM version = 0 | — |

**Oracle-design notes for Step 6 (playwright-automation):**
- SC-07 is the single highest-value test in this set — it directly exercises risk-matrix Failure
  Mode 1. It needs a real MDM-linked test fixture (AMB-3) before it can be coded; do not fabricate
  a plausible-looking item/template pairing.
- Per this codebase's standing automation rule, none of these scenarios may drive a
  password/e-signature field. SC-06/SC-11(reprint, out of scope) that would otherwise need an
  e-signature step should stop short of it and assert the pre-signature state only.
  Also per project rule: use "Microsoft Print to PDF" as the print target wherever a scenario
  needs to reach `PrintHistory` for its oracle — flag AMB-2 first for SC-07/SC-01 specifically,
  since it's unconfirmed whether that target reaches the MDM-resolution code path identically to
  a real label printer.
- SC-04 already has a live-confirmed selector/message baseline in the exploratory session log —
  reuse those exact strings rather than re-deriving them.

---

## Fixture Plan (AMB-3 — new dedicated MDM-linked item/template)

Rather than depend on existing QA-environment data, SC-07/SC-08/SC-09 get their own fixture,
built the same way `Master-Data-Management/Create_New_Record.spec.ts` already builds its
`RobarMasterData` fixture — reuse `tests/support/master-data.ts` helpers, don't re-derive
selectors from scratch:

1. **Create the MDM record** — Master Data Management page, `RobarMasterData` (item) schema,
   New Record, fill required fields (per that spec's discrepancy notes: Description must be set
   on the Edit page directly, Primary DI Number / Brand Name required, Labeler Duns Number's
   pre-populated default must be changed away from). Result: a new Unapproved MDM item-schema
   record with a known item number.
2. **Approve it** — MDM record must be Approved + Effective for SC-07(a); a second, later-created
   version of the *same* MDM item is needed for SC-08 (multiple versions) and SC-09 (only version
   0). Plan: create version 0, approve it (covers SC-09 in isolation), then Save-as-New-Version to
   get version 1 for SC-08's "multiple versions" case — check `MD_SaveAsNew_Version` gating.
3. **Link it to a ROBAR item** — use the **Assign Labels** bulk action
   (`MD_AssignLabels_Option`, robar-module-reference.md line ~442) from the Master Data grid,
   which "creates Campaign Manager item/label records directly from MDM records." This produces
   the ROBAR item that Print by Order/Lot and Version Printing will operate on.
4. **Template with MDM components** — confirm whether an existing template already has MDM
   component placeholders (check Template Management / Label Control for one, per module
   reference), or whether a new template needs to be built with MDM fields via
   BarTenderEdit/Sentinel. This is the one piece not yet confirmed either way — needs a quick
   live check before Step 6 coding starts on SC-07 specifically.
5. **Retire path for SC-07(b)** — MDM Mass Retire-Unretire bulk action on the same record, to
   flip it to ineffective/retired without touching the ROBAR item itself, so the same
   fixture item can be printed both before and after.

This fixture creation should be scripted once (a `seed`-style seeded fixture or a dedicated
`beforeAll` in the Browser-Printing spec, matching how `seed.ts` already parameterizes the
existing `mdmSchema`/`mdmItemNumber`), not repeated ad hoc per test.

## Open Items Before Step 6 (Code)

1. ~~AMB-1~~ — **Resolved.** Confirmed bug; SC-10 is ready to write as a bug-report-style
   regression test (expected to fail until fixed). Recommend filing a DIT ticket for the underlying
   defect alongside the test — this affects real label content correctness in a regulated
   environment, not just a testing gap.
2. Confirm whether an existing template with MDM component placeholders is available for the new
   fixture, or whether one needs to be built (Fixture Plan step 4).
3. Human review decision (KEEP/MODIFY/REJECT/DEFER per scenario) — not done yet; this document is
   the Step 1–5 handoff artifact, review should happen alongside or after `playwright-automation`
   drafts the actual specs, per the project's usual review workflow.

## Step 6 (Test Code) — Outcome, 2026-09-16

`playwright-automation` delivered against this doc; see `ROBAR_Tests/tests/Browser-Printing/` and
`ROBAR_Tests/tests/support/printing.ts`. A blocker not anticipated in Steps 1–5 changed the
achievable scope significantly — see `.agents/robar-module-reference.md`'s "Browser Printing" §
"Playwright automation notes (Browser-Printing specs, 2026-09-16)" for full detail. Summary:

- **Delivered and passing:** SC-04 (`Invalid_Combination_Blocked.spec.ts`) and SC-05
  (`Blank_Expiration_Date_Calculated.spec.ts`). Both only need the wizard's first two
  transitions (order/lot entry → Lot Panel), which are reliably automatable once Playwright's own
  `.click()` is swapped for a native-DOM-click workaround (see `printing.ts`).
- **Blocked — Sentinel/ClientPrintMethod dependency, not a fixture problem:** SC-01, SC-07, SC-08,
  SC-09, SC-10 all require completing the Lot Panel's own submit (which creates the Lot record and
  advances to template/label selection) or Version Printing's equivalent. That submit reliably
  returns **"Timeout waiting for Sentinel."** in this environment regardless of click method tried
  — a real dependency on the Sentinel Tray client (`ClientPrintMethod=Sentinel` for Chrome, per
  Mason), not a testing-tooling quirk. This is the same class of scope boundary already established
  for Print Time Redline Comparison and Template Management's BarTender editing (Sentinel desktop
  client required). **The MDM fixture (Fixture Plan) was therefore not built** — there is currently
  no reachable print-execution screen for it to feed into via pure browser automation, so building
  it would not have unblocked SC-07/08/09/10 regardless. SC-10 specifically could not be written
  even as an intentionally-failing regression test, since the flow required to demonstrate the bug
  live never reaches a state where the assertion would be meaningful (it fails for the wrong
  reason — navigation timeout — not the documented stale-MDM-data reason).
- **Not attempted — Campaign Manager environment issue:** SC-02/SC-03's consolidated multi-item
  negative test needs a second real ROBAR item as fixture data. Campaign Manager (needed to create
  one) threw a genuine server-side ASP.NET Runtime Error on open, reproduced twice independently;
  not root-caused, may be transient. Worth retrying next session.
- **Not attempted — time:** SC-06 (Version Printing permission gating).
- Recommend a follow-up session, gated on either (a) a way to make a Sentinel Tray reachable from
  the automated browser context, or (b) explicit confirmation that this class of scenario is
  out of scope for pure browser automation in this environment (matching the existing Redline/
  BarTender precedent), before re-attempting SC-01/07/08/09/10.
