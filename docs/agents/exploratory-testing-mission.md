# Exploratory Testing & Live-Driving Mission

**What this is:** the standing charter for an ongoing, multi-session effort to build deep,
retained, cross-project working knowledge of Innovatum Suite 7 (ROBAR) by combining formal
test-script review with hands-on live testing against a running environment. This is not a
one-off task — it's a continuous practice. Any session doing this kind of work should read this
file first, pick up where the last one left off, and extend it the same way.

If you're a fresh session being pointed at this file (or finding it via `CLAUDE.md`), this IS the
prompt — read it, then go do the work it describes.

## Mission

- Read formal QA test scripts (network share `\\diskstation\backedup\#Unlocked_Test_Cases\<Module>\7.0.3\`)
  **and** drive the live application directly — Playwright for the web UI, FlaUI native-Windows
  automation for Sentinel-launched desktop apps (BarTender, etc.) — to observe true current
  behavior rather than relying on either source alone. Per the user: scripts are strong evidence,
  not infallible (they can contain human error, e.g. an outdated setup step); code inspection
  alone can also be wrong. Live behavior is the tiebreaker.
- Distill every finding — required fields, security-process gates, bulk-action behavior, confirmed
  bugs vs. confirmed-but-surprising behavior — into `robar-module-reference.md`, the same session
  it's learned. Track which scripts have been read (and how thoroughly) in
  `formal-scripts-reviewed.md`. Log confirmed product defects in `dit-tracker.md`. Keep full
  step-by-step raw records in `exploratory-session-log-<module>.md`; `robar-module-reference.md`
  stays a distilled summary, not a transcript.
- These files live in `.agents/` and are **deliberately project-independent** — write there, never
  into a project-scoped Claude Code memory file, so a future project pointed at a different
  build/checkout still inherits everything learned here.
- A parallel, ongoing thread: assembling a **combined daily-workflow test** that mirrors how the
  user actually works end-to-end, in one continuous ROBAR session (no logout between steps) —
  e.g. create+approve a Template → create+approve a Campaign Manager Item using it → Assign a
  Label Control number against that item → (more steps to be identified and added over time, per
  the user's own manual daily workflow). For each new piece: explore that module live first,
  confirm the flow works and is reliable standalone, **then** fold it into the combined spec —
  don't skip straight to bolting an unexplored action onto the combined test.

## How to resume this in a fresh session

1. Read `robar-module-reference.md`, `formal-scripts-reviewed.md`, and this file before starting
   any module-specific work.
2. Check `robar-module-reference.md`'s "Open To-Dos for Live/Exploratory Testing" section —
   unresolved items to settle opportunistically when other work happens to touch them, not to
   chase proactively on their own.
3. Prefer the TST703 environment for this kind of exploratory/knowledge-building work; reserve
   VAL703 for actual UAT execution.
4. Use throwaway `zz_`-prefixed spec files (in `ROBAR_Tests/tests/<Module>/`) for live
   exploration. Once a flow is proven reliable (aim for 3+ clean consecutive runs), promote it to
   a permanent, real-named spec and delete the throwaway(s).

## Guardrails

Each of these was learned from a real incident during this effort — the point is to not relearn
them the hard way a second time.

**Standing rule (user, 2026-10-07): whenever a test, validation, UAT or training run shows ROBAR behavior we had not learned before, record it in the same session** - memory (`feedback_record_new_system_learnings`), this folder's `robar-module-reference.md` (module behavior, ids, messages, environment facts), `dit-tracker.md` (defects), `settings-change-requests.md` (settings) - and correct any earlier note that turned out wrong. Say in the hand-off what was recorded and where.

1. **Reset grid filter scope every time — don't just check it.** Any CriteriaFilter-style grid
   (Template Management, Campaign Manager, Label Control, MDM, etc.) has, below the
   Column/Operator/Value row(s), additional fixed-scope controls — an Approved/Unapproved-style
   dropdown, sometimes an Attachments or Label Master dropdown, and Latest-Version-Only /
   Effective-Only checkboxes — that silently narrow results. The shared test account's filter
   state is not guaranteed clean between sessions (the user uses the same account for manual
   testing). Explicitly set these to their neutral/"all" values before trusting any query result;
   logging the current value instead of setting it is NOT sufficient — that exact mistake
   recurred twice in a single day. Full detail and per-module selector IDs: Claude Code memory
   `feedback_filter_scope_reset.md`.
2. **One continuous ROBAR session for a cross-module workflow test.** When a test spans multiple
   modules, do it via WebMenu tab-close/tab-open within a single login — don't log out between
   parts. That's how the user actually works, and it's also how the real daily workflow this
   mirrors is meant to be tested.
3. **WebMenu's session-inactivity timeout only resets on a literal `mousemove` dispatched on
   `webMenuBody`, and that event never bubbles out of a nested iframe.** A slow native round trip
   (BarTender/Sentinel) can exceed the timeout. Fix: call `RefreshTimeout()` directly via
   `page.evaluate()` on the top-level page on an interval during any long native-automation
   stretch. See `robar-module-reference.md`'s "Driving BarTender/Sentinel native dialogs"
   playbook for this plus two related FlaUI gotchas worth knowing before writing native-automation
   code: `flaui.listProcesses()` silently filters to processes with a non-empty window title (a
   just-spawned process is invisible to it), and `flaui.clickAt`'s synthesized click can report
   success while landing on a different, physically-topmost window — force the real target
   foreground first and verify the UI actually changed afterward.
4. **After ~2 failed variations of an approach, stop guessing.** Check the source code directly,
   or ask the user "What do I do now?" — don't keep blindly trying more variations of something
   that isn't working.
5. **Never automate past the credential/signature/physical-print boundary.** Never enter real
   production credentials; never let a test cause a real physical print as a side effect. (The one
   deliberate, scoped exception: formal UAT execution auto-fills e-signatures using `seed.ts` test
   credentials — that's an intentional standing decision for that specific workflow, not a
   precedent for anything else.) `browser-automation-approval-policy.md` documents the
   auto-approval policy that enforces this same boundary for routine browser tool calls.
6. **Settings modules don't all propagate the same way.** Global Settings changes need UI + an
   application restart to take effect; Print Configs take effect via UI with no restart;
   Localizations are SQL-only (no UI path exists). Don't assume one module's change-propagation
   model applies to another.
7. **Clean up throwaway scripts.** Delete `zz_`-prefixed spec files once their findings are folded
   into a permanent spec and/or `robar-module-reference.md` — don't let them accumulate in the
   test repo.

## Current state

Kept short deliberately — this is a pointer, not a log; the real detail lives in
`robar-module-reference.md` and the session-log files.

- Combined daily-workflow spec now covers three pieces in one continuous session: Template
  Management (create+approve) → Campaign Manager (create+approve an Item using that template) →
  Label Control (assign the item a Label Control Number) —
  `ROBAR_Tests/tests/Template-Management/Create_Approved_Template_and_Item.spec.ts`. Folded in
  2026-10-01, reusing `Assign_Control_Number.spec.ts`'s own proven flow for Part 3 (same filter-
  reset/Add-Filter/async-job-requery gotchas, not repeated in the combined file's header comment).
  3 consecutive clean runs, ~1.7-1.8 minutes each. Needs headed mode throughout (Part 1's
  BarTender/Sentinel requirement), even though Parts 2-3 alone could run headless.
- `ROBAR_Tests/tests/Label-Control/Assign_Control_Number.spec.ts` is kept as its own standalone,
  entirely headless spec too (same pattern as the other single-module specs this combined file
  draws from) — useful on its own when only the Label Control piece needs checking.
- Both of Label Control's open questions from the 2026-09-30 exploration are now closed (resolved
  2026-10-01, live-confirmed, not defects): Redline Compare's "Save to ROBAR" button is gated
  solely by `LC_RedlineCompare_Link`, independent of master state; and the disabled+tooltip
  mechanism for all 5 security-gated bulk actions works correctly for a user missing just one
  process (tested live via MBUser2/`MBSomeSecurity`, the module's own dedicated fixture — see
  `feedback_mb_security_scope.md` memory for the standing MB-only security-editing rule this
  established). Full detail in `robar-module-reference.md`.
- Breadth-first live-Playwright coverage of Label Control's remaining actions is underway.
  `ROBAR_Tests/tests/Label-Control/Manage_Production_Availability.spec.ts` added 2026-10-01 (create
  +approve item → assign LCN → release it via Manage Production Availability, confirmed via the
  `Unreleased Only` filter before/after) — 4 consecutive clean runs, ~2.0-2.1 min each, entirely
  headless.
- `ROBAR_Tests/tests/Label-Control/Mass_Update_Versions.spec.ts` added 2026-10-01 (create+approve
  item → assign LCN → Mass Update Versions with Keep Version for Item/Template/Master Data) — 3
  consecutive clean runs, ~1.5 min each, entirely headless. Found this page's Submit control is
  `#SubmitButton`, not the `#submitBtn` id the other two job-submission pages use — see
  `robar-module-reference.md` row 3 for the full gotcha writeup. Only the simplest "Keep Version"
  success path is live-confirmed; "Use Latest Version"/"Allow Unapproved"/partial-success branches
  still untested live.
- `ROBAR_Tests/tests/Label-Control/Link_to_Label_Master.spec.ts` added 2026-10-01 (brand-new item,
  no Label Master, both checkboxes left unticked, expect the clean per-record "not found" error) —
  3 consecutive clean runs, ~1.4-1.5 min each, entirely headless. Found a failed link reports job
  `Status: CompletedWithErrors` (new status value, see `robar-module-reference.md` row 5). Only the
  not-found error path is live-confirmed; the "Update Existing"/"Use Latest" success branches need a
  real matching Label Master, not yet set up.
- `ROBAR_Tests/tests/Label-Control/Redline_Compare.spec.ts` added 2026-10-01 (two fresh items, no
  Label Master, full Create-Temp-Master dialog → PDF-compare dialog → Exit flow) — 3 consecutive
  clean runs, ~2.3-2.4 min each, entirely headless. Two real gotchas found building this one (full
  detail in `robar-module-reference.md` row 6): the dialogs render inside the Label Control grid's
  own iframe, not the top-level page; and checking two grid rows back-to-back without a settle
  wait races the grid's own selection-tracking, producing a false "must select TWO records" error.
- `ROBAR_Tests/tests/Label-Control/Link_Attachments.spec.ts` added 2026-10-02 (create+approve item
  → assign LCN → upload a unique new file via the separate "Attachment Upload" Document Control
  tile → Link Attachments → confirm via the "With Attachments" filter) — 3 consecutive clean runs,
  ~1.9-2.3 min each, entirely headless. Full gotchas in `robar-module-reference.md` row 4.
- **General Playwright lesson from this work, applies to every spec:** Playwright actions and
  waits (`click`, `innerText`, `waitForLoadState`) have no default per-call timeout here (config
  `actionTimeout` is unset) — an unbounded call that never resolves silently eats the whole test
  budget instead of failing fast. Several "mystery ~600s stalls" were exactly this, not server
  slowness. Pass explicit `{ timeout }` on best-effort/polling calls.
- `ROBAR_Tests/tests/Label-Control/Compare_With_Prior.spec.ts` added 2026-10-02 (two fresh items,
  no prior LCN, expect both per-record errors, job `CompletedWithErrors`) — 3 consecutive clean
  runs, ~2.4-2.5 min each, entirely headless. Submit button has no id (third Submit pattern).
- **Three suite-wide flakiness fixes found building Compare With Prior (2026-10-02), applied to
  every Label-Control spec:** (1) after checking ANY grid row (not only two), wait ~500ms before
  opening Actions — the Knockout selection count lags the DOM checkbox and the action fails with
  "Please select record(s)"; intermittent, so passing runs don't prove it's safe. (2) Job Detail
  polling must wait for a TERMINAL status (`Completed`/`Failed`), not just any non-blank status —
  `InProgress` with 100% and filled rows is a real transient state. (3) The Label Control grid pages
  at 10 rows: never filter on a bare shared prefix like `MBLCRC` — leftover items from earlier runs
  push this run's rows onto page 2. Filter on a per-run stamp.
- `ROBAR_Tests/tests/Label-Control/Recreate_Master.spec.ts` added 2026-10-02 — Recreate Master
  CREATES a Label Master (item moves "Without" -> "With Label Master"), 3 consecutive clean runs,
  ~1.8 min each. Reason Code is `DataLoad` here (not `General`); Job Detail `Status` has no colon.
  This unlocks the Label Master dependent actions below.
- `ROBAR_Tests/tests/Label-Control/Export_Master.spec.ts` added 2026-10-02 — builds a real Label
  Master via Recreate Master, runs Export Master, and verifies the PDF actually landed on
  `//VMSRVTST703/Network/ExportMaster/<folder>` (then deletes only its own unique folder). 3
  consecutive clean runs, ~2.2-2.3 min each. No e-signature on this action.
- `ROBAR_Tests/tests/Label-Control/Change_Report.spec.ts` added 2026-10-02 — builds a real Label
  Master, runs Change Report with defaults, confirms the job completes and the saved report makes
  the item show under "With Attachments". 3 consecutive clean runs, ~2.6-2.7 min each.
  **All 10 Label Control bulk actions now have a live Playwright spec.**
- Remaining Label Control work: (1) the two ROW actions, Update Versions and Attachments (the
  latter is the single-record Link Management view); (2) deeper branches of the bulk actions that
  need richer data — Link to Label Master success (matching master), Compare With Prior success
  (needs a prior LCN), Mass Update Versions "Use Latest Version"/"Allow Unapproved", Change Report's
  other radio options/Link to prior/Save to Folder, Manage Production Availability's date fields.
- **Full-folder verification 2026-10-02:** all 10 `tests/Label-Control` specs run back to back, 10
  passed in 20.0 min (after the settle-wait / terminal-status / per-run-stamp hardening and the
  Sentinel foreground fix).
- **Full-folder verification #2, 2026-10-02 (evening):** all 20 `tests/Label-Control` specs back to back — 19 passed, 1
  failed, 57.9 min. The failure was `Change_Report_Options.spec.ts` (6.4 min in): one of its Change Report jobs ended
  `CompletedWithErrors` instead of `Completed`; the message was not captured (the old assertion printed only the
  status). It passed standalone right after (10.4 min) and 3/3 earlier, so it is treated as a one-off flake. The spec
  now fails with the full Job Detail text if a job doesn't complete, so the next occurrence will explain itself — if
  it recurs, look at that message first (candidates: Grouped Master generation, the CDR share, a Global Setting).
- `ROBAR_Tests/tests/Label-Control/Update_Versions.spec.ts` added 2026-10-02 (row-level Update Versions: no-MD
  record shows current versions with a disabled MD placeholder and blocked Submit; a record with an
  unapproved MD record starts on `None`, and choosing `0 Unapproved` + Submit links it) — 3 consecutive
  clean runs, ~3.2 min each, no BarTender. Found along the way: the random Primary DI Number
  (`'00841646' + Math.floor(Math.random() * 1000000)`) could be too short (~10% of runs, "Value is shorter
  than the minimum length") — fixed with `padStart(6, '0')` in six specs, including the permanent
  `Master-Data-Management/Create_New_Record.spec.ts`.
- `ROBAR_Tests/tests/Label-Control/Attachments_Row_Action.spec.ts` added 2026-10-02 (Link Management via the
  row action: pre-filtered to the LCN, the 6-option mode select, Detach with no confirmation landing on the
  AttachmentDetails job page, record then leaves "With Attachments") — 3 consecutive clean runs, ~2.5-2.6 min
  each. **Both row actions and all 10 bulk actions now have permanent specs.** Remaining Label Control work is
  the richer bulk-action branches listed above plus the grid page's own features (Save/Load Filter, Advanced
  Options, pagination, label-type-security banner).
- `ROBAR_Tests/tests/Label-Control/Compare_With_Prior_Success.spec.ts` added 2026-10-02 — Compare With Prior's
  SUCCESS path (drop it from the "remaining branches" list above). Needs an item with two versions (Campaign
  Manager Save As New Version, no BarTender), one Assign Control Number job over both versions, then Compare
  With Prior over both: v1 -> `Prior LCN: <v0 LCN>`, v0 -> "Prior LCN record not found", job CompletedWithErrors,
  and the saved redline makes only v1 appear under "With Attachments". 3 consecutive clean runs, ~2.0-2.1 min
  each. This two-version item setup should also unlock Link to Label Master's success branches.
- `ROBAR_Tests/tests/Label-Control/Link_to_Label_Master_Success.spec.ts` added 2026-10-02 — Link to Label Master's
  success/option branches (drop from the "remaining branches" list above). Two-version item, one Assign job, Recreate
  Master on v0 only, then four single-record jobs: v1 no options -> "Matching label master record not found."
  (the previously unconfirmed third message variant, now confirmed); v1 + Use Latest -> Updated; v0 no options ->
  "already linked"; v0 + Update Existing -> Updated. 3 consecutive clean runs, ~4.3-4.5 min each, no BarTender.
  Remaining Label Control work: only edge cases (template-name-changed note, Released-record security error,
  DuplicateRecord) — everything on the original list now has a spec.
- `ROBAR_Tests/tests/Label-Control/Mass_Update_Versions_Template_MasterData.spec.ts` added 2026-10-02 — Mass Update
  Versions "Use Latest" for Template and Master Data: template already latest -> "no latest approved found"; MD with only
  an unapproved record -> same; both -> one merged "Template and Master Data" message; partial success (MD updated with
  Allow Unapproved, template fails) -> row Error + "Successfully updated: Master Data version. Could not update Template
  version, ..." (message wraps — read whole Job Detail text); MD again -> "no latest version found". 3 consecutive clean
  runs, ~3.6 min each.
- `ROBAR_Tests/tests/Label-Control/Grid_Features.spec.ts` added 2026-10-02 — the grid page's own features: pager (10/20/30,
  next/prev/first/last), Advanced Options (field picker adds a column, Limit Results caps the retrieve), Save / Load /
  Overwrite / Delete of named filter sets (deletes only its own `PWGridFilter<stamp>`). No setup needed (queries the
  leftover TESTPW* items). 3 consecutive clean runs, ~2.7 min each. **Finding: Load Filters restores the criteria but
  resets the LCN Status / Attachments / Label Master dropdowns to defaults** (likely `FilterSet.load()` assigning
  strings to object-bound observables) — recorded as a known-issue annotation; candidate product bug.
