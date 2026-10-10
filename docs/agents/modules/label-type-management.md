<!-- Split from robar-module-reference.md on 2026-10-09 (lossless, original order kept; later blocks are newer and win over earlier ones). Module file: label-type-management -->

## Label Type Management

**Purpose:** Create and maintain Label Type records (`LabelType`/`Description`/`FileExtension`/
`FilePurpose`) — the foundational entity every other module's `LT_<LabelType>` security gating and
label-type-scoped behavior (MDM, Campaign Manager, Label Control, Field Defs Management, etc.) is
actually keyed off of. Creating a Label Type here is the origin point of that whole `LT_*` security
convention seen throughout the rest of the app.

**Formal scripts reviewed:** all 4 scripts under `Label_Type_Management\6.0.7_and_up\` (the current
version — the top-level, unversioned folder is missing `LT_BasicFunctions_Actions-1.3.doc` and is
therefore stale/incomplete for this build): `LT_Management-1.doc` (test-plan index),
`LT_Management-1.1.doc`, `LT_Management-1.2.doc`, `LT_BasicFunctions_Actions-1.3.doc`. Read fully
2026-09-30.

### Security: two independent processes, gating differently
- **`View_LabelTypes`** gates whether the module's own tile appears on the Main Menu at all —
  missing it, the tile is absent entirely (same "not just disabled, not rendered" pattern as most
  other modules' view-gates), confirmed live via a user with every OTHER process enabled.
- **`Web_LabelTypes`** gates edit access specifically — present without it, the module opens and the
  grid/filter/Actions dropdown all work, but the `+` (add) and pencil (edit) icons stay disabled;
  only the `+`-icon-adjacent read-only "paper" (view) icon remains usable. A user with only
  `View_LabelTypes` sees a fully read-only module.

### Layout and row actions
Standard shared filter widget (Column/Operator/Value + `+Add Filter`, ANDed/ORed rows), `Retrieve
Data`, an `Actions` dropdown, and a `Limit Results` textbox defaulting to **1000** (much higher than
most other modules' typical 500). Grid columns: `Label Type`, `Description`, `FileExtension`,
`FilePurpose`. Row-level icons: paper (view, read-only popup), `+` (add new), pencil (edit), trash
(delete) — `+`/pencil need `Web_LabelTypes`; a row must be selected before pencil/trash enable.

- **View Record dialog**: every field disabled (LabelType, FileExtension, Description, FilePurpose),
  just a Close button — a genuinely read-only popup, not a disabled-but-technically-editable form.
- **Edit Record dialog**: only `Description` is actually editable — `LabelType`, `FileExtension`, and
  `FilePurpose` are ALL disabled/locked once a record exists. A Label Type's structural identity is
  permanent after creation; only its description can change.
- **Add Record dialog**: all four fields enabled, plus Submit/Cancel.

### The FileExtension ↔ FilePurpose validation rule (exact messages)
A real, easy-to-miss business rule confirmed via both directions:
- `FileExtension = ".btw"` **requires** `FilePurpose` to be blank — submitting with any FilePurpose
  value selected blocks with `"File Purpose value must be blank if file extension is .btw."`
- Any OTHER `FileExtension` (e.g. `.docx`) **requires** `FilePurpose` to be non-blank — submitting
  with it left blank blocks with `"File Purpose value cannot be blank if file extension is not
  .btw."` This applies identically whether the record is created via the UI Add dialog or via Excel
  Import (see below) — an imported row failing this rule presumably surfaces the same validation
  language in that flow's own error grid, though the exact per-row Excel-Import error text for this
  specific rule wasn't directly observed in this script.
- Duplicate `LabelType` value (case-sensitivity not tested) blocks with the generic
  `"Record already exists."`

