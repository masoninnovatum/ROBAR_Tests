<!-- Split from robar-module-reference.md on 2026-10-09 (lossless, original order kept; later blocks are newer and win over earlier ones). Module file: master-data-management -->

## Master Data Management (MDM)

**Purpose:** Schema-driven data management for item and non-item master data records (GUDID/UDI
device identifiers, packaging structure, regulatory data, etc.) that feed into label printing.

**Formal scripts reviewed:** all 39 scripts under `MDM\7.0.3\` (24 test-case areas — see
`.agents/exploratory-session-log-master-data-management.md` for the full per-area breakdown).

### Core structure
- **Master Data Management page**: Schema dropdown (default `RobarMasterData`), Column/Operator/
  Value filter row (`+Add Filter`), `For Items` dropdown (Any/Approved/Unapproved),
  `Latest Version Only` / `Effective Only` checkboxes, `Advanced Options` (Available Fields ↔
  Selected Fields dual-list with `>>`/`<<` transfer, `Limit Results`), `Retrieve Data`/`Reset`,
  per-row `Actions` dropdown (View/Edit, View History, View Transmissions, View in GUDID).
- **Actions dropdown** (page-level): New Record, Excel Import, Save Search, Load Search, Edit
  Schema — gated respectively by `MD_Create_Records`, `MD_ExcelImport_Web`, (Save/Load Search
  ungated), `MD_Edit_Schemas`.
- **Save Search / Load Search, full read of `MDM_Actions5.1.doc` (2026-09-29) — not previously
  documented at all**: Save Search offers "Save As New" (Name + Description + a `Public` checkbox
  — public searches are visible to OTHER users' own Load Search list, confirmed live) or
  "Overwrite" (pick an existing saved search, replaces its stored filter criteria in place). Load
  Search lists saved searches in a table, select one + click Load to restore its exact
  Column/Operator/Value filter rows onto the main page. Both actions are ungated (any user).
- **Bulk Actions dropdown** (on selected rows): Mass Update, Mass Approve, Mass Retire - Unretire,
  Save as New Version, Export to Excel, Assign GTIN, Assign Labels, Trading Partner Upload, End
  Distribution — each independently security-gated (`MD_MassUpdate_Option`,
  `MD_MassApprove_Option`, `MD_MassRetireUnretire_Items`, `MD_SaveAsNew_Option` (corrected
  2026-09-29 from `MD_SaveAsNew_Version` — confirmed via `MDM_Security3.1.doc`'s own Bulk Actions
  step that this bulk version is the `_Option` process; `_Version` gates the separate single-item
  Actions-menu feature of the same display name, see "Security" below),
  `MD_ExcelExport_Option`, `MD_AssignGTIN`, `MD_AssignLabels_Option`, n/a, `MD_EndDistribution`).
- **Export to Excel, full read of `MDM_Actions5.2.doc` (2026-09-29)**: two independent toggles —
  `Export selected columns` (only Advanced Options' current Selected Fields) vs. `Export all
  columns`, and `Use MDM Column Caption` (schema field captions as headers) vs. leaving it
  unchecked (raw database column names as headers instead — confirmed live as the actual default
  behavior, a real gotcha if you expect friendly headers). Output filename is always
  `DataExport.xlsx`.
- **Quick Edit** ("Edit Selected Columns" button, separate from Bulk Actions): only shows fields
  that were in Advanced Options' Selected Fields at retrieval time — shows `"Please select at
  least one editable column in order to proceed."` if none were chosen. Dirty-state UX: editing a
  field turns its label red + shows an undo-arrow icon, enables Save/Save & Next, disables
  Previous, until saved. Navigating away with unsaved changes prompts `"Changes will be lost.
  Would you like to proceed?"`.

### Record edit mechanics
- New Record dialog: Item Number + Description → creates Version 0, Effective Begin = today,
  Effective End = **12/31/2099**, Approved By = Unapproved.
- Live inline validation on every text field: red label + undo-arrow (↺) icon appears on edit;
  Save is blocked module-wide by `"Some fields contain invalid values. Please check your
  submission and try again."` if any field is invalid. Exact per-constraint messages: `"Value is
  shorter than the minimum length for this field."`, `"Value has exceeded the maximum length for
  this field."`, `"Value does not conform to the pattern mask"`, `"This field is required."`, a
  uniqueness violation message.
- Field-level `Edit Security` / `View Security` dropdowns exist per schema field (security
  processes prefixed `MC_`, distinct namespace from the `MD_` action-level processes). Lacking
  View Security replaces the value with literal text `"(Not Authorized to View Data)"`; lacking
  Edit Security renders the field read-only but still visible.
- `Save As New Record` (single item) is gated by `MD_SaveAsNew_Record` and **disables** the menu
  item outright when missing. `Save As New Version`/`Save as New Version` (bulk) is gated by
  `MD_SaveAsNew_Version` and instead lets the click through, showing a runtime error after
  confirming — an inconsistent UX pattern worth knowing about if retested.
- Both Save-As paths respect `COMServiceMustRun` GlobalSetting: when `Y` and
  `ROBAR_CommunicationsManager` isn't running, blocks with `"The ROBAR_CommunicationsManager is
  not active, please contact IT support."` Baseline for most testing is `N` (no live dependency).

### Data Schemas (Schemas module)
- Actions → New Schema: Schema Name + `Item Schema` checkbox → auto-creates a "General" tab with
  one default field. Schema-level security process auto-generated as `SCH_"<SchemaName>"` on
  creation (Schema Level Security feature).
- Per-field config: Field Type (Short Text, Dropdown List, etc.), Caption, Share Name (must be
  unique), Sample Data, Edit/View Security dropdowns, Required/Protected/Visible checkboxes,
  Min/Max Length, Default Value, Input Mask, Database Driven (reveals a Remote System SQL box,
  populated live via a Get Data icon on the edit page), Unique.
- `Protected` = visible but disabled; `Visible` unchecked = field doesn't render at all (distinct
  from Protected). Deleting the last field in a tab leaves the tab with a red strikethrough
  caption rather than deleting the tab.
- Dropdown List fields can be **linked** to another schema's field (Dropdown Schema + Option
  Text/Value Field) — options are populated live from that other schema's actual saved data, not
  a static list.
- Tabs/fields support drag-reorder via hover-revealed handles; new tabs via a `+` next to the last
  tab, renamed via a pencil icon.

### Assign GTIN
Field to Update (Primary/Unit of Use/Package/DM/Secondary DI Number) + Packaging Code + Company
Prefix, or an alternate Source-DI-based mode via "Add Source DI Field". Overwrite warning: `"Items
in your selection already have a GTIN assigned to this field. Submitting the job will overwrite
existing GTIN values."` Blocks approved/retired items: `"Only active, unapproved items can be
submitted to the Assign GTIN bulk action..."`.

### Mass Retire - Unretire
Retire pre-selected when all-active; Unretire pre-selected (+ required Effective End Date field)
when all-inactive. Mixed active/inactive selection warns: `"You have selected both Active and
Inactive Items. If you continue, the action you select will be applied to all items."` — one
action applies to the whole batch, no split retire-some/unretire-others in one job.

