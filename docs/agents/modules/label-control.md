<!-- Split from robar-module-reference.md on 2026-10-09 (lossless, original order kept; later blocks are newer and win over earlier ones). Module file: label-control -->

## Label Control

**Purpose:** Manages Label Control Numbers (LCNs) — the record that ties a released label to a
specific Item/Template/Master Data version combination — including version updates, control number
assignment, production availability, attachment/master linking, redline comparison, and label
master recreation/export.

**Formal scripts reviewed:** all 15 scripts under `Label_Control\7.0.3\` (14 test-case areas per
`LC_TestPlan`; see `.agents/exploratory-session-log-label-control.md` for the full breakdown).

### Basic Functions / retrieval
Filter row: `Column`/`Operator`/`Value` (+ `Add Filter` for multiple, ANDed), plus a fixed
`Filter:` bar with `LCN Status` (All/Active Only/Latest Active Only/Latest Only/Unreleased Only —
note **"Unreleased Only" still means an LCN exists, just not released**; records with a genuinely
blank LC-LCN column only show under "All"), `Attachments` (Any/With/Without), `Label Masters`
(Any/With/Without). `Advanced Options` exposes a Available/Selected Fields dual-list plus
`Field Definitions for Label Type` and `Master Data Schema` pickers. A page-level banner **"Some
search results are not displayed due to label type security"** appears live whenever the logged-in
user's label-type security doesn't cover every label type in the result set — a real, load-bearing
signal, not a static/decorative message.

### Grid page features — live-confirmed 2026-10-02 (`Grid_Features.spec.ts`, 3/3 clean, ~2.7 min, no data setup: it queries the TESTPW* items earlier specs left behind)
- **Pager** `#grdPager` (jqGrid): "View 1 - 10 of N" in `.ui-paging-info`, rows-per-page select `.ui-pg-selbox` = 10 / 20 / 30 (default 10), buttons `#first_grdPager` `#prev_grdPager` `#next_grdPager` `#last_grdPager`; data rows are `#grdLabelControl tr.jqgrow` (the grid also has a hidden header/filter row, so count `tr.jqgrow`).
- **Advanced Options** (accordion `#advancedOptions h3 a`): dual list `#availableLimitColumns` (~90 fields, captions like "Item - Description") -> `#selectedLimitColumns` via `#btAvlToSel` / `#btSelToAvl`; default selected = "LC - LCN" + "Item - Item Number"; added fields appear as grid columns after Retrieve. `#txtResultLimit` (default 500, integers only, max 4 digits) CAPS the retrieve — limit 5 returns exactly "View 1 - 5 of 5". Also `#drpFieldDefLabelTypes` (label-type list; changing it reloads the column list) and `#drpMDSchemas` (`#mdDiv`, visible when MDM integration is on).
- **Save Filters** `#btSaveFilters` (jQuery UI dialog from the SaveFiltersDialog partial): `#radNew` / `#radExisting` + `#drpExistingSets`, `#txtFilterSaveName`, `#txtFilterSaveDescription`, `#chkPublic`; empty name -> `"This field is required."` in `#dvSaveFiltersError`; success closes the dialog with NO confirmation message. Saving with `#radExisting` + an existing set name overwrites it.
- **Load Filters** `#btLoadFilters`: jqGrid `#grdSavedFilters` (Name / Owner / Description) listing the user's own sets plus other users' PUBLIC ones (e.g. ALtFilter2 by AL01, MBPublicFilter by MBUser1); select a row then the dialog's Load button; delete via the grid's trash icon `#del_grdSavedFilters` -> jqGrid confirm "Delete selected record(s)?" -> `#dData`. Load re-applies in place (no navigation) and clears the grid until Retrieve.
- **⚠️ Known issue (observed, not diagnosed beyond reading the source):** Load restores the saved CRITERIA but the three dropdowns — LCN Status, Attachments, Label Master — come back at their defaults ("All (LCN Status)", "Any (Attachments)", "Any (Label Masters)") even though Save does store them (`getCurrentFilterSet` sends `RecordStatus`/`AttachmentFilter`/`LabelMasterFilter` names). Likely cause: `FilterSet.load()` in `FilterSet.js` assigns the saved name STRING to Knockout observables bound to option OBJECTS (the constructor maps strings to objects, `load()` doesn't), so Knockout resets them. The spec logs the dropdowns after Load and records a `known-issue` annotation.
- **Label-type security banner** "Some search results are not displayed due to label type security." was visible on the page for `mbuser1` (its label-type security doesn't cover every label type in the data).

### Row Actions (per-record dropdown)
- **Update Versions** — dialog with Item Version / Template Version dropdowns and a Master Data
  Version dropdown that's disabled (blank) when the record has no MDM link. Only shows versions
  that actually exist for that record (a record with only version 0 shows a single-option dropdown).
  **Live-confirmed 2026-10-02 (VAL703, UAT_6151):** the dialog is a partial loaded into
  `#editDialogDiv` (`EditLabelControlDialog`), with `#dvItemVersion`, `#drpTemplateVersion`,
  `#drpMasterDataVersion` selects and a jQuery UI button `#btnUpdate` (labelled "Submit"). The page
  deliberately adds `ui-state-disabled` to `#btnUpdate` on open, so **Submit stays unclickable until a
  version actually changes** (a click is intercepted by `.ui-dialog-buttonset`; Playwright reports
  "intercepts pointer events"). Opening the dialog shows each record's CURRENT versions as the
  selected values. An LCN assigned AFTER a newer approved template version exists is created on that
  newer version (already "Template Version 1" in this case) -- Update Versions had nothing to move.
  A record whose Master Data record is still **Unapproved** is NOT linked to it by Assign Control
  Number: the Master Data Version select reads `None` with `0 Unapproved` offered as an option, and
  choosing it + Submit (`UpdateLabelControl`, empty `ErrorMessage` on success) links it. Row-menu
  item text is `Update Versions` (scope the click to the row; every row's menu exists in the DOM).
  **Permanent spec 2026-10-02: `ROBAR_Tests/tests/Label-Control/Update_Versions.spec.ts`** (TST703, no
  BarTender; 3 consecutive clean runs, ~3.2 min each). Extra source-confirmed details
  (`EditLabelControlDialog.cshtml`): `#drpItemVersion` is the select inside the `#dvItemVersion` wrapper
  div; **`#drpMasterDataVersion` is rendered ONLY when the record has Master Data** -- with none, the view
  emits an id-less `<select disabled>` inside `#dvMDVersion`, so a locator on the id never resolves (a
  `textContent()`/`isDisabled()` on it hangs for the whole test timeout, since locator actions here have no
  default timeout). The page's close handler only destroys the jQuery UI dialog and leaves `#editDialogDiv`
  in the DOM, hidden -- close via Cancel and assert visibility, not element absence. Not covered: changing
  Template Version / Item Version (needs a second approved version of a template/item).
- **Attachments** — opens the shared **Link Management** module (same one reachable from the Main
  Menu's Document Control tile) pre-filtered by `LCN Exactly Matches <this record's LCN>`. The
  module's mode dropdown (top right) offers 5 attachment-association scopes: By LCN, By Item, By
  Item Version, By Template, By Template Version.
  **Live-confirmed + permanent spec 2026-10-02: `ROBAR_Tests/tests/Label-Control/Attachments_Row_Action.spec.ts`**
  (builds its own item/LCN/uploaded file as in Link_Attachments.spec.ts; 3 consecutive clean runs, ~2.5-2.6
  min each). The row menu holds exactly `Update Versions` and `Attachments`. The action opens
  `LinkAttachmentManagement/LinkManagement?controlId=<id>&previousSession=<id>`, whose grid (`#grdControl`)
  auto-loads under a pre-applied filter row `dvFilters[0]` = Column `LCN`, Operator `ExactlyMatches`,
  Value `<the record's LCN>`, showing LCN / Item Number / Template Name / File Name / Attachment Group.
  Mode select `#ddlLinkType`: `Associate Attachments` (value `-1`, selected by default), By LCN, By Item, By
  Item Version, By Template, By Template Version. `#btnDetach` is disabled until a grid row is checked.
  **Detach has NO confirmation dialog**: it runs immediately and lands on
  `LinkAttachmentManagement/AttachmentDetails?jobId=...&isVersionPage=true` (the same job-details page linking
  uses: "Job completed successfully" plus a Status / File Name / LCN / Item table); afterwards the record no
  longer appears under the `With Attachments` filter. The grid row's own Actions menu offers View, Download, Edit.

### Bulk Actions (9 total, per the formal scripts -- confirmed live 2026-09-30 to actually be **10**
in this environment's `#drpActions` menu; the DB-driven `LabelControlActions` seed table this list
comes from has 10 rows for `PageName == "LabelControl"`, not 9 -- not yet determined whether the
scripts are simply stale or one action is conditionally hidden in some environments) — job
submission pattern
All follow the standard Job Submission → e-signature (User Name/Password/Reason Code/Comment) →
async Job Detail (Display ID, Date Inserted/Completed, Status, Percent Complete, per-record
LC-LCN/ItemNumber/LabelType/ItemVersion/Status/Message grid) pattern. Reason Code dropdowns are
seeded from the `Codes` table (e.g. `MassUpdateVersionsSigReason`, `RecreateMasterSigReason`) and
in this environment currently contain exactly one active value -- `General` for every action tested EXCEPT
Recreate Master, whose only value is `DataLoad` (corrected 2026-10-02; selecting `General` there hangs
forever waiting for an option that doesn't exist).

| # | Action | Status | Notes |
|---|---|---|---|
| 1 | Manage Production Availability | ✅ Working, **confirmed live end-to-end 2026-10-01; permanent Playwright spec** | **Date fields / un-release / validation, live-confirmed 2026-10-02 (`Manage_Production_Availability_Dates.spec.ts`; passed on 4 full runs in total (11.7, 10.3, 10.2, 10.5 min) and, after trimming the state read-backs to reuse one open Label Control tab, 7.0 min; accepted as passing by the user without a formal 3-in-a-row on the final version — earlier failed runs were environment problems, not the spec: VPN drop, stalled background jobs, and `LabelControl_MasterDataMustExist` switched on):** read the result back through the Label Control `LCN Status` filter (options: `All (LCN Status)`, `Active Only` = inside the effective window AND released AND allow-print, `Latest Active Only`, `Unreleased Only`, `Latest Only`). State matrix observed: freshly assigned = Unreleased; after Release = Active; after Effective Begin/End set to a PAST window (1/1/2020-1/2/2020) = still released but neither Active nor Unreleased (present only under All); window restored (end 12/31/2099) = Active again; Release unticked (un-release, combinable with an Effective End change in one multi-field job) = Unreleased again. **The Effective Begin/End inputs (`#EffectiveBegin`/`#EffectiveEnd`) are READONLY jQuery UI datepickers** (default = today, shown `M/d/yyyy`, e.g. `10/2/2026`) — `fill()` fails with "element is not editable"; set them with `jQuery(el).datepicker('setDate', new Date(y, m-1, d))` through `evaluate`, which updates the value the submit handler reads. Field rows are `#controlBlock` (one per field; the field `<select>` has options Release / Effective Begin / Effective End); `Add Field To Update` link disappears at 3 rows; the action id is `#actManageProduct`. Validation: Begin >= End in the same job is rejected at submit with an error dialog ("Effective end date must be greater than effective begin", Close/Continue buttons) and nothing is sent; an End earlier than the record's EXISTING begin passes the client and becomes a per-record Error row (same text, job `CompletedWithErrors`, record unchanged); the same field twice shows the client-side dialog "Field To Update cannot be set to same value more than once. Please correct your selection." **Test gotcha:** the Label Control grid can still be loading when the 1.5s settle wait ends (a record that exists read as 0 rows once) — poll for an expected row, and require two zero reads when asserting absence. Original notes: `Field To Update` (default `Release`) + `New Value` checkbox, `Add Field To Update` for multiple fields in one job. Correctly blocks with `"Could not release, Item/Template/Master Data tied to label control is unapproved or ineffective."` when the underlying data isn't approved. **Live-confirmed:** the `New Value` control for the default `Release` field is a field-specific checkbox literally named `#AllowPrint` (`data-bind="checked: allowPrintValue"`), not a generic input — Effective Begin/End presumably swap in a date picker instead, not explored yet. Same async-job pattern as every other bulk action here (Job Detail reports blank `Status`/"Page of 0" immediately, poll until real). The cleanest way to confirm a release actually took effect isn't the per-record Job Detail message alone — re-querying with the `Unreleased Only` LCN Status filter before and after (present before, gone after) is a clean, independent confirmation. `ROBAR_Tests/tests/Label-Control/Manage_Production_Availability.spec.ts` drives a full round trip (create+approve item → assign LCN → release it) entirely headless — 4 consecutive clean runs, ~2.0-2.1 minutes each. |
| 2 | Assign Control Number | ✅ Working, confirmed live end-to-end 2026-09-30; **permanent Playwright spec 2026-10-01** | Only actionable on records with no LCN yet (blank LC-LCN column). Preview shows the next `Starting Control Number` before submit. `Use Unapproved Template`/`Use Unapproved Master Data` checkboxes. **This action IS the Label Control row's own creation mechanism, not a second step after one exists** (see the detailed write-up below the table) — it's backed by a genuinely separate module/project (`Innovatum.Pages.LabelControl.MassAssign.MVC`, route `MassAssign/JobSubmission`→`MassAssign/SubmitJob`→`MassAssign/JobDetail`), reached only as this grid action (no direct WebMenu menu entry of its own). `ROBAR_Tests/tests/Label-Control/Assign_Control_Number.spec.ts` drives this entirely headless (no BarTender involved) against a freshly-created Campaign Manager item — 3 consecutive clean runs, ~52-55s each. |
| 3 | Mass Update Versions | ✅ Working, **confirmed live end-to-end 2026-10-01 (Keep Version path only); permanent Playwright spec** | Item/Template/Master Data each get independent `Keep Version`/`Use Latest Version` dropdowns + a matching `Allow Unapproved` checkbox (only meaningful when "Use Latest Version" is selected). Per-record job results are **per-field granular** — e.g. one record can partially succeed: `"Successfully updated: Item and Master Data version. Could not update Template version, no latest approved found."` **Live-confirmed real field ids:** `#drpItemVersion`/`#drpTemplateVersion`/`#drpMDVersion` (selects), `#itemAllowUnapproved`/`#templateAllowUnapproved`/`#masterDataAllowUnapproved` (checkboxes, not yet exercised live). **Gotcha: this page's Submit control is `<input type="button" id="SubmitButton">`, NOT `#submitBtn`** like Assign Control Number's and Manage Production Availability's job-submission pages — the shared signature-component ids (`#txtJobDescription`/`#sigUser`/`#sigPassword`/`#sigReason`/`#sigComments`) are identical across all three, but the Submit button id is not; assuming `#submitBtn` here hangs the full test timeout with no useful error. Submit flow also fires an extra `POST MassUpdateVersions/Authenticate` immediately before `POST MassUpdateVersions/SubmitJob` (not observed on the other two actions' flows). Same async-job polling pattern as every other bulk action here. `ROBAR_Tests/tests/Label-Control/Mass_Update_Versions.spec.ts` drives the simplest success path (Keep Version for all three dimensions, on a brand-new version-0 item/template with no master data) entirely headless — 3 consecutive clean runs, ~1.5 minutes each. **Use Latest Version, Item dimension — live-confirmed 2026-10-02 (`Mass_Update_Versions_Use_Latest.spec.ts`, 3/3 clean, ~3.2 min each, no BarTender):** the dropdown options are only `Keep Version` / `Use Latest Version` (default is Use Latest); `#itemAllowUnapproved` (and the template/MD equivalents) is a checkbox shown only while the matching dropdown is on Use Latest — it, not a dropdown option, selects the service's `UseLatestApprovedVersion` vs `UseLatestAllowUnapprovedVersion`. One LC record on a 3-version item (v0 approved, v1 approved, v2 unapproved) gives all four outcomes: Use Latest (box off) v0->v1 `Updated` "Successfully updated: Item version."; again -> Error "Could not update Item version, no latest approved found."; Use Latest + Allow Unapproved v1->v2 `Updated`; again -> Error "Could not update Item version, no latest version found." (job `CompletedWithErrors` on the error runs). **Job Detail's Version column shows the version BEFORE the job's update** (J1 row says 0, J2 row says 1). **Gotchas:** the Label Control grid orders an item's version rows RANDOMLY and doesn't display the version, so you can't pick "the v0 row" — assign the LCN while only v0 exists (open Label Control from the still-open Campaign Manager tab, then return to it for Save As New Version), and click the `Main Menu` tab before `openMenuItem` whenever another module tab is active (otherwise the menu button is invisible and the click waits for the whole test timeout). **Template and Master Data dimensions, live-confirmed 2026-10-02 (`Mass_Update_Versions_Template_MasterData.spec.ts`, 3/3 clean, ~3.6 min, no BarTender):** unapproved MD record created BEFORE the LCN (so the LC record's MD version stays null), approved item on A1SuperTemplate, one record, five jobs: Template = Use Latest on a record already on the latest approved template -> Error `"Could not update Template version, no latest approved found."`; Master Data = Use Latest (box off) with only an unapproved MD -> Error `"Could not update Master Data version, no latest approved found."`; both dimensions failing -> ONE merged message `"Could not update Template and Master Data version, no latest approved found."`; **partial success** (Template Use Latest fails + Master Data Use Latest + Allow Unapproved succeeds) -> row Status `Error`, job `CompletedWithErrors`, message `"Successfully updated: Master Data version. Could not update Template version, no latest approved found."` (the message cell wraps onto a second line — read the whole Job Detail text, not just the tab-split row); Master Data Use Latest + Allow Unapproved again -> Error `"Could not update Master Data version, no latest version found."`. Gotchas: `createUnapprovedMasterData` needs the Main Menu tab active (after `cm.openCampaignManager` it isn't — use plain `login()` first). Still not live-exercised: the template-name-changed note, "master data must exist" (a Global Setting — do not flip it), Released-record security error, DuplicateRecord. |
| 4 | Link Attachments | ✅ Working, **confirmed live end-to-end 2026-10-02; permanent Playwright spec** | Same `LinkAttachmentManagement` project/controller as the row-level Attachments action, but a different view: this one is NOT an async Job Submission flow. `#actLinkAttachments` POSTs `AttachmentTransition` then redirects the Label Control tab's own iframe (no new tab) to `LinkAttachmentManagement/AttachmentManagement`, which only LINKS already-uploaded files. Requires every selected row to already have an LCN. **Uploading a new file is a separate Main Menu tile**, "Attachment Upload" (Document Control group; role `Attach_Upload_View`, separate from `AM_Attachment_Management`/`LM_View_LinkManagement`): route `LinkAttachmentManagement/UploadAttachments`→`UploadAction`. **Upload page gotchas:** (1) picking a File Purpose pops a modal "Confirm File Purpose" dialog ("Apply to all records?") that blocks the whole page including `#btnUpload` until OK is clicked; (2) the real ids are `#fileToUpload0` (hidden file input), per-row `select.ddlist` (File Purpose, 11 real options), `.chkFiles`, `#description`, `#btnUpload`, result divs `#returnMessage`/`#errorMessage` (success text "1 files uploaded successfully"). **AttachmentManagement page gotchas:** unlike Label Control's grid, its single filter row already exists by default (`dvFilters[0].Column/Operator/Value`, no Add Filter click) — but an unfiltered Retrieve Data does NOT show a just-uploaded file; search by `FileName` explicitly. `#btLink`'s click navigates to `AttachmentDetails?jobId=...`, NOT another `AttachmentTransition` POST (an early attempt waited on that URL and timed out on a request that never happens). The Label Control tab is still the active tab afterward, so close it before reopening Label Control from Home. Verification: re-query Label Control with `#drpAttachments` = "With Attachments". Use a unique filename per run (8 identical `FILE7TXT.txt` uploads piled up during exploration). `ROBAR_Tests/tests/Label-Control/Link_Attachments.spec.ts` — 3 consecutive clean runs, ~1.9-2.3 minutes each. |
| 5 | Link to Label Master | ✅ Working, **confirmed live end-to-end 2026-10-01 (not-found error path) and 2026-10-02 (all success/option branches); two permanent Playwright specs** | **Success branches, live-confirmed 2026-10-02 (`Link_to_Label_Master_Success.spec.ts`, 3/3 clean, ~4.4 min each):** build a two-version item (see Compare With Prior), one Assign job, Recreate Master (`DataLoad`) on the v0 record ONLY, then four single-record jobs — (A) v1, no boxes: Error `"Could not link to master. Matching label master record not found."` (the formerly-unconfirmed THIRD variant, now confirmed; job `CompletedWithErrors`); (B) v1 + `Use Latest If No Exact Match`: `Updated`, job `Completed`, both records then show under "With Label Master"; (C) v0 (already linked), no boxes: Error `"This record is already linked to a label master"`; (D) v0 + `Update Existing Label Master Link`: `Updated`. Rules from `LinkToLabelMasterService.cs`: exact match = ItemLabelMaster row with same item number + label type + item/template/master-data versions; else latest by item version for same item+label type (non-exact). The two checkboxes have no ids — use `input[data-bind*="updateExistingLabelMaster"]` / `input[data-bind*="useLatestNoExactMatch"]`; submit is `#submitBtn`. Original notes: `Update Existing Label Master Link` / `Use Latest If No Exact Match` checkboxes. Correctly reports `"Could not link to master. Matching or latest label master record not found."` when no exact match exists and the latest-fallback checkbox is off. **Live-confirmed:** route `LinkToLabelMaster/JobSubmission`→`LinkToLabelMaster/SubmitJob`→`JobDetail` (project `Innovatum.Pages.LabelControl.LinkToLabelMaster.MVC`); unlike Mass Update Versions, this page's Submit button genuinely is `#submitBtn`. The two checkboxes have no `id` at all — only Knockout `data-bind` (`checked: updateExistingLabelMaster` / `checked: useLatestNoExactMatch`), target via `input[data-bind*="..."]`. A failed per-record link reports job `Status: CompletedWithErrors` — a status value not seen on Manage Production Availability/Mass Update Versions (both only showed `Completed`). `ROBAR_Tests/tests/Label-Control/Link_to_Label_Master.spec.ts` drives the simplest path (brand-new item, no Label Master, both checkboxes left unticked, expect the clean per-record error) entirely headless — 3 consecutive clean runs, ~1.4-1.5 minutes each. The "Update Existing"/"Use Latest" success branches are documented from the formal script but not yet live-exercised (would need a real matching Label Master to link against). |
| 6 | Redline Compare | ✅ Working, **confirmed live end-to-end 2026-10-01; permanent Playwright spec** | Needs **2 selected records** (a single record produces a validation error, per the formal script — literal text, not a resource lookup: `"Please submit TWO label control records to the Redline Compare bulk action."`, confirmed in `Management.cshtml`). If neither has a Label Master, shows a "Create Temporary Master" dialog matching `LC_RedlineCompare` step 2.10 verbatim; confirming generates a real rendered PDF comparison with side-by-side LCN/Item/Label Type/Master Data Ver/Template details (smaller LCN on the left) and `Save to ROBAR`/`Download Redline`/`Exit` controls. **Resolved 2026-10-01, not a defect:** `Save to ROBAR`'s disabled state has exactly one binding in the whole view (`RedlineCompare.cshtml:98`: `.prop("disabled", !redlineCompareModel.hasSavepermission)`), traced unconditionally back to `RedlineService.cs:405`'s `RobarUser.HasPermissionFor(request.UserId, "LC_RedlineCompare_Link")` — there is no code path anywhere that also considers whether either record has a real vs. temporary Label Master. The formal script's own expectation (disabled when neither record has a master) does not match the actual designed behavior; the 2026-09-30 live observation (button enabled regardless of master state) was correct and is not a bug. **Confirmed NOT an async Job Submission flow** — it's synchronous/client-orchestrated: `LabelControl/GetLCNForRedline` → optional Create Temporary Master dialog → `Redline/RedlineCompare` partial. **Two gotchas found building the live test:** (1) both dialogs (`#createTempMasterDialog`, `#redlineCompareDiv`) render inside the Label Control grid's own iframe document, not the top-level page — `page.locator(...)` never finds them, only the grid frame's own locator does; (2) checking two grid row checkboxes back-to-back with no pause raced the grid's selection-tracking observable, so the Actions menu's click-time validation saw a stale count and fired the "must select TWO records" error even though the DOM showed both boxes checked moments later — a short settle wait between the two checks fixed it. None of the dialog buttons (Yes/No, Save to ROBAR/Exit) have ids, only Download Redline is a plain `<a class="linkClass">`. `ROBAR_Tests/tests/Label-Control/Redline_Compare.spec.ts` drives two fresh items (no Label Master) through the full Create-Temp-Master → PDF-compare → Exit flow entirely headless — 3 consecutive clean runs, ~2.3-2.4 minutes each. **Master vs Sample is decided by SELECTION ORDER, not LCN size (live-confirmed 2026-10-02 on VAL703, UAT_6151):** the FIRST-checked row is the Master (left panel `#divLabelMaster`) and the SECOND-checked row is the Sample (right panel `#divLabelSample`) -- `GetLCNForRedline` returns `MasterLCN`/`SampleLCN` in that order. (The earlier "smaller LCN on the left" note only held because both TST runs happened to check the older record first.) Each panel prints `LCN`, `Item Number`/`Item Ver`/`Label Type`, `Master Data Ver` (`N/A` when the record has no linked Master Data version, e.g. an Unapproved MD record) and `Template`/`Template Ver`. The rendered redline PDF also shows the sharename values (a `m_description` object printed the Master Data record's description, `S_TVer` printed the template version). |
| 7 | Compare With Prior | ✅ Working, **confirmed live end-to-end 2026-10-02 (no-prior-LCN error path only); permanent Playwright spec** | Also needs 2 selected records (page shows `Selected Records: 2`). Unlike Redline Compare, this is a full Job Submission → e-signature → async Job Detail flow (`Allow use of Temporary Master`, `Save Redline to Folder` checkboxes). Per-record results are independent — one record can succeed (`"Prior LCN: LCN0000328"`) while another correctly errors (`"Could not complete comparison. Prior LCN record not found."`) if it has no prior LCN. **Live-confirmed:** action `#actRedlineCompareWithPrior`, route `Redline/JobSubmission`→`Redline/SubmitJob`→`Redline/JobDetail` (same `Innovatum.Pages.LabelControl.Redline.MVC` project as Redline Compare, different flow). Real ids: `#allowTempLabelMaster`, `#saveToFolder` (reveals `#saveSubfolder`, `#doNotSaveToDb`), `#txtJobDescription`, shared signature ids. **Submit is a plain `<button>` with NO id** (`data-bind="click: submitClick, disabled: !viewModel.isValid()"`) — a third Submit pattern after `#submitBtn` and `#SubmitButton`; target by data-bind, it stays disabled until description + signature are filled. Two fresh items with no prior LCN both fail with the message above, job `Status: CompletedWithErrors`. `ROBAR_Tests/tests/Label-Control/Compare_With_Prior.spec.ts` — 3 consecutive clean runs, ~2.4-2.5 minutes each. The success branch (`"Prior LCN: ..."`, `Save Redline to Folder`) needs a record with a real prior LCN, not yet set up. **Success path now covered (2026-10-02): `ROBAR_Tests/tests/Label-Control/Compare_With_Prior_Success.spec.ts`** (TST703, no BarTender; 3 consecutive clean runs, ~2.0-2.1 min each). A "prior LCN" comes from an item with two VERSIONS, each with its own LCN: create + approve an item, Item Edit > Actions > Save As New Version (jumps to version 1), approve that too. The Label Control grid then lists one row per item version, and ONE Assign Control Number job over both rows gives each version an LCN (its Job Detail table carries the version column: LCN, item, label type, version, status, message). Compare With Prior over both rows with `Allow use of Temporary Master` ticked: the version-1 record reports `Completed` with message `Prior LCN: <v0's LCN>`, the version-0 record reports `Error` with `Could not complete comparison. Prior LCN record not found.`, and the job ends `CompletedWithErrors`. Because "do not save to ROBAR" is unchecked by default, the successful comparison is stored against version 1: afterwards only that record appears under the `With Attachments` filter. Gotcha: `cm.openCampaignManager` (support/campaign-manager.ts) logs in itself -- calling `login()` first makes the second `goto` land on an already-logged-in page where `.userID` never appears, and the test stalls for its whole timeout. |
| 8 | Change Report | ✅ Working, **confirmed live end-to-end 2026-10-02 (default success path AND all options); two permanent Playwright specs** | **Options, live-confirmed 2026-10-02 (`Change_Report_Options.spec.ts`, 3/3 clean, ~11 min each, no BarTender; two-version item, Recreate Master on v1, jobs on v1, files read back via the row-level Attachments action's Link Management grid `#grdControl`):** CDR Only -> one `ChangeDocumentReport_<LCN>.pdf` linked; `Do Not Recreate If Already Exists` (`#recreateIfAlreadyExistsCheckbox`) on a record that already has the file -> job Completed, NO new attachment; the same job without the box -> a SECOND same-named file is added (nothing is replaced); Grouped Master Only -> `GroupedMaster_<item number>.pdf` (note: item number, not LCN); Both -> `GroupedMasterWithCDR_<item number>.pdf` (the merged file; it does not remove the others). `Save to Folder` (`#saveToFolder`, shows `#folderSelectDiv`) with an empty `#saveSubfolder` is blocked CLIENT-SIDE with `"SubFolder is required."` in `#subFolderError` (no request sent); with a sub folder the file lands at `\\<server>\Network\CDR\<subfolder>\ChangeDocumentReport_<LCN>.pdf` (default `CDRFileLocation`; readable from the test machine as `//VMSRVTST703/Network/CDR/...`, other people's folders already live there so delete only your own); with `Do Not Save CDR to ROBAR` (`#doNotSaveToDb`) also ticked nothing new is linked. `Link to Prior` (`#linkToPrior`) links the newly created file to the PRIOR version's LCN as well (v0's Attachments list goes from empty to that file). `Link to Prior` / `Save to Folder` are hidden unless the user holds `LC_CDR_LinkToPrior` / `LC_CDR_SaveToFolder`; `mbuser1` holds both, so no security changes were needed. Grouped Master generation works on TST703 with A1SuperTemplate items. Original notes: **Live-confirmed:** the controller is `CDR` (project `Innovatum.Pages.LabelControl.ChangeDocumentReport.MVC`), action `#actChangeDocumentReport`, route `CDR/JobSubmission`→`CDR/SubmitJob`→`CDR/JobDetail`. Standard job flow with an e-signature, Submit is `#submitBtn`, Reason Code is `General` (unlike Recreate Master's `DataLoad`), Job Detail uses `Status:` WITH a colon. Ids: radios `#cdrOnlyRadio` (default)/`#groupMasterOnlyRadio`/`#bothRadio`, `#recreateIfAlreadyExistsCheckbox` ("Do Not Recreate If Already Exists"), `#linkToPrior` and `#saveToFolder` (both hidden unless the user holds the matching permission; visible for MBUser1), `#saveSubfolder`, `#doNotSaveToDb`, `#txtJobDescription`. With defaults the report is saved to ROBAR: afterwards the item shows under the "With Attachments" filter (a fresh item does not), which is the spec's verification. `ROBAR_Tests/tests/Label-Control/Change_Report.spec.ts` (builds its own Label Master via Recreate Master first) — 3 consecutive clean runs, ~2.6-2.7 minutes each. Not yet live-exercised: Grouped Master Only / Grouped Master with CDR, Link to prior LCN, Save to Folder. Original notes: `CDR Only`/`Grouped Master Only`/`Grouped Master with CDR` radio + `Do Not Recreate If Already Exists`/`Link to prior LCN`/`Save to Folder` checkboxes. Correctly errors with `"No masters exist for select..."` when the record has no Label Master. |
| 9 | Recreate Master | ✅ Working, **confirmed live end-to-end 2026-10-02 (success path); permanent Playwright spec** | **This is the action that CREATES a Label Master for a record** — live-confirmed: an item moves from "Without Label Master" to "With Label Master" after a successful run, which unlocks Export Master, Change Report, and the success branches of Link to Label Master / Compare With Prior. Route `RecreateMaster/JobSubmission`→`SubmitJob`→`JobDetail` (project `Innovatum.Pages.LabelControl.RecreateMaster.MVC`); no option fields, just job description + signature. **Gotchas:** Submit is `#btnSubmit` (a fourth Submit pattern); the Reason Code list holds ONLY `DataLoad`, not `General`; and this page's Job Detail prints `Status<tab>Completed` with NO colon, unlike the other actions' `Status:`. `ROBAR_Tests/tests/Label-Control/Recreate_Master.spec.ts` — 3 consecutive clean runs, ~1.8 minutes each. Also correctly blocks with `"One or more LCN(s) submitted to the job is associated with unapproved Item Version, Template Version or Master Data Version."` (with a working `Details` link) when the underlying data isn't approved — matches `LC_RecreateMaster+ExportMaster` step 1.31 verbatim. |
| 10 | Export Master | ✅ Working (share output); **⚠️ Download link looks broken** — confirmed live 2026-10-02 (success path, file verified on the share; Merge covered by `Export_Master_Merge.spec.ts`, 3/3 clean, ~2.6 min, no BarTender) | **Merge, live-confirmed 2026-10-02 (two-version item, one Assign job, one Recreate Master job over both rows, then two Export jobs over both records):** WITHOUT `#ckbMerge` (default unchecked) the folder gets one PDF per record named `<LCN>_<ItemNumber>_<LabelType>_<ItemVersion>.pdf` (~550KB each); WITH it the folder gets exactly ONE `ExportedMasters_<yyyyMMdd_HHmmss>.pdf` (~1.1MB = roughly the sum, larger than either single master) and no per-record files. **Observed defect candidate:** the Job Detail page's Download link (`ExportMaster/DownloadFile/<jobId>`) answers HTTP 200 with an EMPTY body (0 bytes, no content-type, no content-disposition) for BOTH the no-merge job (should be `<path>.zip`) and the merge job (should be `<path>.pdf`), and a real click on it produces no browser download. Code path: controller `DownloadFile` returns `EmptyResult` when `GetDownload` throws/`Success=false` ("Job file not found for JobID"); the service stores results in table `FileDataB` (`UploadResults(jobId + ".zip"/".pdf")`) and `FileData` maps to the same table, so the cause is not obvious from source — not diagnosed beyond that (no DB/server-log access); also possible it is environment-specific to TST703. The spec asserts the share files firmly and only logs the download, with a `known-issue` annotation. Original notes: `Job Description`, `Path`, `Merge` checkbox. **Live-confirmed:** needs a record with a real Label Master (run Recreate Master first). Route `ExportMaster/JobSubmission`→`SubmitJob`→`JobDetail` (project `Innovatum.Pages.LabelControl.ExportMaster.MVC`); **NO e-signature**; ids `#txtJobDescription`, `#txtPath`, `#ckbMerge`, Submit `#btnSubmit`. The Path is a SUBFOLDER name resolved under `\\VMSRVTST703\Network\ExportMaster\` (the resolved path is printed on Job Detail); the job writes one PDF per record named `<LCN>_<ItemNumber>_<LabelType>_<ItemVersion>.pdf` (~550KB for a fresh item) — verified by reading the share directly, since a job can report Completed without writing anything. Job Detail has NO per-record grid, just the header, the resolved path, and a `Download` link (`ExportMaster/DownloadFile/<jobId>`); `Status` has no colon (same as Recreate Master). `ROBAR_Tests/tests/Label-Control/Export_Master.spec.ts` (builds its own Label Master via Recreate Master first, then deletes only its own unique export folder) — 3 consecutive clean runs, ~2.2-2.3 minutes each. Intermittent: right after Recreate Master the "With Label Master" query occasionally returned "No records to view" once and showed the row on retry, so the spec retries. Also correctly errors with `"Not all records are associated with Label Master. Label Master Key column is blank."` when appropriate. |

### Live exploration findings, 2026-09-30 (first-ever Playwright/hands-on pass -- prior coverage was
entirely formal-script/code-review, this module had zero Playwright tests before this)

**This TST703 environment started with ZERO Label Control records, system-wide** — confirmed via
an intentionally unfiltered retrieve (all three of `#drpApproved`/`#drpAttachments`/
`#drpLabelMaster` at their neutral "All"/"Any"/"Any" values). Root-caused via source (a subagent
investigation, not guessing): `LabelControl` has no DB-level FK/trigger tying it to Items/Campaign
Manager (`LabelControlTable.cs`: `ForeignKeys = null`) — creation is pure application code, and the
only paths that insert a row are (a) a `GenerateLabelControl()` print-time path gated by the
`AutoCreateLabelControl` GlobalSetting, which ships `N` everywhere it's checked (`Innovatum.Web`,
`MultiDocument.Printing.WCF`, `CampaignManager.Plugin.WorkFlowSendTo.WCF`), or (b) the **"Assign
Control Number" bulk action itself**, via a completely separate module (`Innovatum.Pages.
LabelControl.MassAssign.MVC/WCF`) that constructs a `LabelControlEntry` with a real counter-issued
`LCN` value (from a `CountersClient` reading the `LabelControlCounterName` GlobalSetting) and saves
it directly, with no gating setting at all. **Plain Campaign Manager Item approval does NOT create
a Label Control row** — confirmed both via this source trace and live (several Items approved
earlier in this same session never appeared in this grid, even unfiltered). Once retrieved
correctly, this TST703 DB actually has ~500 Item rows available via Label Control's own grid
(most with blank LCN, e.g. `MIBIGIMPORT*`-prefixed items — evidently leftover bulk-import test
data — plus a handful already assigned, e.g. `LCN0000336`/`LCN0000073`) — plenty of real test data
to use, not an empty environment requiring manual seeding.

**The SAME filter-scope gotcha already documented in "WebMenu-wide issues" bit this module too, a
second time in the same day** — `#drpLabelMaster` defaulted to (or was left at) `"With Label
Master"` rather than the neutral `"Any (Label Masters)"`, silently excluding every item without one
yet (i.e. exactly the ones "Assign Control Number" is meant to be tested against). Confirmed this
is genuinely a live, resettable `<select>` (not Knockout-object-bound like Template Management's
`#drpApprove` — plain `selectOption({label: ...})` works directly): `#drpApproved` → `"All (LCN
Status)"`, `#drpAttachments` → `"Any (Attachments)"`, `#drpLabelMaster` → `"Any (Label Masters)"`.
**Always explicitly set all three before trusting a retrieve result in this module too**, not just
Template Management/Campaign Manager.

**A genuine page-breaking JS crash reproduces if the filter dropdowns are touched too soon after
navigating here** — confirmed live: `"Javascript is not functioning properly" / Error:
labelControlField.caption is not a function / ...LabelControl/Management...Line: 579`, blanking the
whole grid area (0 rows even unfiltered) until the page is reloaded/renavigated. Root cause not
fully isolated, but reliably avoided by waiting for `frame.waitForLoadState('networkidle')` **plus**
an explicit ~3s settle pause before interacting with `#drpApproved`/`#drpAttachments`/
`#drpLabelMaster` or the criteria filter row — the Knockout view-model backing this page's
`labelControlField` column-caption logic evidently isn't fully initialized the instant the iframe
looks "loaded." A ~1.5s wait (enough for every other module explored this session) was NOT enough
here at least twice.

**The `MassAssign/JobSubmission` e-signature form's Reason Code is a genuinely required field with
no pre-selected default** (`#sigReason`, options `"Select Reason"`/`"General"`, starts on `"Select
Reason"`) — omitting it blocks Submit client-side with `"Reason is required."` and the request never
fires at all (confirmed: `page.waitForResponse` on `MassAssign/SubmitJob` times out completely, not
a fast rejection) — easy to miss since every OTHER field (Description, User/Password/Comment)
accepts a plain `.fill()` with no special handling needed. Full confirmed field map:
`#txtJobDescription`, `#sigUser`, `#sigPassword`, `#sigReason` (select, must pick `"General"`),
`#sigComments`, `#submitBtn`.

**Full live round trip confirmed working end-to-end**: selected a real blank-LCN item
(`MIBIGIMPORT16461`) → Bulk Actions → Assign Control Number → `MassAssign/JobSubmission` showed
`"Starting Control Number: LCN0000341"` as a preview → filled Description/signature/Reason Code →
Submit → `SubmitJob` returned `{Success: true, JobDetailUrl: "/InnoPages/MassAssign/JobDetail?
jobId=..."}` → Job Detail page showed `Status: Submitted`, `Percent Complete: 0%` (a real async job,
not instant — the per-record grid already said `"Inserted"` at this point, which describes the
queue/staging insert, not the final LCN assignment) → re-retrieving the Label Control grid shortly
after confirmed the item now shows **`LCN0000341`**, exactly matching the earlier preview.

**Filter ROWS, not just the scope dropdowns, are also saved server-side and persist across runs
(2026-10-01)** — a third, distinct instance of the filter-scope-reset family of gotchas
(`feedback_filter_scope_reset.md`). No Column/Operator/Value filter row exists on a fresh page
load at all (just the three scope dropdowns + an "Add Filter" link); clicking "Add Filter"
(`.criteriaFilter-AddButton`'s inner text `<span>` specifically — the click handler is bound only
to that span, not the outer container or its sibling icon span, both of which render identical
"Add Filter" text) creates one. But `Management.cshtml`'s `resetFilters()`/`saveDefaultFilters()`
persist whatever filter rows exist to this account's own "default" filter set in the DB, and they
reload on the next page visit — **including from an entirely separate test run**, not just within
one session. A stale blank row left over from an earlier failed attempt (all rows AND together)
silently zeroed out every result from an otherwise-correct `ExactlyMatches` query on a brand new
item, reproducing exactly the same failure shape as a bad scope-dropdown value. Fix: click
`#btnReset` (which clears the saved set and reloads the page) before adding a fresh filter row,
every time — not only when a previous row is suspected. See
`ROBAR_Tests/tests/Label-Control/Assign_Control_Number.spec.ts` for the working sequence.

### Security-gated Bulk Actions: the disabled+tooltip mechanism is confirmed correct (resolved 2026-10-01)
**Redline Compare, Compare With Prior, Change Report, Recreate Master, and Export Master all
require dedicated security processes** (`LC_RedlineCompare`/`LC_RedlineCompare_Link`,
`LC_RecreateMaster`, `LC_ExportMaster`, and the Change Report/Compare-With-Prior equivalents).
Earlier in this engagement, **MBUser1 was missing all five of these processes simultaneously**,
and clicking any of the 5 Bulk Actions produced zero observable effect — no navigation, no dialog,
no error — while the menu item rendered identically to an enabled one. That was logged as an open
question: was the disabled+tooltip rendering itself broken, or was it something specific to
missing all five processes at once?

**Live-confirmed answer, using MBUser2 (group `MBSomeSecurity`, the module's own dedicated
negative-permission fixture — not MBUser1) with each of the five processes individually disabled
one at a time:** the disabled+tooltip mechanism works correctly for every single one. The rendered
`<li>` for each carries the right data exactly as designed —
`data-bind="menuDisable: true, processName: '<ProcessName>'"` and
`title="Not authorized for this action <ProcessName>"` — and the inner `<a>` is styled
`color: rgb(204,204,204)` (greyed) with `pointer-events: none`, which is this app's actual disabled
mechanism (no `disabled` attribute or `ui-state-disabled` class is used here — don't grep for
those when checking this pattern elsewhere in the module). `pointer-events: none` means a real
user physically cannot click it; a Playwright `force: true` click bypasses that and still "works,"
which is why an earlier pass through this investigation misread a forced click's no-effect as a
"silent no-op" — it isn't one, it's confirmation the element is correctly unclickable.

**Conclusion: this is not a defect.** The MBUser1 incident was specific to that account missing
all five processes at once (cause not independently determined, likely unrelated to this
rendering path) — it does not reproduce for a user missing only one process while having
everything else, which is the realistic scenario the formal scripts actually test. Full earlier
retest detail (now superseded by this live-confirmed answer): `.agents/exploratory-session-log-
label-control.md` (Finding 1 / Retest Addendum).

### Out-of-scope items this session
`LC_MassUpdateVersions` sections 2-3 and `LC_RecreateMaster+ExportMaster` section 4 (both need the
`LabelControl_MasterDataMustExist`/`LC_MDM_Integration` GlobalSettings + RDP/IISRESET).
`LC_LabelTypeSecurity` scenarios were not independently re-verified against MBUser1's actual
current label-type grants. (`LC_RedlineCompare`/`LC_CompareWithPrior` full PDF-generation was
originally assumed to need additional GlobalSettings and was flagged out of scope — that assumption
was wrong; both work correctly in this environment as-is, see the retest above.)

### Code-verified findings (2026-09-25, while writing UATs)

Cross-checked all 12 scripts under `Label_Control\7.0.4\` against the actual code: LC_LabelTypeSecurity,
LC_Attachments, LC_LinktoLabelMaster, LC_UpdateVersions, LC_MassUpdateVersions (+ its "-1.2"
companion), LC_AssignControlNumbers, LC_ManageProductionAvailability, LC_RedlineCompare,
LC_CompareWithPrior, LC_RecreateMaster+ExportMaster, LC_ChangeDocumentReport.

**Universal tooltip pattern.** Every disabled row/bulk action across Label Control renders its
tooltip as `errActionNotAuthorized` ("Not authorized for this action") **with the raw security
process name appended after a space** — e.g. "Not authorized for this action LC_Update_Versions".
The formal scripts consistently quote only the base phrase. One exception: "Action disabled for
records with no Label Control Number" (`errNoControlNumber`-adjacent resource) renders with no
process name appended.

**Security processes confirmed, one per action:**
- View: `LC_View_LabelControl`. Label type view security: `LT_<LabelType>` per type.
- Attachments row action: gated by `LM_View_LinkManagement` (not a Label-Control-specific process).
- Link to Label Master: `LC_LinkToLabelMaster`.
- Update Versions (row) / Mass Update Versions (bulk): both gated by the **same** process,
  `LC_Update_Versions`. Released-record override needs `LC_Update_ReleasedLCN` (named in the Mass
  Update Versions message, not separately tested by the row-level script).
- Assign Control Number: `LC_Assign_LabelControl`.
- Manage Production Availability: `LC_Manage_ProdAvail`.
- Redline Compare: `LC_RedlineCompare` (compare/generate) + `LC_RedlineCompare_Link` (Save to
  ROBAR). **The Save to ROBAR button's enabled state depends only on `LC_RedlineCompare_Link`, not
  on whether a temporary or real label master was used** — the formal script's test data
  conflates the two (its unauthorized user also always happens to hit the temp-master path), so it
  never actually isolates which one gates the button.
- Compare With Prior: `LC_RedlineCompare_Link` (same process as Redline Compare's save step, not a
  separate "Compare With Prior" process).
- Recreate Master: `LC_RecreateMaster`, plus `LC_Update_ReleasedLCN` and
  `LC_CreateUnapprovedMaster` gating released/unapproved records.
- Export Master: `LC_ExportMaster` — **a completely separate action with no signature fields at
  all** (just Description, Path, Merge?), unlike every other action in this module.
- Change Report (CDR): `LC_CDR_Link`, plus `LC_CDR_LinkToPrior` and `LC_CDR_SaveToFolder` gating
  those two checkboxes independently.

**Message-text corrections found:**
- Label type security banner: "Some search results **are** not displayed due to label type
  security." (own Label Control resource, text identical to Campaign Manager's but a separate
  resource file).
- Link to Label Master has **three** distinct "could not link" messages depending on match state,
  not two: no candidate at all ("...or latest label master record not found"), a non-exact
  candidate with Use Latest unchecked ("...Matching label master record not found." — no "or
  latest"), and already-linked ("This record is already linked to a label master").
- Mass Update Versions message wording differs from the script in several places: "Could not
  update Master Data version, no latest approved found." / "Could not update Item version, no
  latest version found." (comma, no "because") / "Cannot Update Version for Released Records
  without security process LC_Update_ReleasedLCN" (singular "Version", names the process).
- Manage Production Availability's date-order message is actually "Effective end date must be
  greater than effective begin" (lowercase, no period) — the script capitalizes it.
- Compare With Prior's required-description message is "Job Description is required." (script
  drops "Job"). Its Codes seed Description text is "Redline Comparison File Purpose", not
  "Redline Compare".
- Redline Compare's `PDFCompressionPercent` default is 50 (script's setup says 30); Compare With
  Prior's `CancelAfterFailureCount` default is 999 (script says 3).
- Change Document Report's `CDRFileNameTemplate_*` settings use the `<ItemNumber>` token, not
  `<LCN>` as the script's setup states. `CDRFilePurpose_GroupedMasterWithCDR` default value is
  "Grouped Master with CDR" (with spaces), not "GroupedMasterwithCDR".

### Double-confirmation of the code-verified findings against the actual `.doc` text (2026-09-30)
Directly read all 12 scripts the 2026-09-25 code-verified pass covered (`LC_LabelTypeSecurity`,
`LC_Attachments`, `LC_LinktoLabelMaster`, `LC_UpdateVersions`, `LC_MassUpdateVersions` + its "-1.2"
companion, `LC_AssignControlNumbers`, `LC_ManageProductionAvailability`, `LC_RedlineCompare`,
`LC_CompareWithPrior`, `LC_RecreateMaster+ExportMaster`, `LC_ChangeDocumentReport`), from the actual
`Label_Control\7.0.3\` share (the same version already fully read for this module, not the `7.0.4`
folder the code-verified pass used — see the version-drift note below). **Unlike the equivalent
Campaign Manager exercise, this one came back almost entirely CONFIRMATORY — no real contradictions
found.** Specifically checked and matched exactly: the label-type-security banner text (with
"are"), the "already linked"/"or latest" Link to Label Master messages, the `PDFCompressionPercent`/
`CancelAfterFailureCount` script-says-30/3-vs-real-30/999 framing, the "Description is required."
(script drops "Job") framing, and the `CDRFileNameTemplate_*`/`<LCN>` token + `GroupedMasterwithCDR`
(no-spaces) script-setup framing — every one of these held up on direct read exactly as the
code-verified note already described them.

Two genuinely new items, not contradictions:
- **Link to Label Master's claimed THIRD message variant** (`"...Matching label master record not
  found."` — no "or latest", for a non-exact candidate with Use Latest unchecked) **could not be
  confirmed from this script's own text** — `LC_LinktoLabelMaster.doc` only exercises the other two
  variants (no-candidate-at-all, and already-linked). Not a contradiction (code inspection can find
  a real branch a script simply doesn't test), just unconfirmed by this source — would need a live
  check with that specific match-state to settle. **Settled 2026-10-02: confirmed live** (v1 record,
  only v0 has a Label Master, Use Latest unchecked) — see Bulk Actions row 5.
- **A new exact message, not previously documented**: Redline Compare's 2-record requirement
  produces `"Please submit TWO label control records to the Redline Compare bulk action"` (capital
  TWO) when only one record is selected — the existing note only described the requirement, not the
  literal text.

**Version-drift note**: `Label_Control\7.0.4\` contains one script `7.0.3\` does not —
`LC_ExportToExcel.docx` — a genuinely unread script, not yet reflected in this module's "all 15
scripts" formal-read count (that count is accurate for `7.0.3` specifically). Worth reading if a
future session needs full Label Control coverage against whatever version the project-of-the-moment
actually runs, or checking whether an Export to Excel action exists at all in this 7.0.3 codebase's
Label Control screen before assuming it applies here.

---

