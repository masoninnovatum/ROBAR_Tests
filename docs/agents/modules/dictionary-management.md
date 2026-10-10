<!-- Split from robar-module-reference.md on 2026-10-09 (lossless, original order kept; later blocks are newer and win over earlier ones). Module file: dictionary-management -->

## Dictionary Management

**Purpose:** Manages the `Dictionary` table — Phrase/Language/Translation records used to drive
templated/localized label text (including `prompt<Question={...}>`-style dynamic tokens embedded
directly in the Translation field) and general UI localization.

**Formal scripts reviewed:** all 9 scripts under `Dictionary_Management\` (8 test-case areas; see
`.agents/exploratory-session-log-dictionary-management.md` for the full write-up).

### Basic retrieval / filtering
`+Add Filter` (Column/Operator/Value, e.g. `Phrase Contains <text>`), `Version Filters` dropdown
(Any / Approved / Last Version is Approved / Unapproved), `Latest Only` / `Effective Only`
checkboxes, `Limit Results` (default 500). Grid columns: Actions, Phrase, Language, Translation,
Version, Effective Begin, Effective End, Approved By, Approve Date. `Retrieve Data`/`Reset`. This
environment has 150+ pre-existing real records, including live UI-token phrases like
`Manufacturing Date YYYY-MMM-DD` (Language = "Prompt") with `Edit as HTML` content — be careful not
to modify these when testing, they're likely in active use elsewhere in the product.

### Actions dropdown (page-level): Excel Import, New Entry
- **New Entry** (`DM_NewEntry`): Phrase / Language / Translation textboxes, Effective Begin
  (defaults to today) / Effective End (defaults to **12/31/2099**) date pickers, `Edit as HTML`
  checkbox (reveals a CKEditor 4 instance below the plain Translation textarea when checked).
  `"This field is required."` on blank Phrase or Language. Duplicate Phrase+Language+Translation
  combination is blocked with `"Record already exists."` (a modal, not inline text).
- **Excel Import** (`DM_Import`, `DM_ImportOverwrite` for the overwrite-existing-rows path):
  Dictionary Management link, `Download Template` (produces `Dictionary_Template.xlsx` with headers
  `Phrase, Language, Translation, Effective Begin Date, Effective End Date, ApprovedBy,
  ApprovedDate`), File textbox + Browse, Sheet dropdown, `Validate` (disabled until a file+sheet is
  chosen). Validation surfaces per-row errors inline in a preview grid (`"Row already in database"`,
  `"Duplicate row in Excel"`, blank-required-field cells highlighted red with `null`) before the
  signature block appears. **Not live-tested this engagement** — see the tooling-limitation note at
  the bottom of this document; the file input lives inside the same-origin content iframe and this
  session's `read_page`/`find` tooling can't obtain a ref into it, so `file_upload` has no target.

### Row Actions (per-record dropdown): View/Edit, New Version
- **View/Edit**: Phrase and Language render as genuinely read-only (confirmed by selecting the text
  and typing over it — the value doesn't change, this isn't just visual/CSS disabling).
  Translation, Effective Begin, Effective End, and `Edit as HTML` are all editable.
- **New Version**: confirmation dialog (`"Are you sure you want to create a new version?"`).
  Attempting this on a record whose latest version is still unapproved is correctly blocked:
  `"A latest unapproved version <N> already exists. Cannot create a new version."` Once that version
  is approved (e.g. via Mass Approve), New Version opens an edit dialog identical to View/Edit
  (Phrase/Language disabled, Translation/dates/HTML editable) and Submit creates a real new
  unapproved version alongside the prior approved one — both independently retrievable in the grid.
  Gated by `DM_NewVersion`; unauthorized users see the row action itself disabled with a working
  tooltip: `"User not authorized for this task. DM_NewVersion."`

### Bulk Actions dropdown (on selected rows): Export to Excel, Mass Approve, Mass Retire/Unretire
Standard Job Submission → e-signature (Username/Password/Reason Code/Comment) → async Job Detail
pattern, same as every other module in this engagement.

| Action | Gate | Status | Notes |
|---|---|---|---|
| Export to Excel | `DM_Export` | ✅ Working | Job Description + Filename (both required, Submit disabled until filled) → Job Detail with `Status: Completed`, `100%`, a working `Download Spreadsheet` link. **Does not reproduce** the confirmed cross-module Export-to-Excel 503 bug documented for Master Data Management and Workflow Management — every request in the chain (`CreateJob`, `ExportToExcelJobSubmission`, `ExportToExcelSubmitJob`, `JobDetail`) returned 200 in this session's testing. Useful as a working reference implementation when that MDM/WM defect gets investigated. |
| Mass Approve | `DM_MassApprove` | ✅ Working | Blocks re-approving an already-approved selection with a banner: `"One or more dictionary records are already approved."` |
| Mass Retire/Unretire | `DM_MassRetireUnretire` | ✅ Working | `Retire` radio pre-selected by default; `Unretire` only becomes selectable once a retired record is in the selection (mirrors the Retire/Unretire pre-selection pattern seen in Master Data Management's Mass Retire-Unretire). Submitting Retire correctly sets Effective End to the current date. |

### Security pattern
Single process family, `DM_*`: `Web_DictionaryManagement` (module visibility — needs logout/login
to take effect, same as other module-visibility processes across the product), `DM_NewEntry`,
`DM_Edit`, `DM_NewVersion`, `DM_Export`, `DM_MassApprove`, `DM_MassRetireUnretire`, `DM_Import`,
`DM_ImportOverwrite`. Per-user checkboxes in Security Management's **Users** view render checked
but greyed/disabled (permissions are inherited from the user's Group, not editable per-user
directly) — toggle at the **Groups** view instead, filtered to the user's actual group (e.g.
`MBSomeSecurity` for `MBUser2`).

**Disabled-action tooltip confirmed working here** (a useful positive counter-example to the gap
found in Master Data Management): disabling `DM_Export` for a test group and inspecting the
disabled Bulk Actions menu item's DOM found the enclosing `<li class="ui-menu-item">` correctly
carries `title="User not authorized for this task DM_Export."` — an exact match to the formal
script's expected wording, and proof the tooltip mechanism isn't broken product-wide, just missing
on some specific controls (like MDM's New Record).

### Out-of-scope this session
Excel Import / Excel Import — Update (file-input iframe limitation, see below); all DB-level
audit-trail verification steps present in every script (`Dictionary`, `X_Dictionary`, `CMJobs`,
`Activity`, `Signatures`, `TableImporterJobs`, `X_TableImporterJobs`, `UserEnvironment` — no direct
SQL access this session).

---


### Dictionary Management - Playwright-confirmed 2026-10-07 (headless, TST703, seed user MBUser1; specs in `tests/Dictionary-Management/`, helper `tests/support/dictionary.ts`)
- **Page:** tile "Dictionary Management" -> `InnoPages/DictionaryManagement/Management?LinkedFromWebmenu=1`; CriteriaFilter rows `dvFilters[n].Column|Operator|Value` (Column list Approved By / Approve Date / Effective Begin / Effective End / Language / Phrase / Translation / Version; the 10 usual operators; Is Blank / Is Not Blank HIDE the Value box), `#drpApproved` (Any / Approved / Last Version Is Approved / Unapproved), `#chkLatest`, `#chkEffective`, `#txtResultLimit` (default 500), `#btnRetrieveData`, `#btnReset`, grid `#grdJqGrid` (columns Id, Category, Actions, Phrase, Language, Translation, Version, Effective Begin, Effective End, Approved By, Approve Date; the Translation cell `title` carries the full text). **Reset clears EVERYTHING (criteria rows, Version dropdown to blank, Latest / Effective unticked)** and the criteria are persisted per user and restored after any save / reload, so a search must set every control explicitly and add a criteria row only if none exists (`search()` helper). Main Actions `#drpMainActions` = `#actExcelImport`, `#actNewEntry`; row Actions = View/Edit (`<guid>-0`), New Version (`<guid>-1`); Bulk Actions `#drpActions` = `#actExport`, `#actApprove`, `#actRetireUnretire`. Retrieve fires `SaveFilters` + `GridSessionStart` + `GridSessionGetPage`. Seeded records: 53 `Language = Prompt` phrases (e.g. `Manufacturing Date YYYY-MM`), 27 with a blank Approved By - read only, do not edit.
- **New Entry / View/Edit / New Version** = a jQuery dialog holding the nested iframe `InnoPages/DictionaryManagement/ViewEdit?pageAction=new|edit&dicId=`: text inputs Phrase and Language (unnamed; `input[type=text]:not([id^=dp])` #0/#1), date boxes `input[id^=dp]` (readonly datepicker: set with `jQuery(el).datepicker('setDate', new Date(v)).trigger('change')`), `#nonHtmlTrans`, `#cbEditAsHtml`, CKEditor 4 (`textarea#htmlTrans`, `CKEDITOR.instances`), `#btnSubmit`. Defaults: Effective Begin = today (shown with the creation time in the grid), Effective End 12/31/2099, Edit as HTML off. Errors appear inline in the frame body: "Phrase: This field is required." / "Language: This field is required."; a duplicate Phrase+Language+Translation shows "Record already exists." + Continue inside the frame (then the X closes the dialog). Translation may be blank. Future Effective Begin accepted; Effective Only hides it, Latest Only keeps it. View/Edit: Phrase + Language disabled (real read-only), Translation / dates / Edit as HTML editable ONLY for an UNAPPROVED record and a user with `DM_Edit` (approved records open fully read-only whatever the security). Edit as HTML: the CKEditor appears under a DISABLED plain Translation, unticking removes it and re-enables the textarea; saved HTML (colors, fonts) is stored as the Translation source and View/Edit reopens with Edit as HTML ticked and the formatting intact. New Version: confirmation "Are you sure you want to create a new version?" (Yes / No), "A latest unapproved version '<n>' already exists. Cannot create a new version." + Continue while the newest version is unapproved; on an APPROVED record Yes creates version n+1 (unapproved) and opens the edit dialog (`pageAction=edit`, Phrase / Language disabled) - Submit saves the new text; Latest Only then shows only the new version, Version filter Approved shows only the old one, Unapproved the new one.
- **Bulk actions** = Job Submission page (`DictionaryManagement/ApproveJobSubmission?jobId=...`, Retire and Export equivalents) -> Job Detail (`Status Completed`, 100 %, per-row table). Mass Approve: `#txtJobDescription`, `#sigUser`, `#sigPassword`, `#sigReason` (Select Reason / Data Approval / Data Correction / New Entry / Requested Change / Retire/Unretire), `#sigComments`, `#btnSubmit` (disabled until complete; the password must be blurred); re-approving an approved record = banner "One or more dictionary records are already approved." ON the submission page. Mass Retire/Unretire: the page opens with "Selected: 0" and everything disabled and fills in a moment later (wait for `#txtJobDescription` to be enabled); radios `retireItems` / `unretireItems` (only the applicable one is enabled); **Retire works on an UNAPPROVED record too** and sets Effective End to now (grid then shows a past end date, Effective Only hides it); **Unretire restores Effective End 12/31/2099 AND resets Effective Begin to now**. Export to Excel: NO signature block - only Job Description (`#txtJobDescription`) + Filename (`#txtFileName`), `#btnSubmit` disabled until both are filled; Job Detail has a "Download Spreadsheet" link; the xlsx columns are Phrase, TransType, Category, Language, Translation, VersionNumber, EffectiveBegin, EffectiveEnd, ApprovedBy, ApprovalDateTime (selected rows only).
- **Excel Import** = `InnoPages/DictionaryManagement/FileSubmission` ("Dictionary Excel Data Upload"; links Dictionary Management, Download Template -> `Dictionary_Template.xlsx` with headers **Phrase, Language, Translation, EffectiveBegin, EffectiveEnd, ApprovedBy, ApprovalDateTime** (the formal script says "Effective Begin Date" etc.); `#spreadsheetFile` + `#fileDisplay`, `#sheetName`, `#btnValidate` disabled until file + sheet). Validate posts to `ExcelImportJobSubmission`: errors show a "Validation Errors" grid (cells `div.is-highlighted` with a `title`: blank Phrase / Language = "This column does not allow null values.", a non-date Effective Begin / End = "Unable to parse value to correct column type.", RowError "Duplicate row in Excel" for repeated rows, **"Row already in Database"** (capital D; the script says "database") for an existing Phrase+Language plus the dialog "Existing records - The following records will replace data in the database, do you want to proceed?" with **No** / **Yes** / X); No or X aborts and leaves Validate disabled until another file/sheet is chosen; after validation ERRORS Validate stays enabled; Yes shows "Validation Successful." plus the signature block (Job Description is an id-less text box; the grid pager input must not be confused with it); Submit Job -> "DisplayId: <12 digits> Upload Successful."; new rows arrive unapproved version 0 with the given dates; an overwrite replaces the Translation in place (version stays 0). The SIGNER must hold `DM_Import` (and `DM_ImportOverwrite` for the replace path): a signer lacking them gets a dialog 'User not authorized for this task. "DM_Import"' (both names when neither is held) / '... "DM_ImportOverwrite"' + Continue.
- **Security (MB fixtures, one process at a time):** the tile needs `Web_DictionaryManagement`; with only that: Excel Import, New Entry, New Version, Export, Mass Approve, Mass Retire/Unretire are disabled with `li title="User not authorized for this task DM_<Process>."` (DM_Import, DM_NewEntry, DM_NewVersion, DM_Export, DM_MassApprove, DM_MassRetireUnretire) and the View/Edit window is read-only; `DM_Edit` makes the View/Edit window editable; each process switches on exactly its own control. Server-side enforcement was NOT demonstrated (opening the `ViewEdit?pageAction=new` URL directly fails with a script error because it needs its parent frame).
- **Other notes:** ticking TWO grid rows quickly in a row can lose a tick (the footer "Checked Rows:n" shows the real count; the bulk spec ticks with a pause and re-ticks until the count matches - an export once missed a row); specs create records `MBDM<stamp>*` (they cannot be deleted; one retired / unretired record per bulk run); `Dictionary_Management_Security.spec.ts` ends with `MBPWLoginGrp` holding only `Login_WebMenu`.

---

## Requirements re-check (ValMaster first) - Dictionary Management, 2026-10-09 (`Dictionary-Management/Dictionary_Management_Requirements.spec.ts` + `_Requirements_Import.spec.ts`, 3/3 each)

Requirement set: `.agents/valmaster-dictionary-management.md` (module "Dictionary Management", 202 rows, Customer Specific blank). Deviations are test annotations `deviation <req id>`.
- **Earlier findings now SETTLED by the requirements (not defects):** Unretire resets Effective Begin to the day of the unretire (DM.20210908.F.8.16: Effective Begin defaults to today, End to 12/31/2099, both read-only; a different date comes from the date picker); Retire works on unapproved records (F.8.7 / F.8.8 / F.8.9 speak of retired and unretired, approved AND unapproved records); the template headers EffectiveBegin / EffectiveEnd / ApprovalDateTime are correct (F.2.10; the old script text was wrong); Export has no e-signature (F.6.7 lists only Job Description, Filename, Submit Job).
- **Met (checked live):** Column list incl. alphabetical order (F.1.11), Version Filters (F.1.14), Latest Only / Effective Only (F.1.18 / F.1.19), select-all + row checkboxes (F.1.26 / F.1.27), pager 10 / 20 / 30 default 10, "Checked Rows:n", "Page of n", "View x - y of n" (F.1.30-F.1.33), Actions = Excel Import, New Entry; Bulk Actions = Export to Excel, Mass Approve, Mass Retire/Unretire (F.1.13 / F.1.35), row Actions = View/Edit first then New Version (F.1.29), reason codes Data Approval / Data Correction / New Entry / Requested Change / Retire/Unretire (F.7.13), Mass Approve page content and Submit disabled (F.7.7 / F.7.17), Retire page radios (Unretire disabled for unretired records, Retire disabled for retired ones, Retire default for a mix, F.8.7-F.8.9), Retire sets Effective End to today (F.8.10), mixed-selection warning dialog INSIDE the job page with Continue / Cancel and Cancel returns to the main page (F.8.12-F.8.14), Excel Import: sheet dropdown with "(Select a sheet)" first, worksheets alphabetical, a single worksheet pre-selected (F.2.17 / F.2.18), blank dates default to today / 12/31/2099 (F.2.11 / F.2.12), non-ROBAR ApprovedBy accepted and dated today (F.2.13 / F.2.15), future Effective Begin accepted (F.2.14), overwriting an APPROVED record with blank ApprovedBy creates a new UNAPPROVED version (F.2.6), validation is all-or-nothing (F.2.21).
- **Deviations:** F.1.25 (the grid has an extra "Category" column); F.6.4 / F.7.4 / F.8.4 ("Please select one or more records." comes with Close and **Continue**, not an OK button); F.7.11 / F.8.22 / F.2.36 (message is "Invalid Username/Password. UserID: <id>" with a period where the requirement has a colon); F.8.12 (warning text lacks the comma after "If you continue"); F.7.8 / F.7.10 / F.7.14 (after touching and emptying Job Description, User Name, Password and Reason Code only ONE "This field is required." message appears; the requirement expects one per field - exact trigger not pinned down).
- **Not checked yet:** Export filename ".xlsx" appended (F.6.10) and Submit Job disabled until Job Description + Filename (F.6.11); Job Detail page counters (F.9.x); bulk jobs visible in Job Inquiry / CMJobs (F.10.1, U.10); AND / OR criteria drop-downs (F.1.9) and the Remove link (F.1.10); "No records to view" (F.1.22); New Version messages "A latest approved version 'X' already exists" (F.4.8); Activity-table rows for e-signatures (F.2.41, F.7.16, F.8.27) and X_Dictionary audit (needs DB); localization of every message (F.1.36, F.9.1); DM_ImportOverwrite signer message (F.2.32); server-side authorization (no requirement text; test remains open).


### Dictionary Management SERVER-SIDE authorization — 2026-10-09 (`Dictionary_Management_Server_Side_Authorization.spec.ts`)
Direct POSTs to `InnoPages/DictionaryManagement/<action>` as MB user MBPWLogin01 holding only `Login_WebMenu` + `Web_DictionaryManagement`: **NewRecord refused** ("User not authorized for this task.DM_NewEntry"); **Update refused** ("User not authorized for this task. "DM_Edit"" in a `<ul>`); **NewVersion NOT refused — it created a version** (defect: `SaveNewVersion` sets the Errors but never `return`s / sets `Success=false`, DM_NewVersion check ineffective). Contrast: Lot Management / Security Management write endpoints have no check at all; Dictionary's other checks live in the WCF service layer (`SaveDictionary`, `RequestCheck` for the mass actions with the signature user, `DM_Import` / `DM_ImportOverwrite`). Probe rule: only ever probe with an MB-owned record (the spec now picks a phrase whose Phrase cell starts with MB and skips otherwise), because a successful probe writes data that cannot be deleted. The unauthorized message wording differs per endpoint (with / without quotes, with a `<ul>`).


### NOTE 2026-10-09: read the ValMaster re-check first
Findings in the older sections that the requirements later SETTLED as by design (Unretire resets Effective Begin, Retire works on unapproved, template headers, no signature on Export) are listed in the block "Requirements re-check (ValMaster first) - Dictionary Management" and are NOT defects. The one real server-side defect found afterwards is NewVersion authorization (block "Dictionary Management SERVER-SIDE authorization").
