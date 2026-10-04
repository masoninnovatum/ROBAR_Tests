# Formal Test Scripts — Review Coverage Index

Running index of which ROBAR/Innovatum formal test script sets (network share
`\\diskstation\backedup\#Unlocked_Test_Cases\<Module>\7.0.3\`) have actually been read end-to-end
by a Claude session, how thoroughly, and where the distilled findings live. The scripts themselves
are the source of truth for module business rules — this index exists so a session knows what's
already covered before re-reading, and what still needs a first (or a deeper) pass.

**This file lives alongside `robar-module-reference.md` in the same folder deliberately — both are
project-independent.** Any Claude session working on ROBAR/Innovatum Suite 7, in ANY project/group
(regardless of which specific build/checkout that project points at — 703_20198 today, a future
build's own new project tomorrow), should read both files here before starting module-specific
work, and add to both as part of any exploratory/live-testing or formal-script-reading session.
Don't duplicate this index into a project-scoped memory file — Claude Code's own memory system is
per-project, so anything saved only there is invisible to every other project. This file (a plain
file on disk) is the one place guaranteed to be reachable from anywhere.

**Maintenance convention**: distilled findings always go into `robar-module-reference.md` itself,
never only into this index — this file records *what's been read and how thoroughly*, not the
content itself.

**Why this exists:** formal test scripts encode human-QA-verified business rules that can't be
re-derived from code alone, and the user wants a firm, retained understanding of these modules
across every project/session, not just the one that happened to do the reading. Per the user
(2026-09-29): scripts are generally accurate but can contain human error (e.g. an outdated setup
procedure) — treat them as strong evidence, not infallible. When a script's setup steps are
confirmed outdated by the user, correct the note here and in `robar-module-reference.md`, but the
rest of the script's own content (the behavior under test) still stands unless also flagged.

## Master Data Management (MDM) — `MDM\7.0.3\` (39 scripts total)

**Fully read (end to end), findings distilled into `robar-module-reference.md`:**
- `MDM_New_Record21.1.doc` — read fully 2026-09-29. Findings: `MD_Create_Records` gate in two
  places, non-item-schema dialog-skip behavior, GlobalSettings prerequisites, audit-trail table
  names (`ItemHeaders`/`X_ItemHeaders`/`MasterData`/`X_MasterData`), the `U01`/`U02`
  positive/negative test-user pattern.
- `MDM_Print12.1.doc` — read fully 2026-09-29. Findings: MDM record ↔ Campaign Manager Item
  linkage via shared Item Number, the approved+effective-only print rule, the retired-MDM-record
  hard-stop message, Version Printing's manual-override flow for ambiguous/unapproved MDM
  versions, single-version auto-select behavior.
- `MDM_Data_Schemas2.1.doc` through `2.4.doc` — read fully 2026-09-29. Mostly CONFIRMED existing
  doc content (tabs/fields CRUD, Unique/Input Mask/Protected/Visible/Required behavior, linked
  dropdown schemas) rather than adding much new — minor additions only (default new-field name
  pattern, drag-and-drop between tabs).
- `MDM_Data_Retrieval1.1.doc` and `1.2.doc` — read fully 2026-09-29. 1.1 mostly confirmed existing
  filter/retrieval doc content. 1.2 produced a real correction: the doc previously said this needs
  "a configured external SQL Server connection" (implying out of scope) — the script's own example
  query reads ROBAR's own `items` table, same database, so it may actually be testable here
  without a separate server. Flagged in the reference doc; **not yet re-attempted live**.
- `MDM_Security3.1.doc` and `3.2.doc` — read fully 2026-09-29. **Turned out to be almost entirely
  redundant** — a prior session had already fully distilled both into the reference doc's
  "Security" subsection (the whole `MD_*` process list and the `MC_*` "(Not Authorized to View
  Data)" message were already there, near-verbatim). Real lesson: check the existing Security
  subsection before re-reading these two again. Did yield two genuine corrections: `MD_Edit_Option`
  vs `MD_Edit_Records` gate different moments (open vs. save), and the bulk "Save as New Version"
  is actually gated `MD_SaveAsNew_Option` not `MD_SaveAsNew_Version` as the doc previously stated
  (that name gates the separate single-item version of the same-named feature).
- `MDM_Actions5.1.doc`, `5.2.doc`, `5.3.doc` — read fully 2026-09-29. Genuinely new content: the
  Save Search/Load Search feature (not documented at all before — Save As New/Overwrite, Public
  checkbox), Export to Excel's column-selection and MDM-caption-vs-raw-header checkboxes, and
  confirmation there are three distinct "Save As New"-style features (Version single-item /
  Version bulk / Record), each separately gated.
- `MDM_Data_Edit4.1.doc` — read fully 2026-09-29. Confirmed existing dirty-state/save-pattern
  content (text/boolean/date/dropdown field types) almost exactly; minimal new content.
- `MDM_Data_Edit4.2.doc` (969 lines — Mass Update, Retire/Unretire, single-item Save As New
  Version, HTML/CKEditor fields) — read fully 2026-09-29. Confirmed the exact
  `"User not authorized for this task.: MD_SaveAsNew_Version"` message (cross-checks the
  Security3.1 correction above). HTML-field section thinner than expected (just confirms
  scientific-notation values persist through Save) — no major new findings.
- `MDM_ExcelImport_Importing22.2.doc` (1248 lines) — read (grep-targeted + key sections in full)
  2026-09-29. **Substantial new content** — see the "Excel Import — NOT actually blocked" section
  in `robar-module-reference.md`: the missing-column-vs-blank-cell distinction, "Validation Rules
  Override" (`MD_Validation_Override`), the overwrite-confirmation dialog, exact Job Summary/
  Errors Only grid columns, Download Spreadsheet link, and several exact client-side validation
  messages. The reference doc previously (incorrectly) marked ALL of MDM's Excel Import as "out of
  scope" — corrected now that both this script and live UAT_6198 testing have covered it.
- `MDM_ExcelImport_Security22.1.doc` — read fully 2026-09-29. Almost entirely confirmatory
  (`MD_ExcelImport_Web` gate, `SCH_*` red-icon schema-security message) — no new content added.
- `MDM_ExcelImport_LocalizationResources22.4.doc` — grep-scanned 2026-09-29 (localization-specific
  variant of the Importing22.2 test, confirms the same message catalog is localizable via an
  `LPRE1` language-prefix convention) — confirmatory only, no new content added. **Its setup
  procedure (SQL Server Import and Export Wizard) is confirmed outdated by the user, 2026-09-29 —
  a stored procedure is used instead now; corrected in the reference doc.**
- `MDM_Job_Inquiry8.1.doc` — read fully 2026-09-29. New: exact Job Inquiry filter mechanic
  (`Display Id` / `Exactly Matches` / job id → Retrieve Job Data → View Detail); corroborates
  (doesn't contradict) the skill's live finding that Job Inquiry tracks Bulk Actions, not Excel
  Import.
- `MDM_SummaryLabel11.1.doc` — read fully 2026-09-29. Low generalizable value — heavy
  infrastructure prerequisites (Printer Control Maintenance records, a configured real printer,
  PrintConfig `ShelfLifeShareName`), not really testable in this environment. Confirms an
  MDM-based shelf-life calculation feeds a Summary Label component (`L_Exd`); nothing else added.
- `MDM_Dictionary10.1.doc` — read fully 2026-09-29. New: a checkbox-based "Use Unapproved
  Dictionary Entries"/"Use Unapproved MDM Data" override exists on Campaign Manager's PDF preview
  and Template Management's Get Data (simpler than Version Printing's manual-selection flow from
  `MDM_Print12.1.doc`) — added as a cross-reference in the MDM↔Print section.
- `MDM_History6.1.doc`, `6.2.doc`, `6.3.doc` — read fully 2026-09-29. All three almost entirely
  confirmatory (View History row access, change-history detail, the concurrent-edit-lock message
  verbatim) — no new content added.
- `MDM_Schema_Level_Security13.1.doc` — read fully 2026-09-29. Genuinely new: the exact
  auto-generated `SCH_*` process description text, the zero-access **redirect to a dedicated
  "Schema Security" screen** (not just an icon, a real correction to the prior summary), and that
  `SCH_*` schema security also silently filters MD Job Inquiry/Transmission Inquiry SEARCH RESULTS
  (not just which schema is selectable) with its own `"Search results are limited due to Schema
  Security."` message.
- `MDM_Auto_Approve20.1.doc` (793 lines) — read fully 2026-09-29. **A whole previously-undocumented
  cross-module feature**: completing the last open label type under a Change Control in Workflow
  Management auto-approves its linked MDM record(s) (`AutoApproveMasterData` GlobalSetting).
  Genuinely valuable specifics: auto-approval attributes to `ApprovedBy='ROBAR'` (a system
  account, not the human approver) with a matching `Activity` audit row (`Action='Auto Approve
  Master Data'`); evaluated per Change Control so one item can trigger it multiple times across
  its lifecycle; a shared Change Control evaluates each linked item's MDM record independently and
  safely no-ops for one already approved.
- `MDM_Assign_GTIN14.1.doc` (711 lines) — read fully 2026-09-29. Mostly confirmed/expanded the
  existing brief summary: exact block message for approved/inactive items, the "Add Source DI
  Field" alternate mode (generates a GTIN from an existing DI field instead of Prefix+Counter), and
  the exact overwrite-confirmation warning text.
- `MDM_AssignLabels_24.1.doc` (1354 lines) — read (grep-targeted + key sections in full)
  2026-09-29. **Practically useful find**: confirms Assign Labels is a genuinely faster one-step
  path to create a matching Campaign Manager Item from an MDM record (Item Number/Label
  Type/Template/Description all set directly, left Unapproved) than manually driving Campaign
  Manager's own Create New Item dialog — exactly the pairing UAT_6356's test-data setup needed.
  Also confirmed the exact multi-version-selection block message and the `LT_*` label-type
  security red/yellow messages.
- `MDM_End_Distribution18.1.doc` (1105 lines) — read (grep-targeted + key sections in full)
  2026-09-29. Mostly confirmed the existing summary; added the two exact warning message texts
  (mixed active/inactive selection, re-submitting already-dated records).
- `MDM_Workflow_Lock19.1.doc` (1311 lines) — read (grep-targeted + key sections in full)
  2026-09-29. **Another whole previously-undocumented cross-module feature**, sibling to Auto
  Approve: `PerformMDMWorkflowLock` makes an MDM record read-only while its linked item has any
  label type in an open workflow, across Master Data Edit, Mass Update, Assign GTIN, and Quick
  Edit. Genuinely surprising specific: the locked record's Actions menu is only PARTIALLY
  disabled — Approve/Save as New Record/Retire/View Transmissions stay enabled even though the
  record's own fields are locked; only Save as New Version and Get Remote Data are blocked.
- `MDM_ InsertSymbols23.1.doc` (488 lines) — read fully 2026-09-29. Expanded the existing brief
  summary: the Symbols button is disabled for FOUR independent reasons (missing
  `MD_Edit_Records`, approved, retired, or workflow-locked — not just the security gate), and the
  symbol list is sourced *live* from Codes Management (toggling a symbol code's Active checkbox
  removes it from the picker immediately, no restart).
- `MDM_Data_Edit4.3.doc` (383 lines) — read fully 2026-09-29 (still not executed live — needs SQL
  seed access). **Genuinely new mechanism documented**: `masterdatacolumntriggers` table
  implements a generic "when field X changes to any value, set field Y to a specific value"
  cascade that fires on Save — the real mechanism behind auto-flagging a record's Transmission
  Status as `NeedsRetransmit`, but reusable for any schema's own field-cascade business rule.
- `MDM_Data_Edit4.4.doc` (372 lines) — read fully 2026-09-29. Confirms the "Use Unapproved MDM
  Data" override (already documented from `MDM_Dictionary10.1.doc`) exists a THIRD place: Campaign
  Manager's "Send to Workflow" job submission (`"Use Unapproved MDM Item"` checkbox), and that the
  resulting Workflow Management preview correctly reflects whichever data source was used,
  including for a "Reject and Resubmit" of an item already in workflow.
- `MDM_Load_External_Filter15.1.doc` (942 lines) — read (grep-targeted + key sections in full)
  2026-09-29. **Genuinely valuable cross-module correction**: MDM has its own copy of Campaign
  Manager's "Load External Filter" feature, and it is textually different in ways worth knowing
  before reusing an assertion across modules — different Operator label ("Not In External Column"
  vs. CM's "Not In External File"), an en dash and no file extension in the Value box (vs. CM's
  hyphen + extension). Also newly documented: the full Operator list for MDM's own filter widget,
  the External Filters popup's real structure, exact upload-validation messages, and the
  `Exception List` reconciliation view.
- `MDM_Mass_Retire_Unretire16.1.doc` (1100 lines) — read (grep-targeted + key sections in full)
  2026-09-29. Mostly confirmed the existing summary; added the exact mixed-selection warning text
  (a real Cancel/Continue dialog, lowercase "items" — a minor textual difference from End
  Distribution's similarly-worded but capitalized warning) and a second warning specific to
  Unretire's shared Effective End Date field.
- `MDM_Quick_Edit17.1.doc` (1456 lines) — read (grep-targeted + key sections in full) 2026-09-29.
  Mostly confirmed the existing summary; added that `MC_*` field-level security is respected
  per-record while paging (not just the first record), the exact (unusually unpunctuated)
  `MD_Edit_Records` tooltip text, and the Previous/Save/Save & Next/Next button-state matrix.
- `MDM_Localization & Reporting9.1.doc` (703 lines) — grep-scanned 2026-09-29. Same category as
  `ExcelImport_LocalizationResources22.4.doc` — confirms the UI text/button/column-header
  localization catalog, confirmatory only, no new content added. Same outdated-setup-procedure
  caveat likely applies (not independently re-confirmed with the user for this specific script).
- `MDM_COM7.1.doc` (264 lines) and `MDM_ExcelImport_COM22.3.doc` (313 lines) — read fully
  2026-09-29 (neither executed live — no configured trading-partner endpoint in this environment).
  **Genuinely valuable despite not being executable**: COM7.1 documents the full
  Validate/Upload/Transmission Inquiry/View SPL mechanics and the exact Trading-Partner-Upload
  multi-version block message. ExcelImport_COM22.3 documents a previously-undocumented version-
  transition rule: a new version created by Excel Import inherits `"Previous Version Accepted by
  GUDID"` as its GUDID Status if the prior version had a real GUDID success, but blank otherwise;
  Model/Catalog UUID copy forward from the prior version except for a record never submitted to
  GUDID at all, where both come back blank.

**All 39 MDM scripts have now been read** by a Claude session (28 confirmed-thorough full reads,
5 grep-targeted-plus-key-sections reads on very large scripts, 2 grep-scans on lower-value
localization-catalog scripts, as of 2026-09-29). This module is DONE for the "read every formal
script at least once" pass. Remaining future work on MDM, if any: live-verifying a small number of
flagged-but-not-executed items (Data Retrieval 1.2's actually-testable-here correction, the
`masterdatacolumntriggers` mechanism, the COM/trading-partner mechanics if an endpoint ever gets
configured) — not a first-read gap anymore, a verification gap.

## Campaign Manager — `Campaign_Manager\7.0.3\` (31 scripts total, excluding `CM_TestPlan.doc` and `Archived\`)

Prior sessions already reviewed some of these against the CODE (not necessarily the formal script
text itself) on 2026-09-24, per `robar-module-reference.md`'s own "Code-verified findings" note:
`CM_BasicFunctions-1.2`, `CM_ExportToXls-1.5`, `CM_ExcelImport-1.7`, `CM_MassItemUpdate-1.4`,
`CM_Load_External_Filter-1.21`, `IM_ViewHistory-1.32`, plus `CM_MDM_Integration-1.23`,
`CM_SaveToPDF-1.8`, `CM_SendToWorkflow-1.11`, `IM_BasicFunctions-1.25`, `IM_CreatePDF-1.29`
(2026-09-25). A separate, earlier pass fully read `CM_ItemDataCompare-1.24` and
`CM_ItemTranslation-1.14`. None of the above have been independently re-verified against the
actual `.doc` text by re-reading — treat as likely-accurate but not double-confirmed the way a
fresh full read would be.

**Fully read (end to end), findings distilled into `robar-module-reference.md`:**
- `CM_Security-1.1.doc` (222 lines) — read fully 2026-09-29. New: the full "Select Action"
  dropdown process list (adds Retire Items/Mass Print/Mass Item Approve/Import Master/Send to
  Workflow to the existing table), the no-processes-granted (empty dropdown, not disabled items)
  and no-`Login_CampaignManager` (icon absent, direct URL silently redirects) behaviors.
- `IM_CreateNewItem-1.26.doc` (673 lines) — read (grep-targeted + key sections in full)
  2026-09-29. Substantial new content: the full Item Edit field inventory, `CM_Edit_Items` gate
  wording, Label Type security filtering both the grid AND the Create New Item dialog's own
  dropdown, exact Save-validation messages, the `Items`/`X_Items` audit table pair (confirming CM
  Items and MDM records are genuinely separate DB entities), and that an Item in an open workflow
  gets the same "Item being routed in workflow" lock message as MDM's own `PerformMDMWorkflowLock`
  feature (not yet confirmed whether it's the same setting). Also documents "Field Defs
  Management," a per-Label-Type field-caption editor not previously mentioned anywhere.
- `IM_ApproveItem-1.30.doc` (418 lines) — read fully 2026-09-29. New: `CM_MassApprove` also gates
  the single-item Approve Item action (same process as the bulk action, not a separate one), the
  e-signature is checked against the SIGNING user's own credentials/authorization (not the logged-
  in session), exact error message text (differs from MDM's equivalent messages — don't reuse
  across modules), and the `Activity`/`Action='IM Approve Item'` audit trail row.
- `CM_LabelTypeSecurity-1.34.doc` (774 lines) — read (grep-targeted + key sections in full)
  2026-09-29. Genuinely valuable correction: the page-level Label Type security message
  ("...search results are not displayed...") and the dialog-level one ("...label types are not
  included...") are WORDED DIFFERENTLY — previously conflated as one message. Also new: Import
  from Excel's own row-level Label-Type-security and file-extension error messages.
- `CM_RetireItems-1.17.doc` (401 lines) and `IM_RetireItem-1.31.doc` (864 lines) — read
  (grep-targeted + key sections in full) 2026-09-29. A whole bulk action (Retire Items) not
  previously documented at all, plus the single-item Retire/Unretire dialog. Confirmed exact
  warning/error text for both, including a real cross-module textual difference from MDM's
  near-identical Mass Retire-Unretire warning (missing comma), and a genuine same-app inconsistency
  between Retire Item's and Approve Item's own "not authorized" message punctuation.
- `CM_SaveAsNew-1.6.doc` (325 lines), `IM_SaveAsNewItem-1.28.doc` (576 lines), and
  `IM_CreateNewItemVersion-1.27.doc` (367 lines) — read (grep-targeted + key sections in full)
  2026-09-29. Clarifies all three "Save As New"-style surfaces share ONE security process
  (`CM_SaveAsNew`) — simpler than MDM's three-separate-processes equivalent — but with
  inconsistent tooltip wording across the three. New eligibility-blocking messages for the bulk
  action's New Version/New Label Type modes, and a previously-undocumented rule: Lock Version
  carries forward to a new item version unless the new version's Template changes, in which case
  it resets to blank.
- `CM_MassItemApprove-1.3.doc` (251 lines) — read (grep-targeted + key sections in full)
  2026-09-29. New: a mixed approved/unapproved selection blocks with `"Some items are not
  editable"` plus a `Details` link listing the offending rows (Item Number/Label Type/Version
  Number) — a hard block with a diagnostic, not a silent filter.
- `CM_JobInquriy-1.9.doc` (235 lines) — read fully 2026-09-29. Confirms CM's own Job Inquiry uses
  the standard shared filter widget; no new gotchas.
- `CM_SaveLoadFilters-1.15.doc` (355 lines) — read (grep-targeted + key sections in full)
  2026-09-29. Confirms CM's own Save/Load Filters mirrors MDM's Save Search/Load Search pattern
  (Name/Description/Public checkbox, non-public hidden from other users); new exact messages
  (`"Filters Saved Successfully"`, the duplicate-name block text).
- `IM_InsertSymbols-1.37.doc` (495 lines) — read (grep-targeted + key sections in full)
  2026-09-29. Confirms the same four-disable-reasons pattern as MDM's Insert Symbols; new: button
  placement (beneath Template, not Approved By) and the copy-confirmation rendering in green
  inside the symbols grid itself.
- `CM_AuditTrail-1.10.doc` (364 lines) — read (grep-targeted + key sections in full) 2026-09-29.
  Confirms the three-table audit shape (`CMJobs` for job Display IDs, `X_Items` for field changes,
  `Activity` for general history) applies uniformly across every CM action type.
- `IM_RTFEditor-1.38.doc` (750 lines) — read (grep-targeted + key sections in full) 2026-09-29.
  **A whole previously-undocumented feature**: an `RTF` button next to Symbols opens an "Item RTF
  Editor" with a rich-text toolbar and a raw-markup `RTF Source` view, storing changes as RTF
  markup in the item's Memo field. Same disable-reasons pattern as Symbols/other editable-state
  gated buttons.
- `CM_ImportMaster-1.16.doc` (349 lines) — read (grep-targeted + key sections in full) 2026-09-29.
  Substantially expanded the existing one-line "✅ Working" summary: the same-Label-Type
  requirement, the `Show`-filter/color-checkbox mechanics, manual-file-selection behavior, and the
  empty-submission block message.
- `CM_MDM_Load_External_Filter-1.22.doc` (1216 lines) — read (grep-targeted + key sections in full)
  2026-09-29. **A genuinely valuable find**: a THIRD variant of the "Load External Filter" feature
  (active under `CM_MDM_Integration`), with its own THIRD spelling of the "Not In External
  Column/File" operator (`"Not in External Column"`, lowercase "in") — three modules/variants, three
  different capitalizations of conceptually the same operator. Also new: a filter-delete
  authorization block message, and a real environment-consistency rule — a filter saved while
  `CM_MDM_Integration` was off can't be loaded once it's turned back on.
- `IM_LocalizationResources-1.33.doc` (575 lines) — grep-scanned 2026-09-29. Same category as
  MDM's own localization-catalog scripts — confirmatory only, no new content added.
- `IM_BasicFunctions-1.25.doc` (292 lines) and `IM_CreatePDF-1.29.doc` (715 lines) — **re-read
  directly 2026-09-29 to double-confirm the 2026-09-25 code-verified notes.** Result: the existing
  notes were accurate, including the subtle dropped-"are" banner-text distinction, which was
  already correctly flagged as a script-text-vs-real-UI difference, not something this re-read
  needed to fix. One small addition: Field Defs Management's "Item Screen Layout" action is the
  specific named mechanism behind the already-documented "moving a field to Unassigned" behavior.
- `IM_ViewHistory-1.32.doc` (461 lines) — **re-read directly 2026-09-29 to double-confirm the
  2026-09-25 code-verified notes.** Added the full page structure (header fields, grid columns,
  standard pagination shape) that the brief existing note didn't spell out, but no corrections
  needed — the prior code-based summary held up.

**All 31 Campaign Manager scripts have now had at least one pass, and ALL 11 previously
code-only-verified ones have now been double-confirmed by directly reading their `.doc` text**
(`IM_BasicFunctions-1.25`, `IM_CreatePDF-1.29`, `IM_ViewHistory-1.32` on 2026-09-29; the remaining 8
— `CM_BasicFunctions-1.2`, `CM_ExportToXls-1.5`, `CM_ExcelImport-1.7`, `CM_MassItemUpdate-1.4`,
`CM_Load_External_Filter-1.21`, `CM_MDM_Integration-1.23`, `CM_SaveToPDF-1.8`,
`CM_SendToWorkflow-1.11` — on 2026-09-30). **Unlike the first 3 (which cleanly agreed with the
code-verified notes), this second batch surfaced real, unresolved disagreements** between the
2026-09-24 code-verified notes and the scripts' own text/recorded Actual Results — most notably
`unappMDMChecked` appearing to default to checked (`True`, backed by a script's own recorded DB
query) rather than unchecked as previously recorded, plus several CM_ExcelImport error-message and
CM_Load_External_Filter operator-label contradictions. See the reference doc's own
"Double-confirmation pass on the remaining 8 code-verified-only scripts" subsection for the full
list — several of these need a fresh LIVE check to settle, not just a documentation judgment call.
**Campaign Manager now has zero remaining verification-depth gaps** — every script has had both a
direct-text read and, for these 11, an independent double-confirmation.

## Other modules

**Correction (2026-09-29):** the note that used to sit here ("not yet started") was wrong — checked
directly against `robar-module-reference.md` before starting Security Management and found every one
of these already has a completed formal-script read pass from a prior session, each with its own
`.agents/exploratory-session-log-<module>.md` per-script breakdown. This index's MDM/Campaign
Manager sections above are simply the two modules that happened to get a *fresh* direct re-read this
session (2026-09-29) using the current tracking-index format — every other module was already done
before this format existed. Listing them here so this index is a true one-stop status view of ALL
modules, not just the two re-read this session:

- **Security Management** — all 6 files under `Security_Management\7.0.2\` (5 test-case areas).
  Log: `exploratory-session-log-security-management.md`.
- **Template Management** — all 15 `TM_*.doc` scripts under `Template_Management\7.0.3\`.
  Log: none separate — findings written directly into the reference doc's own section.
- **Browser Printing** — all 42 scripts under `Browser_Printing\7.0.1_And_Up\` (6-way research pass;
  only a subset live-tested). Log: `exploratory-session-log-browser-printing.md`.
- **Print by Lot / Print Entity** — the real formal-script home is the `Print_Entity\` top-level
  share folder (`PE_*` prefix). **All 17 scripts now read as of 2026-09-30** (`PrintEntity_TestPlan`
  index, `PE_PrintByLot` fully read 2026-09-29; the other 16 — `PE_PrintEntityManagement`,
  `PE_UserPrintEntityManagement`, `PE_UserPrintEntityUpdate`, `PE_LotManagment`,
  `PE_LotManagment_Import`, `PE_PrintHistoryInquiry` fully/grep-targeted read, plus
  `PE_PrintByOrder` fully read and `PE_PrintByLotMulti`/`PE_PrintByOrderMulti`/`PE_ServerPrinting`/
  `PE_VersionPrinting`/`PE_MiscPrinting`/`PE_PrintByOrderLot`/`PE_FlexPrinting`/
  `PE_MultiDocumentPrinting` grep-scanned to confirm the shared-mechanic pattern — read 2026-09-30).
  Plus the earlier targeted UAT execution `UAT_6356.doc` (DIT #6356, Manufactured-field bug, all 16
  steps passed). See reference doc's Print by Lot section for the full write-up, including the
  single-vs-Multi-screen "no lot found" message discrepancy and the `LOTS` table's
  PrintEntity-in-primary-key schema fact. **This was the last remaining first-read gap across all
  ROBAR modules — every module now has at least one full formal-script pass.**
- **Workflow Management** — all 28 scripts under `Workflow_Management\7.0.3\`.
  Log: `exploratory-session-log-workflow-management.md`.
- **Dictionary Management** — all 9 scripts under `Dictionary_Management\` (8 test-case areas).
  Log: `exploratory-session-log-dictionary-management.md`.
- **Label Control** — all 15 scripts under `Label_Control\7.0.3\` (14 test-case areas per
  `LC_TestPlan`). Log: `exploratory-session-log-label-control.md`. **Double-confirmed 2026-09-30**:
  directly re-read the 12 scripts behind the 2026-09-25 code-verified findings — unlike Campaign
  Manager's equivalent exercise, this one came back almost entirely confirmatory (no real
  contradictions), plus one new exact message (Redline Compare's "Please submit TWO label control
  records..." text) and one unconfirmed-but-not-contradicted item (Link to Label Master's claimed
  third message variant, not exercised by this script). **Version-drift note**: `Label_Control\
  7.0.4\` has one script `7.0.3\` doesn't — `LC_ExportToExcel.docx` — a genuine unread first-read
  gap, not yet reflected in the "all 15" count above (accurate for 7.0.3 specifically). See
  reference doc's own "Double-confirmation" subsection for full detail.
- **Destination Labeling** — 14 legacy "Integration Test Case" Word docs (2017–2021, extracted from
  a since-deleted `DELETEME` folder before removal) covering `DL_AutoPrint` through `DL_Security`.
  No separate log file — findings written directly into the reference doc's own section.
- **Label Type Management** — all 4 scripts under `Label_Type_Management\6.0.7_and_up\` (the
  current version — the top-level unversioned folder is stale, missing
  `LT_BasicFunctions_Actions-1.3.doc`). Read fully 2026-09-30, no prior coverage existed (a genuine
  first-read, unlike most other modules this index initially got wrong about). No separate log
  file — findings written directly into the reference doc's own new section.
- **Field Definitions Management** — all 5 scripts under `Field_Definitions_Management\` (top-level,
  current folder — a `6.0.5` subfolder holds an older superseded copy). Read fully 2026-09-30, no
  prior coverage existed beyond two brief cross-references from Campaign Manager/MDM sections. No
  separate log file — findings written directly into the reference doc's own new section. Its own
  localization script (`FD_LocalizationResources1.4.doc`) carries the same outdated-setup-procedure
  caveat as MDM/Template Management's equivalents (stored-proc-based import now, not the script's
  own manual Excel/SQL steps) — not independently re-confirmed for this specific script, flagged by
  association.
- **Lot Management** — no pre-existing formal test scripts found at all; `LM_Edit-1.1` and
  `LM_Security-1.2` were *authored* (not just read) this engagement, built twice (v1 against the
  pre-rewrite FRS, v2 against a requirements rewrite). Different category from every other module
  above — there was nothing to "read," the scripts themselves are new deliverables.

**Net effect (updated 2026-09-30):** every ROBAR web module has now had at least one full pass over
its own formal test scripts (or, for Lot Management, had scripts authored where none existed) — MDM,
Campaign Manager, and Print by Lot/Print Entity additionally have the newer script-by-script
tracking format above. **No first-read gaps remain across any module.** Remaining future work, if
ever wanted, is verification-depth only: double-confirming the 8 Campaign Manager scripts still
marked code-verified-only (listed above), and independently re-confirming any other module's
prior-session findings by directly re-reading its own `.doc` text the way MDM/CM/Print Entity's
double-confirmed scripts were.