- `ROBAR_Tests/tests/Label-Control/Export_Master_Merge.spec.ts` added 2026-10-02 — Export Master with two records,
  without Merge (one PDF per record named `<LCN>_<item>_<type>_<ver>.pdf`) and with Merge (one
  `ExportedMasters_<timestamp>.pdf`, larger than either single master), verified on `//VMSRVTST703/Network/ExportMaster`
  with only its own two folders deleted afterwards. 3 consecutive clean runs, ~2.6 min each. **Finding: the Job Detail
  Download link returns an empty 200 response for both the ZIP and merged-PDF jobs (and a real click yields no
  download)** — candidate product bug, not diagnosed further; worth reporting to the user/dev team.
- `ROBAR_Tests/tests/Label-Control/Manage_Production_Availability_Dates.spec.ts` added 2026-10-02 — MPA's Effective
  Begin/End, un-release, multi-field job and validation paths, read back through the LCN Status filter (Active
  Only / Unreleased Only). Passed 4 full runs (~10-12 min), then 7.0 min after trimming the read-backs to reuse one
  open Label Control tab (change the LCN Status dropdown + Retrieve instead of reopening the module); user accepted it
  as passing. Date inputs are READONLY datepickers — set via `datepicker('setDate')`. **Environment lessons from this
  stretch:** a VPN drop (vmsrvtst703 stops resolving), stalled background jobs, and the user enabling the
  `LabelControl_MasterDataMustExist` Global Setting each broke every LC spec in confusing ways — read the Job Detail
  row message first (see memory `feedback_global_settings_affect_tests`). Specs also need a re-query loop for a
  just-created item / record that is missing from the first grid read.