### Auto-provisioned security process on every new Label Type (confirmed via live DB query in the script)
Creating a Label Type (either via the Add dialog or Excel Import) **immediately inserts a new
`LT_<LabelType>` security process** into the `Security`/`Processes` tables, enabled by default for
**every existing Group AND every individual ungrouped User** — not left unauthorized-by-default the
way a brand-new process in most systems would be. Audit trail: `X_Security`/`X_Processes` both show
a `ChangeType = 'A'` (Add) row for the new process at creation time. Editing an existing record's
Description produces a `LabelTypes`/`X_LabelTypes` change row with `ChangeType = 'C'` (Change).

### Actions dropdown (page-level, distinct from row actions)
- **Excel Export**: `File Name` field + `Limit Results (1000)` / `All Filtered Records` radio +
  Submit — standard async-job pattern (`"Percent Complete: 100%"` message + download link once
  done), exports whatever's currently in the grid (respecting the active filter if "All Filtered
  Records" is chosen).
- **Adjust Page Size**: `Default Grid Count` dropdown (10/30/etc.), `Wider`/`Narrower` buttons, an
  `Auto Fit` button, and Submit — changes the grid's own column width AND its row-count-per-page
  persistently (confirmed: survives a subsequent Retrieve Data). A genuinely different mechanism
  from the shared `Limit Results` textbox above it.
- **Save Search / Load Search**: same shared pattern as MDM/Campaign Manager/Template Management —
  `Overwrite` (disabled unless a previously-saved search is the CURRENTLY loaded one; enables once
  one is) / `Save As New` (default) radios, `Name`+`Description` textboxes (**both** required —
  `"Name and Description are required."` blocks if either is blank, confirmed for each independently
  missing), `Public` checkbox. A non-public saved search is invisible to other users' own Load
  Search grid (confirmed: U02 couldn't see U01's non-public search from step 2.33). Deleting a
  search you don't own blocks with `"Unable to delete filters belonging to other users"` even though
  the trash icon itself renders enabled in that grid (a silent-permission-check-on-submit pattern,
  not a disabled-icon one). Deleting your own confirms with `"Delete selected record(s)?"` first.
- **Excel Import**: gated by its own security process — missing it, the menu item simply doesn't
  render in the Actions dropdown at all (not present, not disabled). `Download Template` gives a
  spreadsheet with exact column headers `LabelType`/`FileExtension`/`Description`/`FilePurpose`;
  Validate → Submit → an async Job Detail grid (`Status: Completed`, `Percent Complete: 100%`). A
  Label Type created this way auto-provisions its own `LT_<LabelType>` security process identically
  to the UI-created path. Audit: import jobs tracked in `DynamicUIImportJobs`, export jobs in
  `DynamicUIExportJobs` (both by `JobID`).

---