### Playwright specs + live selector/behaviour findings, 2026-10-02 (`tests/Master-Data-Management/`, helpers in `tests/support/master-data.ts`)
All web-only, RobarMasterData item schema, one fresh set of records per run, 3 consecutive clean runs each unless noted.
- **Page/grid selectors:** Master Data tile must be matched by exact accessible name. Grid `#grdMasterData` (rows `tr.jqgrow`, row id = masterDataId, checkbox `#jqg_grdMasterData_<id>`, columns id / Actions / Item Number / Version Number, pager "View 1 - n of n", page sizes 10/20/30/50/100/500). Filter row 0 is always present on load: `select[name="dvFilters[0].Column"]` (values like `ItemNumber`, `Brand_Name`, `Primary_DI_Number`, `Description`), `...Operator` (Contains, DoesNotMatch, DoesNotContain, In, NotIn, GreaterThan, LessThan, ExactlyMatches, IsBlank, IsNotBlank, InExternalColumn, NotInExternalColumn), `input[name="dvFilters[0].Value"]`; `#ddlSchemas`, `#drpApproved` (For Items: Approved / Unapproved / Any / Last Version Is Approved), `#chkLatest`, `#chkEffective`, `#btnRetrieveData`, `#btnReset`, `#btnEditSelCol` (Quick Edit), Advanced Options (`#advancedOptions`, `#availableLimitColumns`/`#selectedLimitColumns`, `#btAvlToSel`/`#btSelToAvl`, `#txtResultLimit`). **The account PERSISTS For Items / Latest Version Only / Effective Only between sessions — a previous spec's "Unapproved" silently hid approved records; always set all three explicitly (the `retrieve()` helper does).** Page Actions menu `#drpMainActions` (`#actNewRecord #actExcelImport #actSaveFilters #actLoadFilters #actEditSchema`); Bulk Actions `#drpActions` (`#actMassUpdate #actMassApprove #actMassRetire #actSaveAsNew #actExportExcel #actAssignGTIN #actAssignLabels #actTradingPartnerUpload #actEndDistribution`).
- **Edit page:** Actions trigger `#drpToSelect`, items `#menuCreateNewRecord #menuSaveAsNewVersion #menuApprove #menuSaveAsNewRecord #menuRetire`/`#menuUnretire` (one or the other by active state) `#menuGetRemoteData #menuViewTransmissions`; disabled items carry `ui-state-disabled` on the `<li>` (Save as New Version is disabled until the record is approved; Approve is disabled once approved). Approve / Retire / Unretire dialogs: shared signature ids (`#sigUser #sigPassword #sigReason #sigComments`), submit `#btnApproveSubmit` / `#btnRetireSubmit` (Unretire reuses `#btnRetireSubmit` — scope to the visible dialog). Reasons: General Approval, QA Approval, RA Approval, Ready for GUDID. Approved By shows `mbuser1 - 10/2/2026`; the Effective Begin/End are datepicker INPUT values (not page text). Save As New Version confirm dialog: "Are you sure you want to create a new version from this record?" with Yes/No; opens Version 1 unapproved. Save As New Record reuses the New Item dialog (`#txtNewItemNumber` pre-filled with the current number). Clearing a required field shows "This field is required."; Save then pops "Some fields contain invalid values. Please check your submission and try again." (Continue). `Record_Lifecycle.spec.ts` ~43 s.
- **Bulk job pages** (frame URL `InnovatumMDM/MasterData<Action>/JobSubmission`, Job Detail `.../JobDetail`; Job Detail text has `Status Completed` with NO colon, then an items table incl. Active / Approved By / dates): the submit button is a `<button>` with NO type attribute and no id — find it with `getByRole('button', { name: /^Submit/ })` (a `button[type="submit"]` attribute selector never matches). Empty submit -> "This field is required." under description / user id / password / reason (client-side, no request). The Job Description box has id `#txtJobDescription` on most pages but is ID-LESS on Mass Update and End Distribution (take the Nth id-less text input).
  - **Mass Approve** (`MasterDataMassApprove`): "Items Selected: N"; Completed, records move to the Approved filter. ~53 s.
  - **Mass Update** (`MasterDataMassUpdate`): `Field To Update` select (all schema fields) + New Value control that changes with the field type (text input for Brand Name); Job Detail shows `Brand_Name → <value>`; verify with the grid filter `Brand_Name` ExactlyMatches. ~37 s.
  - **Mass Retire - Unretire** (`MasterDataMassRetire`, radios `#retireItems`/`#unretireItems`): Retire preselected for an all-active selection; Retire Job Detail shows Active `false` and Effective End = today. A MIXED selection pops "You have selected both Active and Inactive Items. If you continue, the action you select will be applied to all Items." (Continue/Cancel; capital "Items", unlike the script's lowercase) and preselects Retire. All-inactive selection preselects Unretire (no warning) with a readonly datepicker `input[id^="dp"]` (drive it with `datepicker('setDate')` + a change event); submitting without a date -> dialog "Effective End Date Required."; with 12/31/2099 the job shows Active `true`. The script's "The effective end date will be applied to all items" confirmation was NOT observed for a 2-item Unretire. ~58 s.
  - **Save as New Version** (bulk, `MasterDataSaveAsNew`): unapproved selection -> page "Items not eligible for new version: N" + a Details link and no form; approved records -> normal signed job; afterwards both versions are listed (Latest Version Only is unchecked by default). ~58 s.
  - **Assign GTIN** (`MasterDataAssignGTIN`): selects (Field to Update: Primary DI / Unit of Use DI / Package DI / DM DI / Secondary DI Number; Company Prefix: Innovatum), Packaging Code defaults `0`, `Add Source DI Field`; a successful job lists a distinct 14-digit GTIN per record (e.g. `00000000002721`) under the field's column. **The overwrite warning fires the moment a field that already holds a value is CHOSEN (not at submit)**: "Items in your selection already have a GTIN assigned to this field. Submitting the job will overwrite existing GTIN values." + `Field: md_primedi`, `Items: 2`, a Continue button, Submit disabled while it is up. An APPROVED record: the job page itself shows "Only active, unapproved items can be submitted to the Assign GTIN bulk action. Some items in your selection are approved or inactive. Please correct your submission and try again." and renders no form. ~1.0 min.
  - **End Distribution** (`MasterDataEndDistribution`): disabled field-name box (FDA UDI Distribution End Date) + readonly datepicker + `#chkNewDI` ("Prepare for new DI") + job description; reason code list is just "DataLoad". Job Detail shows `FDA_UDI_Distribution_End_Date` = the chosen date and `GUDID_Status` = "End Distribution". ~30 s.
  - **Quick Edit, live-confirmed 2026-10-04 (`Quick_Edit.spec.ts`, 3/3, ~1.6 min):** "Edit Selected Columns" `#btnEditSelCol` navigates the grid frame to `InnovatumMDM/MasterData/QuickEdit?sessionId=...&pageId=...` (header "Quick Edit", "Record N / M", a back link `a#backLink`, buttons `Previous` / `Save` / `Save & Next` / `Next` as id-less `<button>`s found by exact role name; use `mdm.fillFieldByCaption` for the selected columns). With only the default Selected Fields (Item Number, Version Number) the page STILL opens ("Record 1 / 3") but shows "Please select at least one editable column in order to proceed." (not a dialog). With extra fields selected (Advanced Options `#availableLimitColumns` -> `#btAvlToSel`) the record header (Item Number, Version, Schema, Description, Approved By, Effective Begin/End) is followed by those fields. Button state: first record — Previous, Save and Save & Next DISABLED until a field changes, Next enabled; last record — Next and Save & Next disabled, Previous enabled. Edit two records with Save & Next, leave the third alone: only the two edited records change (verified with the grid filter `Brand_Name`). Navigating (`Next`) with an unsaved change pops "Changes will be lost. Would you like to proceed?" (Yes / No). **Advanced Options' Selected Fields are PERSISTED per account like the filters** — a previous run's extra columns came back and silently changed the page; reset them (`mdm.resetSelectedColumns`) at the start. The grid frame is replaced by the QuickEdit frame, so re-resolve frames (`findFrame`) after the click; `mdm.gotoMasterData` returns to the grid.
  - **Export to Excel, re-verified 2026-10-04 — WORKS (`Export_to_Excel.spec.ts`, 3/3, ~31 s): this SUPERSEDES the older "Confirmed bug: Export to Excel silently fails (503)" notes in this section.** The bulk action opens a dialog on the grid (`Export selected columns` default / `Export all columns` radios, `#chbMDColumnCaptions` "Use MD column captions" unchecked by default, Continue/Cancel). Continue fires `GET InnovatumMDM/QueryInterface/ExportToExcel?gridSessionId=...` (200) and a `.../CheckForExcelExportFileComplete` poll (200) and a real browser download `DataExport.xlsx` arrives (zip with `xl/worksheets/sheet1.xml`, `xl/sharedStrings.xml`, ... containing the selected item numbers). The earlier 503 was probably environment/service state at the time (or fixed since) — if it returns, check whether the grid-export service/ServiceHost is healthy before filing. Workflow Management's identical-looking export has not been re-checked.
  - **Save Search / Load Search, live-confirmed 2026-10-04 (`Save_and_Load_Search.spec.ts`, 3/3, ~1.6 min):** page Actions `#drpMainActions` -> `#actSaveFilters` / `#actLoadFilters`. Save dialog: `#radExisting` + `#drpExistingSets` (Overwrite) / `#radNew` (Save As New), `#txtFilterSaveName`, `#txtFilterSaveDescription`, `#chkPublic`, a Save button (close with the title-bar X — no Cancel); empty name -> "Name is required."; a successful save closes the dialog with NO confirmation message. Load dialog: jqGrid `#grdSavedFilters` (Name / Owner / Description, 10 per page, other users' PUBLIC searches listed too — set the page size to 30 to find yours), a Load button, trash `#del_grdSavedFilters` -> "Delete selected record(s)?" -> `#dData`. **Load restores the Column/Operator/Value row AND the For Items dropdown** (unlike Label Control's Load). **Save As New with an EXISTING name silently overwrites it** (no "name already taken" message; tracker candidate). **MDM's `#btnReset` does not clear the filter row.** The cleanup deletes this account's `PWSearch*` searches.
  - **Data Retrieval filters, live-confirmed 2026-10-04 (`Data_Retrieval_Filters.spec.ts`, 3/3, ~2.1 min; four records: A v0 approved, B v0 approved + v1 unapproved, Z approved but EXPIRED, U unapproved; counts are per VERSION row):** `For Items` Any -> A0 B0 B1 U0 Z0; Approved -> A0 B0 Z0; Unapproved -> B1 U0; `Last Version Is Approved` -> A0 Z0 (items whose NEWEST version is approved — B's newest is unapproved). `Latest Version Only` (Any) -> A0 B1 U0 Z0 (the newest version of each item); **Approved + Latest Version Only -> A0 B0 Z0 (the latest APPROVED version, B shows v0)**; `Effective Only` (Any) -> A0 B0 B1 U0 (the expired record drops out); Approved + Effective Only -> A0 B0. Operators `ExactlyMatches` / `Contains` / `DoesNotMatch` behave as named on Item Number. **`Limit Results` (`#txtResultLimit`, default 500, Advanced Options) caps the retrieve — and it is PERSISTED per account like the filters and Selected Fields: a "Limit Results = 2" step silently capped every later run to two rows until it was set back.** The shared `retrieve()` helper now sets For Items, Latest, Effective AND Limit Results on every call. The grid can land its rows in stages, so read counts only after they hold steady across consecutive reads.
  - **Assign Labels / Export to Excel / Quick Edit** page structure: Assign Labels (`MasterDataAssignLabels`): `#selLabelTypes` + description + signature (reason "DataLoad"); Export to Excel opens a dialog on the grid (Export selected/all columns radios, `#chbMDColumnCaptions`, Continue/Cancel), not a page.

### Schemas module + the RobarMasterData reference configuration (live-surveyed 2026-10-04; `tests/support/schemas.ts`)
- **Reaching it:** Master Data grid -> pick a schema -> page Actions `#drpMainActions` -> `#actEditSchema` -> `InnovatumMDM/Schemas/Edit/<schemaId>` (RobarMasterData = 151, MBExploreSchema = 381, MBNonItemSchema = 311, MBNonItemschema2 = 321, MBItemSchema = 221, MBSchema-New = 211, NewNonSchemaName = 241). Page: schema selector `select[name="schemaSelector"]`, read-only "Item Schema" / "Has Data" checkboxes, Schema Name + Description inputs, tabs, one `.md-field` accordion block per field (header: caption, share name, field type, trash `.delete-field`; body: `.row-fluid` rows of `<label>` + control), "Add New Field" link, `#btnSaveSchema` / `#btnCancel`, page Actions `#actionsDropdown` -> `#actNewSchema` (dialog: Schema Name + Item Schema checkbox + Submit) / `#actExportSchema`. Field types: Short Text, Long Text, Integer, Decimal, Date, True/False, HTML, Dropdown List, Linked Item.
- **Rules from `SchemasController`:** Save can add / update / delete fields and rename the schema (`ViewName` becomes `MDM_<Name>` with spaces -> `_` and `-` -> `__`); `New` rejects a duplicate name case-insensitively; **there is NO delete-schema action**; once a schema HAS DATA its already-saved fields are locked (neither editable nor deletable) — so never create records in a fixture schema you still need to edit; renaming does NOT rename its `SCH_` security processes (code TODO, tracker candidate). Export Schema (`MD_Export_Schemas`) downloads `<name>.sql` of INSERT statements.
- **Fixtures with NO data (safe to edit):** `MBExploreSchema` (item, my own exploration leftover), `MBNonItemschema2`, `MBSchema-New`, `NewNonSchemaName`. With data (locked): MBItemSchema, MBNonItemSchema, RobarMasterData. For a non-item schema, New Record opens a blank Edit page and creates nothing until Save, so field rendering can be observed without locking the schema.
- **RobarMasterData (the primary item schema) — 125 fields, 15 tabs** (Device Id, Packaging Structure, Regulatory Data, Traceabilty and Iso Symbols, Characteristics, Storage and Handling, Sterilization Method, Additional Identifiers, GUDID Control, ALt, LCRna, MDMALna, Test, to be deleted, Group 15). Conventions: core GUDID fields use share names `md_*` (e.g. `md_primedi`, `md_brand`, `md_devcount`), custom/added ones `m_*`; label-symbol pickers `mdregimage1..9`. Types in use: Short Text, Dropdown List (THREE sources: `linkedField` to another schema's saved data — LabelerDuns/Company Name, Material, CE, Box, FDAProductCodes, GMDN, Characteristics, UOM, StorageAndHandlingType, SterilizationImages, ISO images; `staticList`; `databaseQuery`), True/False (many `Required=Y` regulatory yes/no flags), Integer, Date, Decimal, HTML. Typical constraints: `Primary DI Number` Required + min=max=14 (View/Edit security `MC_Labeling` on one of its selects); `Previous DI Number` 13-14; `FDA 510K` min=max=7 with Input Mask `K\d\d\d\d\d\d`; `Device Listing Number` max 7; `GMDN Code` max 5; `Shelf Life` / `EU Class` max 3; `Brand Name` Required max 80; `Device Count` Integer Required default 1; `Package Discontinue Date` default 12/30/2099. Protected (visible, disabled): the UUID fields, `GUDID Status`, `Transmission Sequence`, `ALt Field 5`; Protected + not Visible: `testingna1`; `Unique`: `ALt Field 8`; `Database Driven`: `ALt Field 9`, `MBShortTextdriven`; `Labeler Duns Number` is a Required linkedField with default `1234567890` (the known "default fails its own validity check" bug). **Seed defect:** "Characteristics Name 3" shares the share name `md_charname2` with Name 2 (see dit-tracker.md).

**Schemas editor behaviour, live-confirmed 2026-10-04 (`Schemas_Field_Editor.spec.ts`, ~57 s, 3/3):** Save POSTs `InnovatumMDM/Schemas/Save` and returns `{caption: newFieldId}` for added fields; an invalid field (empty caption, a **Dropdown List with no source configured**, or a **duplicate share name within the schema**) is flagged with `*` and Save is refused CLIENT-SIDE with a modal "Invalid fields highlighted or marked with '*' must be corrected." (Continue) — no request is sent. A new field defaults to share name `m_generalField0`; a Dropdown List starts in `Static List` mode (radios `staticList` / `linkedField` / `databaseQuery`) with only a `<<New Option>>` entry: select it, fill Option Text + Option Value, click the plus button (`addStaticOption` helper). New Schema dialog: empty name -> "This field is required."; a duplicate name (case-insensitive) -> popup "The entered schema name already exists." (Continue) and nothing is created; **after the "required" error the first Submit click with a valid name was swallowed (a second click sent the request)** — logged as an observation. Fixture used: `MBExploreSchema` (no data; the spec adds six fields, reloads, checks persistence, deletes them and asserts the field list is back to its baseline).

**How a field's settings behave on the Master Data Edit page, live-confirmed 2026-10-04 (`Schemas_Field_Settings_Effect.spec.ts`, ~49 s, 3/3; non-item no-data fixture `MBNonItemschema2`, whose blank New Record page creates nothing until Save — the spec never saves):** `Required` shows "This field is required." at once on a fresh record; `Min Length` 3 / `Max Length` 6 give "Value is shorter than the minimum length for this field." / "Value has exceeded the maximum length for this field."; `Input Mask` `K\d\d` with "abc" gives "Value does not conform to pattern mask" (NO "the" — differs from the script); `Default Value` pre-populates the input; `Protected` renders the input visible but disabled; `Visible` unchecked means the field is not rendered at all. **The validation messages render in page-level `.validationMessage` elements, NOT inside the field's own row.** **A field caption's tooltip (`title` on the caption `<span>`) is the field's SHARE NAME** (e.g. `title="m_pwreq123456"`) — the quickest in-UI way to see which share name a rendered field carries. Each field also has an undo-arrow button (reverts the edit) and a lock icon when the user can't edit it.

**Dropdown List option sources + Export Schema, live-confirmed 2026-10-04 (`Schemas_Dropdown_Sources_Export.spec.ts`, ~1.4 min, 3/3; fixture `MBNonItemschema2`, fields deleted afterwards).** A Dropdown List field has three mutually exclusive source modes (radios `value=staticList|linkedField|databaseQuery`, bound to `configuration().dropdown().dropdownMode`; switching modes just swaps the visible sub-form):
- **Static List** — multi-select + `<<New Option>>` (see the editor notes above). Renders on the record page as `(Select)` + `Option text = value`.
- **Linked Field** — three selects: *Dropdown Schema* (every schema, `(Select)` first), then *Option Text Field* and *Option Value Field* (both list the chosen schema's field captions; empty until a schema is picked). Live example: LabelerDuns + Company Name + Labeler Duns Number renders `Innovatum=118117576`, `Masons Company 2=1234567` — **text = the text field, stored value = the value field**. This is how `Labeler Duns Number` on RobarMasterData works. All three selects are required in this mode.
- **Database Query** — a single "Remote System SQL" textarea (required in this mode; expects a text/value pair, executed against a configured remote system — NOT executed in the spec, only stored). 
- **An unconfigured Dropdown List field (empty static list / empty query) blocks the whole schema Save and also makes the "Add New Field" link do nothing** — add valid fields first, the deliberately invalid one last.
- **Export Schema** (`#actionsDropdown` → `#actExportSchema`) downloads `<SchemaName>.sql` immediately (no dialog): a re-runnable T-SQL script of the SAVED schema (unsaved editor changes are not included). It starts `DECLARE @SCHEMA_NAME NVARCHAR(30) = '<name>'`, **refuses to run against a populated schema** (`RAISERROR('This schema already exists and is populated with data. Cannot update the schema field configuration'…)`), carries every field's caption/share name/sample data and its `Configuration` as an XML blob (a query appears with doubled quotes `''a''`), and for linked dropdowns lists the source schema + the linked/display fields **by share name** (`@EXPECTED_LINKED_FIELDS`, e.g. `LabelerDuns`, `dn_lblrdunsnum`, `D_CompanyName`) so the target must already have that schema.

### Master-data-level SHARE NAMES — how they work end to end (code-traced + live, 2026-10-04; user-requested learning goal)
A **share name** is the contract between a schema field, a template's text/barcode objects and the printed value. Configured per FIELD in the Schemas module (`Share Name` row; max 50 chars; e.g. `md_brand`, `md_primedi`, custom `m_*`), stored in `MasterDataSchemaFields.ShareName`, matched CASE-INSENSITIVELY.
1. **Designing a template** (Template Management / BarTender Data Source Names): the editor's available MD share names and their SAMPLE values come from ONE item schema chosen by the Global Setting **`GetDataSampleSchema`** (owner `Innovatum.Pages.TemplateManagement.WCF` / read via `GlobalSettings`; **TST703 value = `RobarMasterData`**, viewed read-only in Global Settings Management, DynamicUI grid, filter SettingName). `BarTenderEditService.GetSampleDataValues` / `GetAllMDItemSharenameValues(schemaName)` turn each field of that schema into (ShareName, SampleData); non-item schemas and schemas with no fields yield nothing. So **a share name on a field of ANY OTHER schema does not appear in the template editor**, and a field's **Sample Data** is exactly what the template preview shows for it.
2. **Get Data** (Template Management / Item Edit preview, `GetPrintRequestData`): `DoReplaceEngine.DoReplaceForPrint(item, mdItem, ...)` fills every share name with the selected item's REAL values — item-header names first, then the MDM record's fields by share name.
3. **Printing** (`Web/ROBAR/Printing/PrintMasterItem.cs`): the item's MDM record = `GetLatestApprovedEffectiveItem(itemNumber)` (or a specific version for Version Printing). If there is none but an MDM record exists, the template is treated as MD-aware **iff any label component name STARTS WITH one of that schema's share names** (`component.Name.Value.StartsWith(shareName)` — prefix match, so `m_altField1` also matches components named `m_altField10`/`11`), and then printing is blocked with "Master data was found for this item but it is not approved and effective." when the enforcement setting is on (else it prints without MD). A share name with no value renders blank.
4. **`<token>` substitution in strings** (`Innovatum.DataManagement.Data/Encoding/ShareNames.SubstituteShareNames`, used by integrations/exports): each `<name>` is resolved first against the fixed ITEM-HEADER share names (`ItemNumber`, `VersionNumber`, `Description`, `ApprovedBy`, `ApprovalDateTime`, `EffectiveBegin`, `EffectiveEnd`, `Active`), then against the schema field's `ShareName` -> its physical `MasterDataColumnName` (e.g. `Text61`); no match throws "Replacement string not found in field definitions". It takes the FIRST field with a matching share name, so **duplicate share names within a schema are ambiguous** (see the seed's duplicate `md_charname2` in dit-tracker.md).
5. **Other share-name families (not MDM, do not confuse):** item-level `I_Num`, `I_Desc` (Field Definitions Management, per label type), summary `S_*`, `L_PrintEntity`, `Dest_*`, dictionary `m_description/<language>`; the template editor's wizard requires a REAL, defined share name (an arbitrary string failed in earlier automation).
**LIVE PROOF of the template side, 2026-10-04 (`Template-Management/Get_Data_Master_Data.spec.ts`, headed):** template from `A1SuperTemplate_v0.btw` → item on it → a RobarMasterData record with the SAME item number (Brand Name `GDBrand<stamp>`, Primary DI `00841646<stamp>`) approved → reopen the template in BarTender → **Get Data** → Submit. BarTender's label (Workspace screenshot) goes from the placeholder sample data (`brand`, `prime di`, `version`, `Example Item Description`, `Example MDM Description`) to the real values: Item Number = the item, `item desc` = the item's description, **`mdm desc` = the MD record's description, `mdm ver` = 0, `mdm brand` = GDBrand<stamp>, `primary di` = 00841646<stamp>**; fields with no value (`item shelf`, `mdm shelf`) show `<Empty>`, lot fields show defaults (Lot123456 / Order123456, dates 12/31/1899, print entity = the user's facility). So text objects bound to `md_brand` / `md_primedi` / the MD description+version names are filled from the item's approved, effective MDM record (matched by item number). The Get Data dialog (child window `GetDataDialog` of the Template Editor) has `grpDataSource`, `grpSelectMasterData` (grid `dgvMasterData`: MD Item Number, MD Version Number, MD Description, MD Effective Begin, MD Effective End, MD Approved By, MD Approval Date), `grpSelectItemData`, Search `btnSearch`, Reset `btnReset`, and `pnlButtons` (Cancel/Submit); with one matching item the first rows are preselected, so Submit alone works. Label text is not readable via UI Automation — evidence is the attached Workspace screenshots (`flaui.screenshot` with `elementName: 'Workspace'`).
**Get Data options, live (`Template-Management/Get_Data_Options.spec.ts`, headed; source `Innovatum.Sentinel.Plugin.BarTenderEdit/Views/GetDataDialog.cs`):** radios `rbItemData` "Use Item and Master Data" (default) / `rbSampleData` "Use Sample Data"; item search = `ddlFields` + `rbStartsWith`/`rbContains` + `txtValue`, `btnSearch`, `btnReset` (Reset restores the defaults); checkboxes `chbAllowUnapprovedItems` and `chbAllowUnapprovedMasterData` (both CHECKED by default), `chbEffectiveItemsOnly` and `chbEffectiveMasterDataOnly` (unchecked); grids `dgvItemGrid` / `dgvMasterData`; selecting an item row (or Search) reloads the Master Data grid with the two master-data flags; Submit passes the selected item + the selected MD VERSION (none if the MD grid is empty). Proven on an item whose Master Data is UNAPPROVED: **default → the unapproved record's values ARE merged** (mdm brand / primary di / mdm desc / mdm ver real); **untick "Allow Unapproved Master Data" + Search → the md fields stay at their placeholders (`brand`, `prime di`, `version`, `Example MDM Description`, `mdm shelf`) while the item fields (Item Number, item desc) still fill**; **Use Sample Data → the SCHEMA sample values for everything** (`Item123456`, version 2, `Aspirin`, `12m`, mdm desc `Aspirin`, `Brand`, primary di `12345678901234`, mdm shelf `5Y`) — i.e. the `Sample Data` of the `GetDataSampleSchema` fields. The FlaUI bridge cannot read a checkbox's ToggleState (supported properties: IsEnabled, Name, Text, Value, IsOffscreen, BoundingRectangle) — prove checkbox effects through the label/grid instead. Within `Get Data`, scope clicks to a small container (`pnlButtons`, `pnlSearch`, `tblApprovalAndEffectivity`) — scoping to the whole dialog drags in the slow grids.
Template-side evidence tools: BarTender View > Data Source Names; `scripts/inspect-btw.ps1` lists a `.btw`'s `Data Source` bindings (e.g. `A1SuperTemplate_v0.btw`: Text 4 -> `I_Desc`, Text 13 -> `I_Num`).
**Live trace (2026-10-04):** scanning the template library (`Attachments and Upload Files\Templates`, `scripts/inspect-btw.ps1`) shows the standard fixture template **`A1SuperTemplate_v0.btw` binds 15 share names, including the MDM ones `md_brand`, `md_primedi`, `md_shelflife`** (plus `I_Desc`, `I_Num`, `I_Ver`, `I_ShelfLife`, `m_description`, `m_versionnumber`, `L_PrintEntity`, `L_Exd`, `L_Mfd`, `S_LabelControl`; the `...USERIAL_v0.btw` variant adds `S_USerial`); `MTLotTemp_v0.btw` binds `md_shelflife`; `PromptTest.btw` binds `md_adddesc1` (+ `I_CE/<Prompt>`); `MTLanguagesTemp_v0.btw` / `MTDX1_BT2022_v0.btw`/`MTSummary2022_v0.btw` partially resolve (`Share Name`/`Screen Data` literals, a Barcode `TextTransforms`). This SUPERSEDES the older note that A1SuperTemplate had only two bindings: **every spec item that uses A1SuperTemplate is master-data-aware** (so an item whose MDM record is unapproved/ineffective can be blocked at print). Item Edit's PDF dialog (`#viewPDFDialog`: latest/selected template version, `#useUnappDict` "Use Unapproved Dictionary Entries", `#allowUnappMDM` "Allow Unapproved MDM") produces a label PDF served at `items/PDFFileWindow?uniqueId=...&template=...` (headed browser only), BUT the PDF is a raster image: no extractable text, no stable hash/size signal for "MD values present" (see `tests/support/pdf.ts`), so merged share-name VALUES cannot be verified from it. Other surfaces to try for text-level proof: the print-preparation wizard (`Print Prep Testing` tile -> `InnoPages/PrintPrep/PrintPreparation?ConfigName=Print1`, needs an existing order/lot), Print/Label History Inquiry after a real print, or BarTender's Get Data dialog. Main Menu also has Schemas, Global Settings Management, Field Defs Management, Prompt Samples, MD Job Inquiry, Bulk Master Review tiles for detours.

### Security patterns specific to MDM
- Two security-icon conventions, consistent across Schema-level and Label-Type-level security:
  red icon + `"All ... have been disallowed due to ... Security. Please contact your security
  administrator for assistance."` = zero access (page/feature disabled); yellow icon + `"Some ...
  have been disallowed due to ... Security."` tooltip = partial access (usable, filtered).
- `MD_*` process family gates page/action-level capabilities (Approve, Create, Edit, Retire,
  Excel Import/Export, Mass actions, Change History, module visibility, Schema visibility, Export
  Schema). `MC_*` process family gates field-level Edit/View on individual schema fields.
- Module-visibility-affecting processes (`MD_Management_Option`, `MD_JobInquiry_Option`,
  `MD_Edit_Schemas`) require logout/login to take effect; action-level processes apply live.
- **Confirmed gap**: a disabled action (`New Record` when `MD_Create_Records` is revoked) renders
  correctly disabled but has **no tooltip at all** (`title` attribute empty) — contradicts the
  documented `"User not authorized for this task. <Process>"` tooltip behavior. Not yet confirmed
  whether this is isolated to New Record or systemic.

### Confirmed bug: "Labeler Duns Number" default value fails its own validity check
Every new record created under the `RobarMasterData` schema starts with `Labeler Duns Number`
pre-populated to `1234567890`, immediately flagged: `"This dropdown value is no longer a valid
selection. The schema definition may have changed."` — despite that exact value being present and
selectable in the dropdown's own option list. Re-selecting it does not clear the error; only
picking a genuinely different option does. Blocks Save until worked around. 100% reproducible (4/4
new records tested). Root cause is likely the schema's configured default value ID no longer
matching the option's current underlying value.

### Confirmed bug (cross-module, shared with Workflow Management): Export to Excel silently fails
Identical failure shape to the Workflow Management bug: `GET
/InnovatumMDM/QueryInterface/ExportToExcel` returns **HTTP 503**, but `GET
/InnovatumMDM/QueryInterface/CheckForExcelExportFileComplete` returns `true` regardless — the
client believes the export succeeded and shows no error, but no file is ever produced. Same
endpoint-pair naming convention as WM's `/InnoPages/WorkflowManagement/ExportToExcel` +
`CheckForExcelExportFileComplete` — strongly suggests one shared underlying grid-export component
across InnoPages modules rather than two independent bugs. File as one defect referencing both
reproduction sites.

### GlobalSettings referenced (view-only — do not change without explicit approval)

| Setting | Value | Owner |
|---|---|---|
| `COMServiceMustRun` | N (baseline) | Innovatum.DataManagement.Web |
| `UniqueVal_IncludeInactive` | Y | Innovatum.DataManagement.Web |
| `AutoCreateLabelControl` | Y | Innovatum |
| `AutoReleaseLabelControl` | Y | Innovatum.Web |
| `PrintEntityRequired` | N | Innovatum |
| `PerformMDMWorkflowLock` | (module-dependent) | — |
| `AutoApproveMasterData` | (module-dependent) | Innovatum |

### Features requiring infrastructure this environment doesn't have (out of scope for browser-only testing)
- **Excel Import** — **correction, 2026-09-29: this is NOT actually blocked.** Unlike other
  modules' native-OS-dialog uploads, this page's file field is a genuine `<input type="file">`
  that Playwright's `setInputFiles()` handles directly — confirmed working live (UAT_6198,
  2026-09-28) and via a full formal-script read. See the second MDM section below ("Excel Import —
  NOT actually blocked") for the full findings.
- **COM / Trading Partner Upload** — needs a live configured trading-partner endpoint.
- **Workflow Lock / Auto Approve** — GlobalSetting toggle requires RDP + IISRESET + service
  restart.
- **Localization & Reporting** — the formal script's own setup procedure (SQL Server Import and
  Export Wizard to move records into `LocalizationResources`) is **confirmed outdated by the user
  (2026-09-29): this environment no longer imports localizations that way — a stored procedure is
  used instead.** Everything else the script describes (the behavior being tested, the message
  catalog, the RDP+IISRESET requirement for it to take effect) is still accurate; only the
  setup/import mechanism itself has changed. Get the current stored procedure's name from the user
  before attempting this test rather than following the script's own Import/Export Wizard steps.
- **Data Retrieval 1.2** (database-driven field query) — needs a configured external SQL
  connection.

---

## Master Data Management (MDM)

**Purpose:** Schema-driven master-data records (GUDID/UDI-style attribute data) linked to items,
edited/approved/versioned independently of label templates, with bulk actions and Excel
import/export.

**Formal scripts reviewed:** all 39 scripts under `MDM\7.0.3\` (see
`.agents/exploratory-session-log-mdm.md` for the full per-script breakdown; summarized here).

### Data Retrieval / Filtering
Schema dropdown, `+Add Filter` (Column/Operator/Value), `For Items` dropdown
(Any/Approved/Unapproved/LastVersionIsApproved), `Latest Version Only`, `Effective Only`,
Advanced Options (Available/Selected Fields dual-list transfer, `Limit Results`). Filters persist
per-user like Workflow Management's do. Grid supports up to 1000 rows. Full Operator list confirmed
via `MDM_Load_External_Filter15.1.doc` (2026-09-29): `Contains`, `Does Not Match`, `Does Not
Contain`, `In`, `Not In`, `Greater Than`, `Less Than`, `Exactly Matches`, `Is Blank`, `Is Not
Blank`, `In External Column`, `Not In External Column`.

### Load External Filter (full read of `MDM_Load_External_Filter15.1.doc`, 2026-09-29) — MDM's own version differs from Campaign Manager's
Same underlying feature already documented under Campaign Manager above, but **MDM's own copy has
several confirmed textual/behavioral differences from Campaign Manager's — don't assume they're
identical just because the mechanism is shared**:
- Operator label here is literally `"Not In External Column"` (matching the script's own wording),
  **not** `"Not In External File"` like Campaign Manager's version uses for the same concept.
- After loading a filter, the Value box here reads `"EXCEL1 – ItemNumber"` — **an en dash, and no
  file extension** — versus Campaign Manager's confirmed `"EXCEL1.xlsx - ItemNumber"` (plain
  hyphen, extension included). Don't reuse one module's exact string assertion for the other.
- Selecting the Operator disables the Value textbox (shows placeholder `"(Load External Data)"`)
  and reveals a `Load External Filter` button plus a disabled `Exception List` button.
- The **External Filters popup**: Search box + button, `Upload External File`, a grid (`Source
  Name`, `Column Name`, `Loaded By`, `Loaded On`, `Last Used`) with paging, `Add Filter`/`Delete
  Filter`. Uploading an unsupported extension: `"File extension is not allowed"`; a structurally
  invalid file of an otherwise-allowed extension: `"The file selected is invalid and cannot be
  uploaded"`. Only one file may be attached to a new filter at a time: `"Only one file can be
  selected when adding a filter. Please correct and try again"`.
- **`Exception List`** (enabled after Retrieve Data with an External-Column filter active) shows
  specifically the external file's rows that have **no matching record** in MDM/ROBAR at all — a
  reconciliation view distinct from the main grid's own results.
- DB verification table is `FilterDataHeader` (columns: `Id`, `SourceName`, `ColumnName`,
  `LoadedBy`, `LoadedOn`, `LastUsed`, `MetaData`, `LastTouch`).

### Data Schemas (Settings → Schemas)
- **Create New Schema**: name + `Item Schema` checkbox → Schema Detail page (description +
  **Save**, blocked until description filled).
- Tabs: `+` to add, pencil to rename, drag-handle ("dimples," appear on hover) to reorder. Deleting
  the last field in a tab does **not** delete the tab — its caption turns red with strikethrough
  instead.
- Fields: `+Add New Field`, Field Type (Short Text/Dropdown List/etc.), Min/Max Length, `Unique`,
  `Input Mask` (regex-style, e.g. `K\w+`), `Protected` (visible but disabled), `Visible` (unchecked
  = doesn't render at all — distinct from Protected), `Required`, `Database Driven` (+ "Remote
  System SQL" box, executed on-demand via a Refresh icon on the item edit field, not automatically),
  `Share Name` (must be unique across fields), per-field `Edit Security` / `View Security`
  dropdowns (process family `MC_*`, distinct from action-level `MD_*` processes).
- Dropdown List fields can link to another schema's field as their option source (`Linked Field` →
  `Dropdown Schema` + `Option Text Field` + `Option Value Field`) — pulls live from that schema's
  **saved data**, not a static list.
- Validation messages: `"Value is shorter than the minimum length for this field."`,
  `"Value has exceeded the maximum length for this field."`, `"This field is required."`,
  `"Value does not conform to the pattern mask"`, `"Some fields contain invalid values. Please
  check your submission and try again."` (Save-blocking popup, dismissed via Continue).

### New Record (Actions → New Record)
"Create New Master Data" dialog: Item Number + Description → Submit. Duplicate check:
`"Item Number already exists in database"` / `Item Number: "X" already exists in the database.`
(wording varies slightly between contexts — confirm live). Defaults: Version 0, unapproved,
Effective Begin = today, Effective End = **12/31/2099**. Gated by `MD_Create_Records` (disables
the menu item outright when missing).

**Full read of `MDM_New_Record21.1.doc`, 2026-09-29 (previously only skimmed the first ~90 lines —
now read end to end):**
- `MD_Create_Records` gates New Record **in two separate places, both disabled when missing**: the
  Master Data Management page's own Actions dropdown, AND the Master Data Edit page's Actions
  dropdown (i.e. still disabled even once already viewing/editing an existing record) — for BOTH
  item schemas and non-item schemas. Confirms this isn't just a top-level menu gate.
- Non-item schema (e.g. a `SCA2`-style schema) New Record goes straight to a blank Master Data
  Edit page with no "Create New Master Data" dialog at all — matches the already-documented
  Playwright finding below, this is the formal script's own expected behavior too, not just an
  observed quirk.
- **Setup prerequisites** (GlobalSettings table, `Innovatum.DataManagement.Web` owner unless
  noted): `COMServiceMustRun`=N, `UniqueVal_IncludeInactive`=Y. Also `MD_Management_Option` must be
  enabled in the `MenuWebIntegration` table for the module to even appear.
- **Audit trail tables** (Step 4, DB verification): item-schema records log to `ItemHeaders`
  (current) / `X_ItemHeaders` (history), keyed by `ItemNumber`. Non-item-schema records log to
  `MasterData` (current) / `X_MasterData` (history), keyed by `MasterDataSchemaId` (found via the
  `MasterDataSchemas` table's own `Id` column, not the schema's display name). `X_MasterData`'s
  change-log rows carry `ChangeType` (`'A'` = Add) and `ChangeUser` columns — useful for any future
  audit-trail verification query on this module.
- Test-user pattern for this script: `U01` = AllSecurity group (positive), `U02` = "all security
  processes enabled except `MD_Create_Records`" (negative-permission test) — same class of
  precisely-scoped negative-permission fixture as Print by Lot's `MBSomeSecurity`/`MBSome2`.

### Data Edit
Standard pattern: unsaved field label turns red with an Undo arrow; Save reverts it to black.
Concurrent-edit lock: a second user opening the same record sees `"This page is currently being
edited by user: X and cannot be updated at this time. Please try back at a later time"` — soft
lock (Save button disabled client-side after dismissing), not a hard server-side reject.

### Actions menu (single-item, on Master Data Edit page)
- **Approve** — e-signature, record locks read-only.
- **Retire / Unretire** — confirmation popup + e-signature + Reason.
- **Save As New Version** — confirm dialog `"Are you sure you want to create a new version from
  this record?"`. Gated by `MD_SaveAsNew_Version`; unauthorized users get a runtime error
  (`"User not authorized for this task.: MD_SaveAsNew_Version"`) rather than a disabled control —
  inconsistent with most other gated actions, worth re-verifying live.
- **Save As New Record** — gated by `MD_SaveAsNew_Record`, which **does** disable the menu item
  outright when missing (the more common pattern).
- Both Save-As actions respect `COMServiceMustRun` GlobalSetting: when `Y` and
  `ROBAR_CommunicationsManager` isn't running, blocks with `"The ROBAR_CommunicationsManager is
  not active, please contact IT support."`
- **Get Remote Data** — only visible on unapproved items; runs the field's Database Driven SQL,
  success message `"Successfully updated fields : X"`.
- **View History** — Master Data Change History grid (Change Date/User/Field/Value
  Before/Value After). **Playwright-confirmed 2026-10-04 (`View_History.spec.ts`, 3/3, ~1 min):** reached from the grid
  row's Actions menu (View/Edit, View History, View Transmissions, View in GUDID) → frame
  `InnovatumMDM/MasterData/ChangeHistory/<masterDataId>`. Header: Item Number / Version / Schema Name / Description. It is
  **per VERSION** (a v1 shows only v1's changes). Grid `#grdChangeHistory`, newest first, columns Change Date, Change User,
  Changed Field, Value Before, Value After, Full Record ("View Detail"), 10/20/30 pager. Logged: every schema-field change
  (first save logs `(null)` → value, and a dropdown's default `1234567890` → chosen value), plus `ApprovalDateTime` on approve
  (date-only after-value, `(null)` before). NOT logged: Description / effective dates / Approved By. Filters (selects without
  ids — locate by `select:has(option:text-is("(Select User)"))` / `"(Select Field)"`): Change User (one entry per user,
  case-insensitive even though the grid shows "MBUser1" and "mbuser1"), Field (only fields with changes for that version),
  Start/End date (month/year selects over datepicker inputs); selecting re-queries immediately (no button). "View Detail" opens
  a jQuery UI dialog titled "Master Data history" with a full-record snapshot at that change (Item Number, Version, every
  schema tab, Close button). "Previous Page" returns to the MDM grid.
- **Insert Symbols** — button beneath Approved By. **Confirmed via full read of
  `MDM_ InsertSymbols23.1.doc` (2026-09-29): disabled for FOUR independent reasons, not just the
  security gate** — missing `MD_Edit_Records`, the record is approved, the record is retired
  (inactive), or the record is workflow-locked (same "Item being routed in workflow..." condition
  as `PerformMDMWorkflowLock` above). Symbols shown are sourced **live** from Codes Management's
  `CodeType=Symbols` records — flipping a symbol code's `Active` checkbox to `N` there removes it
  from the picker dialog immediately, no restart needed. Picks a symbol, copies to clipboard
  (`"(symbol) Copied to Clipboard."`), paste with Ctrl+V into the target field.

### MDM data on printed labels (full read of `MDM_Print12.1.doc`, 2026-09-29)
An MDM record and a Campaign Manager Item are linked for printing purposes by **sharing the same
Item Number**, with the Item's own Template needing a component bound to the MDM schema field
(confirmed elsewhere in this doc — see Campaign Manager's "two distinct entities" note). This
script exercises that linkage's actual print-time business rules:
- **Only the latest APPROVED and EFFECTIVE version of the linked MDM record prints** — the label
  pulls that version's field data regardless of what version is newest overall. Confirmed the print
  flow (Print by Order → enter Order/Item/Lot → Next twice → final Print screen → Batch Qty/Copy/
  printer → Print) actually renders the MDM field's value from that approved version, not a draft.
- **If the linked MDM record is retired (or otherwise not approved+effective), printing is
  blocked** with `"Master data was found for this item but it is not approved and effective."` —
  confirmed via Print by Order after retiring the MDM record from its own Actions → Retire menu.
  This is a hard stop, not a warning-and-continue.
- **Version Printing's behavior when the linked MDM record has no approved+effective version is
  different from Print by Order's hard stop — it lets the user override and manually pick a
  version**: `"No approved effective Master Data Item. You must click OK to override"` → OK →
  a screen listing every version of the MDM record → selecting an unapproved one shows `"Warning!
  Master Data Item is not approved"` → an explicit `"Proceed with version: N"` confirmation →
  normal Batch Qty/printer/Print flow, but this reprint path additionally requires an e-signature
  and a Reason Code selection (a reprint-specific gate, not the plain Print by Order flow's own
  requirements).
- **If only version 0 of the linked MDM record exists and it's approved+effective, Version
  Printing auto-selects it with no prompt at all** — the override/manual-selection UI above only
  appears when there's a real ambiguity (no valid version, or multiple versions to choose from).
- Setup prerequisites specific to this script (GlobalSettings, in addition to MDM_New_Record's
  `COMServiceMustRun`/`UniqueVal_IncludeInactive`): `AutoCreateLabelControl`=Y (owner `Innovatum`),
  `AutoReleaseLabelControl`=Y (owner `Innovatum.Web`), `PrintEntityRequired`=N (owner `Innovatum`).
- **A simpler checkbox-based override exists alongside Version Printing's manual-selection flow
  above — confirmed via full read of `MDM_Dictionary10.1.doc` (2026-09-29)**: Campaign Manager's
  Item Edit "PDF" preview and Template Management's "Get Data" both offer a `"Use Unapproved
  Dictionary Entries"` / `"Use Unapproved MDM Data"` checkbox (unchecked by default) that lets a
  user preview/pull the record's *unapproved* MDM data and dictionary translations instead of the
  normal approved-only behavior — without needing Version Printing's own "no approved effective
  version" ambiguity to trigger it. This script also confirms MDM-linked data is translated per
  Dictionary Management entries the same way plain item/template text is (a template component
  referencing `m_description/<language>` picks up the dictionary's approved-vs-unapproved
  translation consistently with whichever MDM data source is in play).
- **The same override exists a third place: Campaign Manager's "Send to Workflow" job submission**
  — confirmed via full read of `MDM_Data_Edit4.4.doc` (2026-09-29), a checkbox labeled `"Use
  Unapproved MDM Item"` (unchecked by default, matching the shipped default already documented
  under Campaign Manager's own "Send to Workflow" notes). The resulting Workflow Management
  "Workflow Image" preview correctly reflects whichever data source was actually used at submit
  time — checked → unapproved MDM data shown in the workflow image; unchecked → approved data
  shown — confirmed for both a fresh submission and a "Reject and Resubmit" of an item already in
  workflow.

### Bulk Actions (grid multi-select)
- **Mass Update** — Field to Update + New Value rows (add/remove), standard job-submission
  signature block.
- **Mass Approve** — same signature-block pattern. **Confirmed via full read of
  `MDM_Job_Inquiry8.1.doc` (2026-09-29): a Mass Approve job's Job ID IS findable afterward via
  "MD Job Inquiry" (Reports and Inquiries)** — filter `Column: Display Id`, `Operator: Exactly
  Matches`, `Value: <job id>` → Retrieve Job Data → View Detail. This corroborates (doesn't
  contradict) the UAT_Execution_Experiment skill's live finding that MD Job Inquiry does **not**
  track Excel Import jobs — it tracks Bulk Actions (Mass Approve/Update/etc.) specifically, a
  different job class entirely; check the right inquiry tool for the job type you're looking for.
  **Playwright-confirmed 2026-10-04 (`MD_Job_Inquiry.spec.ts`, 3/3, ~56 s):** Main Menu tile "MD Job Inquiry" →
  frame `InnovatumMDM/MasterData/JobInquiry`. Take the Job Id from the Job Detail page (`/Job Id\s+(\d+)/`), close the
  Master Data tab and click the Main Menu tab first (the tile only clicks from there). Filter row 0 uses the standard
  CriteriaFilter names (`dvFilters[0].Column/Operator/Value`); columns: Display Id, Job Description, Submitting User, Status,
  Date Inserted, Date Completed, % Complete, Bulk Action, Item Number, Item Version, Item Description, Item Approved By,
  Item Approval Date. Retrieve = `#btnRetrieveJobs`. Grid headers: Job Id, Display Id, Action, % Comp., Status, User, Job
  Description, Date Inserted, Date Completed, Job Detail; the Action cell reads `MassApprove`, and the row's "View Detail"
  link opens the same Job Detail page (shows the Job Id + every item number). Filtering by **Item Number** (ExactlyMatches)
  also finds the job — the inquiry indexes jobs by the items they touched. Display Id + ExactlyMatches returns exactly 1 row.
- **Assign GTIN** (`MD_AssignGTIN`, requires a configured GTIN Counters schema) — Field to Update /
  Packaging Code (defaults to `0`) / Company Prefix (from a GTIN Counters Schema record), or
  alternatively an **"Add Source DI Field"** mode (Field to Update / Packaging Code / a Source DI
  drop-down that generates the new GTIN off an existing DI field's value instead of a
  Prefix+Counter) — confirmed via full read of `MDM_Assign_GTIN14.1.doc` (2026-09-29). Blocks
  approved/retired items (exact message: `"Only active, unapproved items can be submitted to the
  Assign GTIN Bulk Action. Some items in your selection are approved or inactive. Please correct
  your submission and try again"`). Re-targeting a field that already has a GTIN shows a real
  confirmation warning before proceeding (`"Items in your selection already have a GTIN assigned
  to this field. Submitting the job will overwrite existing GTIN values."`) — not silent. Job can
  complete with **partial success** (per-row errors, not all-or-nothing); a successful row shows
  the newly generated GTIN directly in the Job Detail grid under that field's own column.
  **Source DI mode Playwright-confirmed 2026-10-04 (`Bulk_Assign_GTIN_Source_DI.spec.ts`, 3/3, ~51 s):** the page is a LIST of
  assignment rows — row type 1 = Field to Update + Packaging Code + Company Prefix (counter GTIN), row type 2 (the "Add Source DI
  Field" link) = Field to Update + Packaging Code + **Source DI** (select `(select)`, Primary/Unit of Use/Package/DM/Secondary DI
  Number); each added row has a "Remove" link; Packaging Code defaults to `0`; several rows run in ONE job and the Job Detail grid
  gets one column per updated field (`Unit_of_Use_DI_Number`, `Package_DI_Number`, `__rowcnt`). **Derivation rule:** Source-DI GTIN =
  Packaging Code + Primary DI digits 2–13 + a **recomputed GS1 mod-10 check digit** (the source's own indicator digit and check
  digit are dropped) — so two records whose Primary DIs differ only in the last digit get the SAME derived GTIN. The counter row
  gives each record its own 14-digit value (`00000000002xxx` style for prefix "Innovatum"). `createValidRecord` now accepts
  `primaryDi`. Gotcha: reading several inputs of the Edit page with repeated `getByRole('row', …)` crashed the renderer ("Page
  crashed"); read with one DOM `evaluate` instead. Package DI Number sits on a different tab whose rows are not in the DOM until
  that tab is opened.
- **Mass Retire – Unretire** (`MD_MassRetireUnretire_Items`) — radio defaults to whichever action
  matches the selection (all-active → Retire, all-inactive → Unretire + required Effective End
  Date field); a **mixed** active/inactive selection shows a warning
  (`"You have selected both Active and Inactive items..."`) and applies **one action to the whole
  batch** — no split retire-some/unretire-others in one job. **Confirmed via full read of
  `MDM_Mass_Retire_Unretire16.1.doc` (2026-09-29)**: exact mixed-selection warning is `"You have
  selected both Active and Inactive items. If you continue, the action you select will be applied
  to all items"` (real Cancel/Continue confirm dialog, not just inline text — lowercase "items",
  unlike End Distribution's similarly-worded but capitalized "Items" warning, a minor but real
  textual difference between the two features). Retire auto-sets Effective End Date to the current
  day for every selected item (no date field shown at all for Retire). Unretire additionally warns
  when multiple items are selected with its own Effective End Date field: `"The effective end date
  will be applied to all items"` (also Cancel/Continue) — since one shared date value gets applied
  across the whole batch.
- **End Distribution** (`MD_EndDistribution`) — bulk-sets FDA UDI Distribution End Date; a
  `"Prepare for new DI"` checkbox auto-creates a new unapproved version with DI/UUID fields
  cleared and (if configured) the old Primary DI Number carried into a Previous DI Number field.
  Confirmed exact warnings via full read of `MDM_End_Distribution18.1.doc` (2026-09-29): mixed
  active/inactive selection → `"You have selected both Active and Inactive Items. If you continue,
  the End Distribution Date you select will be applied to all Items"`; re-submitting records that
  already have a value → `"Some of your records already contain an End Distribution Date.
  Continuing will overwrite existing values"`.
- **Assign Labels** (`MD_AssignLabels_Option`) — creates Campaign Manager item/label records
  directly from MDM records. **Full read of `MDM_AssignLabels_24.1.doc` (2026-09-29) confirms this
  is a genuinely faster path than manually driving Campaign Manager's own Create New Item dialog**
  when you already have an MDM record and need a matching printable Item (exactly the pairing
  UAT_6356's test-data setup needed) — one job submission (per Label Type, via a collapsible
  section you can repeat for multiple label types in one job) creates the Item with the same Item
  Number, chosen Label Type, Template, and Description all set directly, **left Unapproved**
  (confirmed live: the resulting items show up under Campaign Manager's own "Unapproved" filter) —
  still needs a separate manual Approve afterward, same as any other new Item. Rejects mixed-version
  submissions of the same item number with the exact message: `"System cannot perform action. Only
  one record for each item number may be selected. Multiple versions were selected for the
  following item numbers: * <item> <name>"`. Label-type access gated by per-type
  `LT_<LabelType>` processes with the same red icon (all disallowed, full-block redirect) / yellow
  icon (some disallowed, tooltip `"Some label types have been disallowed due to Label Type
  Security."`) convention as schema security.
- **Export to Excel** — ❌ **Confirmed bug**, see below.
- **Quick Edit** ("Edit Selected Columns" button, gated by `MD_Edit_Records` — confirmed tooltip
  when missing has NO punctuation before the process name, `"User not authorized for this task
  MD_Edit_Records"`, unlike most other `MD_*` messages which use a period or colon there) — pages
  through selected records one at a time (`Record N/M`); only shows fields that were in Advanced
  Options' Selected Fields at retrieval time; same dirty-state red/Undo-arrow pattern; navigating
  away with unsaved changes prompts `"Changes will be lost. Would you like to proceed?"` (no
  autosave). **Confirmed via full read of `MDM_Quick_Edit17.1.doc` (2026-09-29)**: `MC_*`
  field-level Edit/View security is respected per-record while paging — a field showing `"(Not
  Authorized to View Data)"` (or rendering disabled-but-visible for edit-only restriction) does so
  consistently as you page through every record in the batch, not just the first one.
  Previous/Save/Save & Next/Next each independently enable or disable based on record position
  (first/last) and whether the current record actually has unsaved changes.

### Security
Two independent process families:
- `MD_*` — module/action-level (`MD_Approve_Items`, `MD_Create_Records`, `MD_Edit_Option`,
  `MD_Edit_Records`, `MD_ExcelExport_Option`, `MD_ExcelImport_Web`, `MD_MassApprove_Option`,
  `MD_MassUpdate_Option`, `MD_Retire_Items`, `MD_SaveAsNew_Option`, `MD_Unretire_Items`,
  `MD_Management_Option`, `MD_JobInquiry_Option`, `MD_ChangeHistory_Option`, `MD_Edit_Schemas`,
  `MD_Export_Schemas`, and more listed above). Module-visibility processes need a logout/login
  cycle to take effect; action-level ones apply live.
- `MC_*` — field-level Edit/View security, assigned per-field in Schema Maintenance. View-blocked
  fields show literal text `"(Not Authorized to View Data)"` instead of the value (not just
  disabled — the data itself is hidden).
- `SCH_"<SchemaName>"` — auto-generated per schema on creation (confirmed exact DB `Description`
  via full read of `MDM_Schema_Level_Security13.1.doc`, 2026-09-29: literally
  `"Security process for <SchemaName> schema."`), gates that schema's visibility in every Schema
  dropdown across the module. Zero-access → **redirected to a dedicated "Schema Security" screen**
  (not just an icon on the normal page — confirmed live, both Master Data Management and the
  Schemas module redirect here) with `"All schemas have been disallowed due to Schema Security.
  Please contact your security administrator for assistance."` Partial access → yellow icon +
  `"Some schemas have been disallowed due to Schema Security."` on the normal page (schema just
  missing from the dropdown, no redirect). Same red/yellow convention reused for Transmission
  Inquiry, MD Job Inquiry, and Assign Labels' `LT_*` label-type security.
- **`SCH_*` also silently filters MD Job Inquiry and Transmission Inquiry SEARCH RESULTS, not just
  which schema you can select** — confirmed via the same script: a user missing a schema's `SCH_*`
  process sees `"Search results are limited due to Schema Security."` on both inquiry screens, and
  a job/validation record tied to that schema is simply absent from the results table even when
  filtered for by its exact Display ID/Item Number — not an error, just silently excluded. Worth
  checking this before concluding a job "doesn't exist" or "wasn't tracked" in either inquiry tool.
- **Confirmed gap:** a disabled action (`New Record` / `MD_Create_Records`) renders correctly
  disabled but has **no `title` attribute anywhere on the element or its ancestors** — no tooltip
  can ever render explaining why, contradicting the formal script's expected `"User not authorized
  for this task. MD_Create_Records"` tooltip. Not yet confirmed whether this is isolated to New
  Record or systemic across other disabled actions.
- **`MD_Edit_Option` vs `MD_Edit_Records` gate two different moments, confirmed via
  `MDM_Security3.1.doc` full read (2026-09-29)**: `MD_Edit_Option` gates *opening* a record at all
  — clicking View/Edit without it throws a runtime error (`"User not authorized for this task.
  MD_Edit_Option."`), the row itself isn't disabled. `MD_Edit_Records` gates *saving* changes once
  already on the Edit page — the error appears next to the Save button instead
  (`"User not authorized for this task. MD_Edit_Records."`). A user could plausibly have one
  without the other (view/edit-but-can't-save, or blocked from opening entirely).
- **There are THREE distinct "Save As New"-style features, not one, each with its own gate and its
  own disable behavior — confirmed via full reads of `MDM_Security3.1.doc` and
  `MDM_Actions5.3.doc`**: (1) single-item Actions-menu **"Save As New Version"**, gated
  `MD_SaveAsNew_Version`, disables via runtime error not a disabled control (see "Actions menu"
  above); (2) grid **Bulk Actions "Save as New Version"**, gated `MD_SaveAsNew_Option`, correctly
  greys out; (3) single-item Actions-menu **"Save As New Record"** (copies field *definitions*,
  not just versions the same record), gated `MD_SaveAsNew_Record`, correctly disables outright —
  the "worth re-verifying live" note this doc previously carried about (1) vs. the more common
  disabling pattern is resolved: they're three different features, not one feature behaving
  inconsistently.

### Confirmed bug: "Labeler Duns Number" default value fails its own validity check
On the `RobarMasterData` schema, every new record created via New Record pre-populates Labeler
Duns Number with `1234567890`, immediately flagged red:
`"This dropdown value is no longer a valid selection. The schema definition may have changed."`
The value **is** genuinely present and selected among the dropdown's real options — re-selecting
it does not clear the error (the option's underlying stored value likely doesn't match the
schema's configured default ID even though display text matches); picking a different option
(e.g. "Innovatum") clears it immediately and allows Save. Reproduced 100% (4/4 new records this
session). Root cause is very likely a stale default-value ID in the schema config having drifted
from the option's current underlying value.

### Confirmed bug (cross-module, shared with Workflow Management): Export to Excel silently fails
Identical failure shape to Workflow Management's Export to Excel bug: `GET
/InnovatumMDM/QueryInterface/ExportToExcel` returns **503**, but `GET
.../CheckForExcelExportFileComplete` returns `true` regardless, so the UI shows no error and no
file downloads. Different URL namespace (`InnovatumMDM` vs `InnoPages/WorkflowManagement`) but
identical endpoint-pair naming and behavior — very likely one shared underlying grid-export
component used by both InnoPages modules, not two independently-broken features. File as one
defect referencing both reproduction sites unless the code is confirmed genuinely separate.

### Excel Import — NOT actually blocked; live-tested and formal-script-read 2026-09-28/29
**Correction to the "out of scope" note this section previously carried**: unlike other modules'
native-OS-file-dialog uploads, this page's file field is a genuine HTML `<input type="file">`
(`#spreadsheetFile`) — Playwright's `setInputFiles()` targets it directly with no tooling
limitation at all. Confirmed working end-to-end live (UAT_6198, 2026-09-28) and cross-checked
against a full read of `MDM_ExcelImport_Importing22.2.doc` (2026-09-29). Combined findings:

- **A required-field-blank-cell error and a missing-column error are two entirely different
  failure modes, confirmed via the formal script's own dedicated test** — don't conflate them.
  A blank *cell* in an existing required column produces **row-level** errors in the "Errors
  Only" grid (e.g. `"FLD1 is required"` for that specific row/item). A required column *missing
  entirely* from the sheet produces a **job-level** failure instead: Status becomes `Validation
  Errors`, Error Message `Missing Columns`, with a tooltip listing exactly which ones (e.g.
  `"Missing Columns: FLD3"`) — and the Errors Only grid stays completely empty in this case, which
  can look confusingly like "no errors" if you only check that grid.
- **Extraneous (unrecognized) columns in the sheet are silently ignored**, not an error — only
  missing *required* columns fail.
- **"Validation Rules Override" checkbox** (Excel Import page, gated by `MD_Validation_Override`,
  tooltip `"User not authorized for this task. MD_Validation_Override."` when missing) lets a user
  bypass required-field/business-rule validation for the whole import — confirmed live: rows with
  required fields deliberately left blank still import successfully with this checked.
- **Re-importing item numbers that already exist prompts a real confirmation dialog first**, not a
  silent overwrite or a hard block: `"Some records within the selected Excel file already exists
  in Master Data. These records will be overwritten, do you want to proceed?"` — Submit Job doesn't
  actually run until this is accepted.
- **Job Summary grid columns**: Display ID, Description, User Id, Created, Completed, Percent
  Complete, Status, Error Message. Status progression: `InProgress` → `Validating` → `Completed`
  (or `Validation Errors`). **"Errors Only" grid columns differ by schema type**: `Excel Row ID`,
  `Item Number`, `Status`, `Message` for an item schema; for a non-item schema the second column is
  the sheet's own first column header instead of `Item Number` (there's no item-number concept for
  those records).
- **A completed job (success or failure) always offers a "Download Spreadsheet" link** under the
  Job Summary section — a reliable way to get the full result set/error detail as a file rather
  than paging through the on-screen grid.
- **Client-side required-field validation on the Job Submission fields themselves** (Job
  Description, User ID, Password, Reason) shows `"This field is required"` before any server
  round-trip; a wrong password shows `"Invalid Username/Password. UserID: X"`; missing
  `MD_ExcelImport_Web` shows `"User not authorized for this task. MD_ExcelImport_Web"`.
- **Only one file can be selected for upload at a time** (confirmed: multi-select is blocked), and
  hovering a long filename shows the full name via a tooltip.
- **No Schema selected yet** shows a plain yellow exclamation-mark warning icon next to the
  dropdown, not an error message.
- **Playwright-confirmed 2026-10-04 (`Excel_Import.spec.ts`, helpers in `tests/support/master-data-import.ts`; workbooks are
  generated with the `exceljs` devDependency from the schema's own template headers):**
  - Page ids: `#ddlSchemas`, `#spreadsheetFile` (accept `.xls,.xlsx`), `#fileDisplay`, `#downloadLink` (Download Template →
    `<Schema>_Template.xlsx`, one `Sheet1` of headers only: `ItemNumber, Description, EffectiveBegin, EffectiveEnd`, then every
    field caption — 121 columns for RobarMasterData), `#validationRuleOverride`, `#applySchemaDataDefaults`, `#ddlSheets`
    (auto-selects `Sheet1` after the attach round trip), `#jobDescription`, `#sigUser #sigPassword #sigReason #sigComments`
    (reasons: General Approval / QA Approval / RA Approval / Ready for GUDID), `#btnSubmitJob` (disabled until the file +
    signature are in and Password is blurred).
  - **Job status text has no space: `ValidationErrors`** (not "Validation Errors"); the Job Detail Display ID is the small
    sequence (4401, 4411 … step 10), NOT the 12-digit id used by MD Job Inquiry. The Job Detail "Error Message" line shows the
    uploaded file name after any message, even on success. Errors Only grid headers: `ExcelRowId, ItemNumber, VersionNumber,
    Status, Message`; rows read e.g. `2 | <item> | 0 | Error | Brand Name: Required` and
    `Labeler Duns Number: InvalidValue`. "Download Spreadsheet" (link text = uploaded file name) returns the uploaded workbook
    as-is — it does NOT contain the error messages.
  - Behaviour confirmed: a valid import creates **unapproved v0** records (extra "Junk Column" ignored); a missing column →
    `ValidationErrors` + `Missing Columns`, empty Errors grid, nothing imported; a blank required cell or an invalid dropdown
    value → row error (file-type error text for a non-Excel file: "Excel file cannot be processed."), and **a mixed sheet
    (one valid row + one invalid row) imports NOTHING** — the whole sheet is rejected and only the bad row (Excel row 3) is
    listed; Validation Rules Override imports the blank required cell;
    re-importing an existing item shows the "Some records … already exists … overwritten, do you want to proceed?" Yes/No
    dialog — **No creates no job**, Yes on an **unapproved** record updates it **in place** (still one v0), Yes on an
    **approved** record leaves v0 untouched and adds a **new unapproved v1** with the imported values.
  - **Every import leaves a Job Detail tab open and `findFrame` then returns the stale tab** — close all non-Main-Menu tabs
    before each import and read the last matching frame (done in `closeAllModuleTabs` / `importSheet`).
- See the UAT_Execution_Experiment skill's own "Excel Import specifically" section for the
  live-Playwright mechanics (readonly-datepicker Effective Begin fix, numeric-field ARIA-role fix,
  Labeler Duns Number dropdown, `networkidle` never resolving on this page, etc.) — this section
  covers the module's *business rules*, that one covers *automating* it.

### Auto Approve Master Data (Workflow Management → MDM linkage, full read of `MDM_Auto_Approve20.1.doc`, 2026-09-29)
A previously-undocumented cross-module feature: when `AutoApproveMasterData` GlobalSetting
(owner `Innovatum`) is `Y`, completing the **last open label type under a given Change Control**
in Workflow Management (View and Vote → Approve → Update/Submit) auto-approves that Change
Control's linked item(s)' MDM record(s) — no separate MDM Approve action needed.
- **Attribution: the auto-approval is recorded as `ApprovedBy = 'ROBAR'`** (a system/service
  account), not the human user who actually approved the workflow step — confirmed via
  `X_ItemHeaders` query. A corresponding `Activity` table row (`Action = 'Auto Approve Master
  Data'`) is logged with a matching `Logged` timestamp — the concrete audit-trail query pair to
  use for verifying this: `Select * from X_ItemHeaders where ItemNumber = 'X' and ApprovedBy =
  'ROBAR' order by ChangeDateTime desc` and `Select * from Activity where Action = 'Auto Approve
  Master Data' order by Logged desc`.
- **Evaluated per Change Control, not per item** — the same item can trigger auto-approve multiple
  times across its lifecycle if its different label types get routed through separate Change
  Controls at different times (confirmed: one item, two label types, two Change Controls → two
  separate auto-approve events, each producing its own new approved version).
- **A shared Change Control covering multiple items evaluates each item's MDM record
  independently, and is a safe no-op for one that's already approved** — confirmed live: approving
  both label types under one shared Change Control auto-approved the item whose MDM record was
  still unapproved, while the OTHER item (whose MDM record was already approved) was correctly
  left completely untouched ("Changes are not made to ITM3, as it was already approved") — not an
  error, not a redundant version bump, just a clean no-op.
- Disabling the setting (`N`) needs `ROBAR_ServiceHost` restart + IISRESET to take effect, same
  restart pattern as every other cached-GlobalSetting toggle in this module.
- Setup prerequisites beyond the usual MDM ones: `MD_Management_Option`, `Web_WorkflowManagement`,
  and `Login_CampaignManager` must all be enabled in `MenuWebIntegration`; `PerformMDMWorkflowLock`
  should be `N` for this specific test (a separate, related feature — see "Workflow Lock" — that
  would otherwise interfere).

### Workflow Lock (Workflow Management → MDM linkage, full read of `MDM_Workflow_Lock19.1.doc`, 2026-09-29)
The sibling feature to Auto Approve above, gated by its own GlobalSetting
(`PerformMDMWorkflowLock`, owner `Innovatum.DataManagement.Web`). When `Y`: an MDM record whose
linked item has ANY label type currently routed through an open workflow becomes read-only,
across every surface that touches it:
- **Master Data Edit page**: the whole record is non-editable, with a message directly in the Item
  Header section: `"Item being routed in workflow – cannot be modified."`
- **The Actions menu on that same locked record is only PARTIALLY disabled, not uniformly —
  confirmed live, a genuinely surprising/non-obvious split**: `Save as New Version` and `Get
  Remote Data` are disabled, but `Approve`, `Save as New Record`, `Retire`, and `View
  Transmissions` all remain fully enabled despite the record's own fields being locked. Don't
  assume "locked" means every action is blocked — check the specific action.
- **Bulk Actions**: Mass Update and Assign GTIN both block a locked record in the selection with
  `"Some items in your selection are being routed in workflow."`
- **Quick Edit**: a locked record pages through as view-only, showing the same `"Item being routed
  in workflow – cannot be modified."` message per-record (alongside other per-record status text
  like `"Not Effective"`/`"Retired"` when applicable) rather than blocking the whole Quick Edit
  session.
- Same GlobalSetting-restart pattern as Auto Approve: needs `ROBAR_ServiceHost` restart + IISRESET
  to take effect after toggling.

### Out of scope this session (infrastructure gaps)
- **COM / Trading Partner linkage** (`MDM_COM7.1`, `MDM_ExcelImport_COM22.3`) — needs a live,
  configured trading-partner endpoint; `COMServiceMustRun` must be `Y` for the COM-specific test.
  **Mechanics confirmed via full read, 2026-09-29** (neither executed live — no configured
  trading-partner endpoint here):
  - `MDM_COM7.1`: the Master Data Edit page has a Trading Partner dropdown + `Validate`/`Upload`
    buttons. Validate opens a "Trading Partner Feedback" popup and leaves a "Validation Feedback"
    link on the page; Actions → View Transmissions opens Transmission Inquiry scoped to that
    record, whose rows have their own Actions → View Detail (reopens the Validation Feedback
    popup) → `"View SPL"` (shows the record in raw XML). Upload requires an e-signature before
    the transmission is created. Bulk **Trading Partner Upload** rejects mixed-version selections
    of the same item number with the exact message `"Your selection contains multiple versions of
    the same item number. Multiple versions of the same item may not be uploaded at the same
    time"`.
  - `MDM_ExcelImport_COM22.3`: confirms Excel Import interacts with a record's GUDID transmission
    history when creating a new version — **a record whose PRIOR version had a genuine GUDID
    success status gets its new version's `GUDID Status` field set to `"Previous Version Accepted
    by GUDID"`** (a carried-forward marker, not blank), while a prior version that failed or was
    never submitted leaves the new version's `GUDID Status` blank. `Model UUID`/`Catalog UUID`
    copy forward from the prior version in most cases, but come back blank together for a record
    that was never validated/submitted to GUDID at all — a real, previously-undocumented
    version-transition rule worth knowing before assuming Excel Import simply blanks these fields
    on every new version.
- **Workflow Lock** / **Auto Approve** — GlobalSetting toggle (`PerformMDMWorkflowLock`,
  `AutoApproveMasterData`) requires RDP + `ROBAR_ServiceHost` restart + IISRESET.
- **Localization & Reporting** (both MDM scripts) — needs DB-level `LocalizationResources` import,
  then RDP + IISRESET. **Confirmed outdated by the user, 2026-09-29: the SQL Server Import and
  Export Wizard both scripts describe is no longer how this is done — a stored procedure is used
  instead now.** Get the current procedure from the user rather than following the scripts'
  Import/Export Wizard steps; everything else about the behavior/messages under test is still
  accurate. Same likely applies to Workflow Management's own Localization Resources script — worth
  re-confirming there too before relying on it.
- **Data Edit 4.3** (GUDID-trigger simulation) — needs direct SQL access to seed
  `masterdatacolumntriggers`; not an actual external GUDID call, just a local DB-trigger
  simulation, but still needs DB write access to set up. **Mechanism confirmed via full read,
  2026-09-29** (still not executed live — this is what the SQL setup configures): a row in
  `masterdatacolumntriggers` (`MasterDataSchemaFieldId` = the tracked field, `FieldIdToBeUpdated` =
  the field to change, `OldValue` = a match pattern where `*` means "any prior value", `NewValue` =
  what to set the target field to) fires **on Save** — changing the tracked field to ANY new value
  and saving sets the OTHER configured field to the configured value automatically, no page
  refresh needed to see it (confirmed: the target field shows its new value immediately after the
  same Save that changed the tracked field). Works the same way whether the tracked field is a
  plain field or itself Database Driven. In practice this is the mechanism behind auto-flagging a
  record's Transmission Status as `"NeedsRetransmit"` when a GUDID-relevant field changes, but it's
  a generic field-cascade-on-save trigger, not GUDID-specific — reusable for any "when field X
  changes, set field Y" business rule a schema needs.
- **Data Retrieval 1.2** (database-driven field pulling from an external system) — needs a
  configured external SQL Server connection. **Clarified via full read, 2026-09-29**: "external"
  here means external to MDM's own schema tables, not necessarily a different SQL Server instance
  — the script's own worked example query (`select top 1 description from items where itemnumber
  = 'X'`) reads ROBAR's own `items` table, same database MDM itself runs against. The "Remote
  System SQL" field just needs *a* reachable connection string, which could point at the local
  ROBAR database itself for a same-environment test — don't assume a genuinely separate server is
  required unless the specific scenario calls for one.

### Relevant GlobalSettings
| Setting | Value | Owner |
|---|---|---|
| `COMServiceMustRun` | N (baseline; Y for COM-specific tests) | Innovatum.DataManagement.Web |
| `UniqueVal_IncludeInactive` | Y | Innovatum.DataManagement.Web |
| `PerformMDMWorkflowLock` | Y/N (untested — needs IISRESET) | — |
| `AutoApproveMasterData` | Y (untested — needs IISRESET) | Innovatum |
| `MasterData_ExportCSVColumnThreshold` | 100 | Innovatum.DataManagement.Web |

### Playwright automation notes (Create_New_Record.spec.ts, 2026-09-14)

The two sections above are from earlier manual exploratory-testing sessions. This subsection adds
what's specifically needed to *script* MDM interactions reliably, learned live while building
`tests/Master-Data-Management/Create_New_Record.spec.ts` (the first Playwright test in this
module) — read this before writing another MDM test.

- **The WebMenu module button is "Master Data", not "Master Data Management"** — and it's a
  substring of the separate "Master Data Excel Import" button, so the shared `openMenuItem()`
  helper's `:has-text()` (substring) match is ambiguous for this one module. Use an exact match
  instead: `page.click('button.menuIcon:text-is("Master Data")')`. The module's own iframe URL
  contains `MasterData` (`http://.../InnovatumMDM/MasterData/Management?...`), fine for
  `findFrame(page, 'MasterData')`.
- **Schema dropdown is `#ddlSchemas`.** Its `<option>` elements all have an empty `value=""`
  attribute (Knockout's `options` binding here has no `optionsValue`, so it tracks the selected
  schema object by array position/reference, not by a real DOM value) — select by
  `{ label: schemaName }`, not by value.
- **"New Record" is `#drpMainActions` → `#actNewRecord`, and needs `{ force: true }`** — the exact
  same jQuery dropmenu-toggle widget (and the exact same icon-`<span>`-overlapping-the-link hit-test
  problem) already documented for Template Management's `#actCreateTemplate` in the BarTender
  playbook below. Not a new bug, just the same widget reused in a different module.
- **Item vs non-item schema New Record behaves differently, confirmed live**: for an item schema
  (e.g. `MBItemSchema`), New Record opens a "Create New Master Data" dialog (Item Number +
  Description fields, `#txtNewItemNumber` / `#txtNewItemDescription`, Submit button id
  `#btnSubmitNewitem`) before landing on the Master Data Edit page. For a non-item schema (e.g.
  `MBNonItemSchema`), New Record skips that dialog entirely and goes straight to a blank Master
  Data Edit page for the schema's own fields — don't assume the dialog always appears.
- **Don't use `.ui-dialog-buttonpane button:has-text("Submit")` for the New Record dialog** — this
  page has multiple `.ui-dialog` instances in the DOM at once (Approve, Retire, Unretire, New
  Record, ...), most hidden, and more than one of them has a button literally labelled "Submit"
  (e.g. Approve's `#btnApproveSubmit`). That selector is a strict-mode trap here. Use the New Record
  dialog's own real id, `#btnSubmitNewitem`, instead.
- **Confirmed discrepancy from the formal script (MDM_New_Record21.1 step 2.4/2.5)**: the New
  Record dialog's Description field does NOT carry over to the item's own required Description
  field on the resulting Master Data Edit page in this build — they're two separate observables
  (`newItemDescription` for the one-shot creation POST vs. `itemHeader().description` on the Edit
  page). The Edit page's Description starts empty and required regardless of what was typed in the
  dialog; it must be filled again there before Save enables. The formal script's expected result
  (item just appears, no separate description step) does not match live behavior — this test
  asserts the real behavior instead of the script's assumption.
- **That built-in Description field can't be set via a plain `fill()` or even real per-character
  keystrokes** — confirmed by trying both. Its binding is
  `value: itemHeader().description, valueUpdate: 'afterkeydown'` (unlike ordinary schema fields,
  which use the standard `textInput: $data.value` binding and accept `fill()` completely normally).
  Every scripted keystroke gets wiped back to empty: writing to the observable via `afterkeydown`
  triggers a synchronous re-render of that row that recreates the input from the pre-keystroke
  value, racing the next keystroke. The only reliable fix is to reach into the page's own Knockout
  view model directly and push the value into the observable itself — see
  `setItemDescription()` in `tests/support/master-data.ts`:
  ```ts
  await frame.evaluate((desc) => {
    const ko = (window as any).ko;
    const vm = ko.dataFor(document.body);
    vm.itemHeader().description(desc);
  }, description);
  ```
  This is a real, reproducible app quirk (not a tooling artifact) — worth a defect report if this
  hasn't been filed already, since a real user typing normally into that field would hit the exact
  same lost-keystroke behavior, just less consistently than a scripted click hits it every time.
- **Save button click**: a plain `frame.click('button:has-text("Save")')` paired with
  `page.waitForResponse(...SaveMasterDataItem...)` (Promise.all pattern, same idiom used throughout
  this suite) worked fine once the response-wait was in place — earlier apparent "the click did
  nothing" failures during live exploration turned out to just be checking the page state before the
  async save had finished, not a real click defect worth adding `{ force: true }` for.
- **Duplicate Item Number rejection** shows inline as `.newItemError` text inside the still-open
  dialog (`"Item Number: "X" already exists in the database."`), not a toast/alert — assert on that
  locator's text rather than waiting for a dialog/toast to appear elsewhere.
- **`MBItemSchema` was NOT reliably usable** as the default test schema — confirmed live it exists
  in the Schema dropdown and drives the same dialog flow described above, but in one real automated
  run its New Record dialog never rendered visibly at all (`#txtNewItemNumber` existed in the DOM
  but Playwright's `fill()` timed out waiting for it to become visible). Switched the default to
  **`RobarMasterData`** instead (configurable via `ROBAR_MDM_SCHEMA` in seed.ts) — a schema already
  used as the module's own default in earlier manual exploratory sessions, confirmed live to open
  its New Record dialog reliably.
- **`RobarMasterData` is a much richer schema than `MBItemSchema`** (~14 tabs, dozens of fields) and
  needs 3 more fields filled before Save enables, beyond the built-in Description: **Primary DI
  Number** and **Brand Name** (both required), and **Labeler Duns Number** must be changed away from
  its pre-populated default (`1234567890`, which the app itself immediately flags as
  `"This dropdown value is no longer a valid selection..."` — the confirmed bug already documented
  above; picking a different option like "Innovatum" clears it). Rather than hunting through 14 tabs
  by eye to find which fields were actually invalid, reach into the page's own Knockout view model
  and read its `errors` array directly — much faster and exhaustive:
  ```ts
  await frame.evaluate(() => {
    const ko = (window as any).ko;
    const vm = ko.dataFor(document.body);
    return ko.utils.unwrapObservable(vm.errors).map((e: any) => e.toString());
  });
  ```
  This returns the flat list of every current validation message on the record regardless of which
  tab is active — do this BEFORE trying to guess which fields need filling on a schema you haven't
  driven before.
- **Dropdown-type schema fields use jQuery Select2**, which hides the real `<select>` behind its own
  fake widget (the classic `select2-hidden-accessible` screen-reader-only CSS pattern — the select
  is still attached and gets a real `value`/`change`, just not visually rendered the normal way).
  Don't drive Select2's own open/click/pick-an-option UI — Playwright's `selectOption()` targets the
  real hidden `<select>` directly and updates it correctly regardless. Scope by row caption:
  `frame.getByRole('row', { name: caption }).locator('select').selectOption({ label: optionLabel })`
  (see `selectDropdownFieldByCaption()` in `tests/support/master-data.ts`).
- Plain schema-defined text fields (regardless of schema) use the standard Knockout
  `textInput: $data.value` binding and accept ordinary `fill()` without any of the above workarounds
  — scope them the same way, by row caption. **Correction, 2026-09-29**: the original version of
  this note (and `fillFieldByCaption()`'s original implementation) used
  `getByRole('row', { name: caption }).getByRole('textbox')`, which silently matches ZERO elements
  and hangs for the whole test timeout for a **numeric-typed** field (`fieldTypeIsNumeric()`
  renders `<input type="number">`, whose ARIA role is `spinbutton`, not `textbox` — confirmed live
  on `RobarMasterData`'s `Device Count` field). Fixed in `tests/support/master-data.ts` to match
  the row's actual `<input>` element directly (`.locator('input[type=text], input[type=number]')`)
  instead of an ARIA role, since a field row only ever renders one live input at a time (Knockout
  `ko if: fieldTypeIs...()` blocks empty out the rest as comments) regardless of text vs. numeric.
  Only the ONE special built-in Description field (`itemHeader().description`) needs the
  Knockout-direct-write workaround above.
- **The Master Data Edit page for an item schema is TABBED**, and a field's tab is not obvious from
  its caption alone. Confirmed live for `RobarMasterData` (2026-09-29): tabs are `Device Id`
  (default/active — Labeler Duns Number, Issuing Agency, Catalog Number, Version or Model, Primary
  DI Number, Brand Name, Brand Logo, Device Description, Device Schema, Material, Cement
  information, CE_Notify Body, EC Rep, Distributor, Additional Description 1-3, ECN Nr, Change
  Control Number), `Packaging Structure` (Box Name, **Device Count**, Unit of Use DI Number,
  Package DI Number, Quantity per Package, Parent DI, Contains DI Package, Package Type, Package
  Discontinue Date), `Regulatory Data`, `Traceabilty and Iso Symbols`, `Characteristics`, `Storage
  and Handling`, `Sterilization Method`, `Additional Identifiers`, `GUDID Control`. **Device Count
  is on "Packaging Structure", not the default "Device Id" tab** — a script that fills it without
  first clicking that tab hangs the same way the numeric-field bug above does (row simply isn't in
  the DOM yet), and the two bugs can be mistaken for each other. Click the tab
  (`frame.getByText('Packaging Structure', { exact: true }).click()`) before filling any field not
  on the default tab; when unsure which tab holds a field, iterate all tabs checking
  `getByText(caption, { exact: true }).count()` per tab rather than guessing.
- **Primary DI Number must be unique across the WHOLE schema** — confirmed live: reusing the same
  literal test value across repeated test-record creations throws `"This value already exists in
  another record. This field must be unique."` inline next to the field (same red-label-plus-
  reset-arrow error styling as other field-level validation, not a toast/dialog). Derive a fresh
  value per run (e.g. from a timestamp) rather than a fixed literal.
- **A filter row set up in one session can persist server-side across days**, not just within a
  session — confirmed live: a filter (`Item Number Contains "MBUAT6198D_..."`) left over from a
  prior day's session silently narrowed every subsequent Retrieve Data the NEXT day to just that
  one stale match, with no visible indication anything was filtered beyond the small filter row
  itself. Always check for and clear (`Remove`) an existing filter row before trusting an "empty
  results" or "record not found" outcome, the same discipline already documented for MDM's
  "Selected Columns" persistence above and for Campaign Manager's own last-used-filter
  auto-restore (see "Known testing-tooling limitations" below).

---


### NOTE 2026-10-09 on the two "Master Data Management (MDM)" sections above
This file holds two sections with the same title: the first (older, document / source review + first live pass) and the second (later, Playwright specs and live findings 2026-10-02 .. 2026-10-04). They are complementary, not contradictory except where the second says "CORRECTION"; when in doubt prefer the second.