- `ROBAR_Tests/tests/Label-Control/Change_Report_Options.spec.ts` added 2026-10-02 — Change Report's options (drop
  from the remaining list): Do Not Recreate (no new attachment), re-run adds a second same-named file, Grouped
  Master Only (`GroupedMaster_<item>.pdf`), Both (`GroupedMasterWithCDR_<item>.pdf`), Save to Folder (client-side
  "SubFolder is required."; file verified on `//VMSRVTST703/Network/CDR/<sub>`, own folder deleted afterwards), Link
  to Prior (file also linked to the v0 record). Two-version item, jobs on v1; attachments read back via the row-level
  Attachments action. 3 consecutive clean runs, ~11 min each. mbuser1 already holds LC_CDR_LinkToPrior and
  LC_CDR_SaveToFolder (no security changes needed).
- `ROBAR_Tests/tests/Label-Control/Mass_Update_Versions_Use_Latest.spec.ts` added 2026-10-02 — Mass Update Versions'
  "Use Latest Version" for the Item dimension, with and without Allow Unapproved: one LC record on a 3-version item
  (v0/v1 approved, v2 unapproved), four jobs -> Updated, "no latest approved found", Updated, "no latest version
  found". 3 consecutive clean runs, ~3.2 min each. Lessons: the LC grid orders version rows randomly and hides the
  version (assign the LCN while only v0 exists, via the still-open Campaign Manager tab); click the Main Menu tab
  before openMenuItem when another module tab is active; Job Detail's Version column is the PRE-update version.