### Playwright-confirmed 2026-10-04 (`tests/Label-Type-Management/`: `Label_Type_Management`, `Label_Type_Actions`, `Security_Gating`, all 3/3; helpers `tests/support/dynamic-ui.ts`)
Run as Claude01 (admin) + the MB fixtures for security. **Nothing is ever created or deleted**: a new Label Type auto-provisions `LT_<name>` ENABLED for every group/user (incl. non-MB) and Label Types **cannot be deleted** at all — the DynamicUI definition is seeded `CanDelete = "N"` (the trash icon is permanently disabled, whatever the user holds). Only the Description of the MB fixture `MBLT1` is edited (restored).
- **It is a DynamicUI page** (`InnoPages/DynamicUI/DynamicUI?Heading=Label_Type_Management&Definition=LabelTypes`). The DynamicUI framework hosts 13 seeded definitions (view / add / edit / delete / import process in the DB, `Innovatum.Install/ROBARDB/BaseProductTables/DynamicUIHeader`): `Facilities` (Web_Facility_Management, all Y), `GlobalSettings` (GlobalSettings_Management; add Y, edit/delete N), `PrintConfig` (PrintConfig_Management), `PrinterControl` (Web_Printer_Control), `PrintHistory` (PrintHist_Login), `Lots` (LE_View/Add/Chg/Del_Lots, EI_Lots), `Dashboards`/`DashboardsLink`, `Notifications`/`NotificationsLink`, `PrinterUserCommands`, `AlternatePrintFileControl` (APFC_*), `LabelTypes` (View_LabelTypes / Web_LabelTypes). Same grid/dialog mechanics everywhere.
- **Page anatomy:** Actions `#drpMainActions`: Excel Import `#actExcelImport`, Excel Export `#actExcelExport`, Audit `#actAuditView`, Save Search `#actSaveFilter`, Load Search `#actLoadFilter`, Adjust Page Size `#actAdjustPageSize`; criteria widget `dvFilters[0].*` (**operator `<option>` values are indexes 0-9 — select by LABEL**: Contains, Does Not Match, Does Not Contain, In, Not In, Greater Than, Less Than, Exactly Matches, Is Blank, Is Not Blank); `#btnRetrieveData`, `#resultLimitTxt` (1000); grid `#grdJqGrid` (columns ID, LabelType, FileExtension, Description, FilePurpose; pager `#grdPager`), nav icons `#add_/#edit_/#view_/#del_grdJqGrid`. **The filter row persists per user — only add a row when none exists** (a second blank row ANDs and empties the grid). Loading a saved search puts its criteria in row index **1**. Fixtures: `MBCustom .btw`, `MBDOCX .docx test Label Requests`, `MBINDD .indd test Label Requests`, `MBLT1 .btw MBLT1`.
- **Add / Edit / View are jqGrid FORM dialogs (`.ui-jqdialog`, NOT `.ui-dialog`)**: fields `#LabelType #FileExtension #Description #FilePurpose`, `#sData` (Submit) / `#cData` (Cancel), error line = `tr.FormError / td.ui-state-error`. Add: FileExtension options `.ai .btw .docx .indd`; FilePurpose options (blank, Approvals, Change Report, IFU, Label Requests, NotificationAttachment, Print Time Redline, Redline, Redline Compare, Training Certificate, View and Vote Redline, Vision Inspection). **Required (client side): LabelType and Description** (`"Description: Field is required"`, `"LabelType: Field is required"`; FilePurpose only by rule). Server refusals, exact wording in 7.0.3.20198: `File Purpose value must be blank if File Extension is .btw`, `File Purpose value cannot be blank if File Extension is not .btw`, `Record already exists` — capitalised "File Extension" and NO trailing period (the formal script says "file extension … ." and "Record already exists."). Edit: LabelType / FileExtension / FilePurpose disabled, only Description editable (confirmed). View: read-only, Close button.
- **Actions:** Excel Export dialog (`#fileName`, radios `#limitResults` "Limit Results (1000)" default / `#unlimitedResults` "All Filtered Records", `#submitBtn`) → "Percent Complete: 100%" + Download link. Adjust Page Size (`#defaultGridCountSelect` 10/20/30, Wider/Narrower/Auto Fit/Submit): 30 shows 30 rows of a 48-row result and persists across Retrieve. Save Search (`#radNew` default, `#radExisting`+`#drpExistingSets` disabled with no saved searches, `#txtFilterSaveName`, `#txtFilterSaveDescription`, `#chkPublic`, Save; "Name and Description are required" shown INLINE, no period) / Load Search (grid Name/Owner/Description, `#filterLoadBtn`, trash → "Delete selected record(s)?" Delete/Cancel). Audit opens `DynamicUI/DynamicUIAudit?pageID=…` titled "Audit - Label Type Management". Excel Import opens `DynamicUI/ExcelImport?pageID=…` (separate page).
- **Security (live, as an MB user; `Security_Gating.spec.ts`):** no `View_LabelTypes` → no tile (even with `Web_LabelTypes`); `View_LabelTypes` only → read-only (View works; Add / Edit disabled; **Excel Import is NOT rendered** — hidden `<a>`, so read real visibility, not text); + `Web_LabelTypes` → Add, Edit, Excel Import; Delete never. Other Actions (Export, Audit, Save/Load Search, Adjust Page Size) need no extra process.
- **Tooling gotcha:** a `click().catch()` on a locator that matches nothing (e.g. a `Cancel` button the dialog does not have) crashed the page renderer ("Target crashed") — close `.ui-dialog`s with `.ui-dialog-titlebar-close`.