- **MDM (started 2026-10-02, user stepped away — continue autonomously, grind through the module):** new specs in
  `ROBAR_Tests/tests/Master-Data-Management/` — `Record_Lifecycle` (validation, approve + lock, new version,
  retire/unretire, save as new record), `Bulk_Mass_Approve`, `Bulk_Mass_Update`, `Bulk_Mass_Retire_Unretire`,
  `Bulk_Save_As_New_Version`, `Bulk_Assign_GTIN`, `Bulk_End_Distribution` — all 3/3 clean (30 s – 1 min each), findings in
  robar-module-reference.md ("Playwright specs + live selector/behaviour findings, 2026-10-02" under MDM). Shared helpers
  added to `tests/support/master-data.ts` (openMasterData/reopenMasterData, createValidRecord, clickEditAction,
  signAndSubmit, retrieve (ALWAYS sets For Items/Latest/Effective — the account persists them), checkRows,
  openBulkAction, openJobPage/fillJobSignature/submitJobAndRead). **Update 2026-10-04:** `Bulk_Assign_Labels` (3/3), `Schemas_Field_Editor` (3/3, fixture
  `MBExploreSchema`) and `Schemas_Field_Settings_Effect` (3/3, fixture `MBNonItemschema2`) are done; new helpers
  `tests/support/schemas.ts` and `tests/support/pdf.ts` (PDF helper has documented limits — raster, no text). User added a
  standing LEARNING GOAL: **master-data-level share names** (schema field Share Name -> template text-object binding -> value
  on the label); the code-traced explanation + live findings are in robar-module-reference.md ("Master-data-level SHARE NAMES").
  Still to do on MDM: Export to Excel (known 503 bug — re-check), Quick Edit, Data Retrieval/filters/Advanced Options,
  Save/Load Search, MD Job Inquiry, Excel Import (real `<input type=file>`), View History, security gating (MB users/groups only),
  and a text-level proof of a merged `md_*` value (try the Print Prep wizard / print history / BarTender Get Data). Detours the
  user explicitly welcomes: Template Management, Field Defs Management, Label Type Management, Global Settings (view only).
  **Update 2026-10-04 (later):** `Quick_Edit`, `Export_to_Excel` (works in MDM — no 503), `Save_and_Load_Search`,
  `Data_Retrieval_Filters`, `MD_Job_Inquiry` (filters by Display Id and by Item Number) and `View_History` (per-version log,
  Field/User filters, View Detail snapshot) are all done, 3/3 each; remaining
  on MDM: (Excel Import done 2026-10-04 — `Excel_Import.spec.ts` 3/3 (~5.5 min), needs the `exceljs` devDependency, findings in the reference; note two early runs hit "Page crashed" on the heavy Edit page while several Job Detail tabs were open — fixed by closing all module tabs before each grid visit), (Schemas extras done 2026-10-04 — `Schemas_Dropdown_Sources_Export.spec.ts` 3/3: Static/Linked/Query dropdown sources + Export Schema), security
  gating, (Assign GTIN Source-DI mode done — `Bulk_Assign_GTIN_Source_DI.spec.ts` 3/3), a full-folder re-run, and the text-level merged-`md_*` proof.
  **Full MDM folder run 2026-10-04 (later, 19 specs incl. Excel_Import, View_History, MD_Job_Inquiry, Quick_Edit, Export_to_Excel, Save_and_Load_Search, Data_Retrieval_Filters, Schemas_Dropdown_Sources_Export): 19/19 passed, 23.7 min, workers=1.**
  Earlier full run: **11/11 passed, 8.9 min** (this also re-verified `Create_New_Record` after the DI-number
  padStart fix). Schemas cannot be deleted — only use the no-data MB fixtures (`MBExploreSchema`, `MBNonItemschema2`) and delete what you add.
- **Workflow Management, evening of 2026-10-05 (user order: Attachments, Report, Linked Documents, Filters, Multi-step presets, Add to Group):** DONE with 3/3 clean runs: `Attachments.spec.ts`, `Report.spec.ts`, `Linked_Documents.spec.ts`, `Filters.spec.ts`, `Security_Gating.spec.ts` (+ earlier Preset_Management, Workflow_Lifecycle, Item_Workflow, Template_Workflow, Edit_Workflows, Export_to_Excel). UPDATE 2026-10-06 -- all now 3/3 clean: `Multi_Step_Presets.spec.ts` (16 min; S4/S5 reject + approve = Approved "last vote wins" with veto off, ValMaster silent, in the DIT tracker; S6 Veto confirmed), `Attachments_Security.spec.ts` (15 min), `Linked_Documents_Security.spec.ts` (4.3 min), `Edit_Workflows_Add_To_Group.spec.ts` (5.4 min), plus `Browser-Printing/Multi_Document_Printing_Security.spec.ts` (headless, 1 min: tile + page need BP_MultiDocumentPrint; unauthorized direct URL = raw 404 page, in the tracker). Also 3/3 (2026-10-06): `Edit_Workflows_Voted_Steps.spec.ts` (voted workflow reported "has already voted or does not exist", unvoted one changed; deleting the last open step leaves a workflow Open forever -- in the tracker) and `Edit_Workflows_Add_To_Group.spec.ts`; `support/workflow.ts closeWorkflow()` added (Filters spec re-run green with it). STILL TO DO in WM: WorkflowEdit_Option / WF_Generate_Report beyond the greyed menu items, PreApprove User (needs a global setting change + IISRESET -- do not do without the user). Headless limit: clicking Next on the Multi Document Printing page freezes a headless browser (Sentinel launch) -- MDP flows need headed runs with FlaUI. Helpers added: `support/workflow.ts` (showNewestFirst, voteTickedWorkflows, createWorkflow, addPresetStep, createPresetWithSteps, VoteKind), `support/security.ts` setGroupProcesses, `support/print-history.ts`. Not committed to GitHub yet.
- **Lot Management (2026-10-06, started at the user's request; headless, DynamicUI `Definition=Lots`):** `tests/Lot-Management/Lot_Management.spec.ts` (grid, search, Add incl. validation, Edit, View, Audit, Delete) has 2 clean runs (7.6 min each); run 3 was interrupted when the laptop was shut down -- if it was killed mid-run, throw-away lots `MBLML<stamp>` / `MBLML<stamp>X`, and possibly a BLANK ROBAR record dated that day, are left in the grid: search LotNum Contains `MBLML`, delete them (and the blank record: LotNum Is Blank, ROBAR, not the old "England"/"hello" ones). `Lot_Management_Security.spec.ts` + `support/print-entity.ts` (`setUserPrintEntities`, MB users only) are WRITTEN BUT NEVER RUN: it gives MBPWLogin01 the ROBAR entity, checks the view-only anatomy (icons, View window, Excel Import hidden) and the documented missing server-side checks (AddRecord oper add/edit POST and DeleteRecord GET with only LE_View_Lots; first run only LOGS the outcome); afterwards it must leave MBPWLoginGrp without processes and MBPWLogin01 without entities (check both first thing tomorrow). **UPDATE 2026-10-06 evening: Lot Management is DONE** — 6 specs, all 3/3: `Lot_Management`, `_Security`, `_Process_Icons`, `_Excel` (Import/Export), `_Print_Entity_Off` (PrintEntityRequired=N, the TST703 value) and `_Save_Load_Search` (leaves one saved search `MBPWSS1`, no UI delete). `Lot_Management_Print_Entity.spec.ts` (Y-state) is written but UNVERIFIED and auto-skips until the user flips the setting (settings-change-requests #4). Lot Management findings (blank / unknown-item lots accepted) are in the DIT tracker.
- **Multi Document Printing + User Print Entity Management (2026-10-05, user request; detour from MDP to User Print Entity because Claude01 had no Print Entity):** DONE: `tests/Browser-Printing/Multi_Document_Printing.spec.ts` (headed, 3/3, 1.5 min: entry panel, lot panel, one label row per printer, preview, Test Print + real Print to Microsoft Print to PDF; needs FlaUI to confirm TWO Sentinel prompts) and `tests/Print-Entity/User_Print_Entity_Management.spec.ts` (3/3, MBUser11/12 fixtures). Claude01 now has `*`. OPEN: Print History Inquiry returns HTTP 500 for Claude01 (not caused by the missing entity; needs server logs or another account); the produced PDF location is unknown; **2026-10-06: Override Lot Data DONE** (`Multi_Document_Printing_Override_Lot.spec.ts`, headed, 3/3; Manufactured is editable even without the override; Expires recalculates). **View Master/Compare with a label master DONE** (`Multi_Document_Printing_Label_Master.spec.ts`; both open a new tab; fixture item `MBMDPM3213026` built by `support/label-master-item.ts` via Recreate Master). **Prompts / Edit Prompt Data DONE** (`Multi_Document_Printing_Prompts.spec.ts`, headed, 3/3; template `SIMPLEPROMPTS`, fixture item `MBMDPP4277583`; other prompt templates listed in the reference). Not yet covered for MDP: multiple rows at once (cannot print to real printers), reprint/security gating (`BP_MultiDocumentPrint`), Print Entity dropdown behaviour. Details in the reference's "Multi Document Printing" and "Playwright-confirmed 2026-10-05" (User Print Entity) blocks. Remember: today's work is uncommitted to GitHub.
- **Dictionary Management (2026-10-07, user request while he worked elsewhere; headless, TST703, seed user MBUser1):** DONE as 4 specs in `tests/Dictionary-Management/` + helper `tests/support/dictionary.ts` (see the reference's "Dictionary Management - Playwright-confirmed 2026-10-07" block): `Dictionary_Management.spec.ts` (anatomy, search operators, New Entry incl. required / duplicate / custom + future dates, View/Edit read-only fields, tooltip, Edit as HTML with CKEditor, New Version blocks), `_Bulk.spec.ts` (Mass Approve incl. already-approved banner, New Version of an approved record, version filters, Latest Only, Retire / Unretire, Export to Excel + file content), `_Excel.spec.ts` (template headers, validation errors, upload, Row already in Database replace prompt, signer rights DM_Import / DM_ImportOverwrite), `_Security.spec.ts` (each DM_* process switches on its own control; tile needs Web_DictionaryManagement; DM_Edit makes View/Edit editable). Findings in the DIT tracker (Unretire resets Effective Begin, Retire works on unapproved records, wording / header mismatches vs the formal scripts, server-side authorization not demonstrated). Not covered: audit tables (no SQL), approved-record row action "View/Edit" for a user without DM_Edit on a seeded record beyond read-only, Print / label use of dictionary phrases.
- **Label Type Management (2026-10-04, user: "do both Field Defs and Label Types, you choose the order"):** DONE as 3 specs in `tests/Label-Type-Management/` (see the reference's "Playwright-confirmed" block under Label Type Management); creation deliberately NOT exercised (auto-grants `LT_<name>` to every group incl. non-MB, and Label Types cannot be deleted) — ask the user before ever creating one. It is a DynamicUI page (13 seeded definitions share the mechanics; helper `tests/support/dynamic-ui.ts` is reusable for Lot Management, Facilities, Printer Control, PrintConfig, Global Settings...). Field Defs Management also DONE 2026-10-05 (3 specs in `tests/Field-Defs-Management/`, see the reference block). Workflow Management Export-to-Excel re-check DONE 2026-10-05 (`Workflow-Management/Export_to_Excel.spec.ts` 3/3 — works, 503 does not reproduce; WM page anatomy in the spec header). NEXT candidates (ask the user): Workflow Management itself (810 workflows on TST703; Create Workflow, Preset Management, View and Vote, Report), Lot Management / Facilities / Printer Control (all DynamicUI — reuse `support/dynamic-ui.ts`), Dictionary Management, Codes, Destination Labeling, Print History Inquiry. Not done for Label Types: Excel Import negative paths (DynamicUI/ExcelImport page). Note for next sessions: everything from 2026-10-04 is committed on the GitHub branch `exploratory-learning` (masoninnovatum/ROBAR_Tests); newer work (Field Defs Item Screen Layout + docs) is uncommitted.
- **Workflow Management (2026-10-05, user: learn WM incl. creating workflows AND the item/template workflows):** specs in `tests/Workflow-Management/` (see the reference's "Playwright-confirmed 2026-10-05" block): Preset_Management, Workflow_Lifecycle, Item_Workflow, Template_Workflow, Export_to_Excel. KEY FACTS: item/template are LOCKED while their workflow is open; approval is recorded as "Approved By = workflow id"; reject releases. DONE since: Edit Workflows (Add End/Beginning, Replace, Delete; `Edit_Workflows.spec.ts` 3/3), Template_Workflow 3/3, Workflow_Lifecycle 3/3, plus `tests/Cross-Module/Approved_Template_Item_MDM.spec.ts` (approved template + item + MDM record, 1 run). Still TO DO in WM: Edit Workflows "Add to Group" + workflows with votes cast, Add Attachments (WM_AddAttachment_Open/Closed, duplicate filename), Report (PDF to WFReportPathName), Linked Documents, Filters (Included vs Can Vote, Open/Closed, CC filter + View Change Control dialog, Select All vs Page), MULTI-step presets (groups / Vote for Entire Group / Veto), and SECURITY gating with the MB fixtures (WM_Create_New_Workflow, WM_Create_Workflow_Preset, WM_ViewAndVote*, WM_ViewAndVoteSkipComment — the comment-required rule, WorkflowEdit_Option, WF_Generate_Report). Gotcha recorded: a second `login()` on a logged-in session crashes the page; `cm.openCampaignManager()` logs in.
- **Template Management revisit (2026-10-04):** (1) side test `Cross-Module/Template_Item_MDM_LCN_Release.spec.ts` (new template -> item -> MDM -> assign LCN -> release LCN, headed) + the two fixes the user asked for (wait for BarTender/Sentinel to FULLY close — `bartender.waitForBartenderClosed`, also used by `closeTemplateEditor`; Label Control waits keep pressing Retrieve in one module instance instead of reopening it), applied to `Create_Approved_Template_and_Item.spec.ts` too. (2) **Text-level proof of share-name merging achieved**: `Template-Management/Get_Data_Master_Data.spec.ts` — see the reference's "LIVE PROOF of the template side". New-account gotchas hit: no saved filter row in Template Management (click the Add Filter inner span), WebMenu idle logout during long BarTender runs (keep-alive `RefreshTimeout`). (3) `Template-Management/Search_and_Filter.spec.ts` done 3/3 (Approved dropdown now ANDs with criteria rows; Filter by Data Source = which templates bind a share name). (4) `Template-Management/Security_Gating.spec.ts` (tile / LT_ label-type visibility / per-TM_*-process action gating as a real MB user; approved templates lock Replace + Edit Attributes). (5) `Template-Management/Get_Data_Options.spec.ts` (unapproved-MD checkbox on/off, Use Sample Data; screenshot evidence). (6) `Template-Management/Mass_Approve_Negative.spec.ts` (nothing selected, wrong password, incomplete form, already-approved selection disables the form). Template Management is now broadly covered (user: Localization Resources deliberately skipped). Still open here: Label Characteristics variants, Get Data's effective-date options ("Effective Items/Master Data Only"), approve-in-editor e-signature failures. Possible next modules: Field Defs Management, Label Type Management (the user welcomed these detours), Dictionary/Codes, Workflow Management Export to Excel re-check (Use Sample Data, unapproved MDM checkbox, Master Data search).
- **Security Management (2026-10-04, user: "learn Security Management, then circle back to Template Management"):** done as the seed user `Claude01` — `tests/Security-Management/` `Security_Groups`, `Security_Users`, `Security_Effect_On_Login` (3/3 each; helpers `tests/support/security.ts`, `loginAs` in `robar.ts`), findings in the reference's Security Management section. Only MB* users/groups are written (user: free to edit "as needed"); the per-run `MBPWG*`/`MBPWU*` rows can't be deleted. **Critical candidate logged: write endpoints have no server-side authorization.** Not yet covered: Security-driven field-level `MC_*`/schema `SCH_*`/label-type `LT_*` effects on live modules, `UpdateUser/UpdateGroup` server-side probes (deliberately not posted), AD-authenticated users, password-reset-at-next-logon flow. Specs are now username-agnostic (USERNAME/PASSWORD from `robar.ts`; the seed username can change). NEXT: circle back to Template Management.
- **Standing rule (user, 2026-10-04): keep `.agents/dit-tracker.md` as a running list of EVERY issue found** — add a row
  (defects table, or the "Observations and script/behaviour discrepancies" table for smaller things) at the time you find
  it, with date, module, summary, severity, "Candidate", and a source pointer. The user reviews it and raises items with
  developers; nothing is filed or changed from here. Backfilled 2026-10-04 with the Label Control / MDM / Schemas
  findings (Export Master download, Load Filters dropdown reset, Labeler Duns default, Export to Excel 503, schema-rename
  security TODO, plus six observations). Other "Confirmed bug" entries elsewhere in `robar-module-reference.md`
  (Campaign Manager Item Data Compare, etc.) are not yet mirrored into the tracker.
- Authoring gotcha (bit three times now): backslashes in file content written through bash
  heredocs get stripped (`\\s` -> `\s`, `'\\'` -> `'\'`, UNC `\\host` -> `\host`). Prefer forward
  slashes + `path.join`, string methods instead of regex escapes, and always re-read/grep the
  written file before launching a long run.
- Tooling lessons: Python is NOT installed on this machine (don't script edits with it); always
  confirm an edit landed before launching a multi-minute run; never put backslash regex escapes
  in template literals (`\s` silently becomes `s`) — use string methods or regex literals.
- Further daily-workflow pieces beyond Label Control are expected but not yet identified.
- **Codes Management (2026-10-08, user request):** DONE as 3 specs in `tests/Codes-Management/` (`Codes_Management`, `_Excel`, `_Security`), 3 consecutive green rounds; behavior in the reference's "Codes Management - Playwright-confirmed 2026-10-08" block, findings in the DIT tracker (Active "Maybe" passes validation + empty error dialog, one-process signer message, "chararacters" typo, filter quirks; server-side Update refusal is positive). Codes cannot be deleted: specs only create/edit `MBCodesTest` codes. Not covered: Excel Import with unapproved-signer variants beyond EI_Codes/EI_Codes_Upd, localized UI.
- **Print Entity Y-state + AddLotReasonRequired (2026-10-08, after the user set PrintEntityRequired = Y and AddLotReasonRequired = Y):** DONE: `tests/Print-Entity/Print_Entity_Print_Screens.spec.ts` (six print screens, 0 / 1 / 2 entities, 3/3), `Lot-Management/Lot_Management_Print_Entity.spec.ts` (3/3; two deviations from PE_LotManagment) and `Browser-Printing/Add_Lot_Reason_Required.spec.ts` (3/3). See the reference blocks "Print Entity with PrintEntityRequired = Y" and "AddLotReasonRequired = Y". NOT done: Print by Order itself (printing flow), MDP Print Entity dropdown during a print, inactive-entity and last-used-entity cases, Excel Import / Print History with Y. The user restores PrintEntityRequired (N) and AddLotReasonRequired (N) when finished.
- **Print Entity follow-ups (2026-10-08, user: "all but 6, run headed"):** DONE (3/3 each): Print by Order real print (`Print_By_Order.spec.ts`), Multi Document Printing with a Print Entity (`Multi_Document_Printing_Print_Entity.spec.ts`), last-used entity default (inside both), Lot Management Excel Import with Y (`Lot_Management_Excel_Print_Entity.spec.ts`), inactive entities (`Print-Entity/Print_Entity_Inactive.spec.ts`). Remaining: Print History entity filter with Y (blocked by the Print History Inquiry HTTP 500, needs the user's DB check), Print by Order Multi / Order Lot printing flows, Reprint with entities. Test data left: one printed lot per headed run (`MBPOE*`, `MBMDPE*`; printed lots cannot be deleted) - see the reference.
- **Destination Labeling (2026-10-08, user: ValMaster requirements first, ignore Customer Specific):** PARTIAL: 3 specs in `tests/Destination-Labeling/` (main page / order mechanics, security, headed barcode scan), 3/3 each, requirement-cited with deviation annotations; requirement set saved in `.agents/valmaster-destination-labeling.md`. Most of the 215 requirements (worklist, Print All, verification, printing hierarchy, history, translations) need data from the user: see the data requests in `settings-change-requests.md`. Four deviations logged in the DIT tracker.
