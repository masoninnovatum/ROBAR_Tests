# ROBAR Module Reference

Consolidated knowledge about how individual ROBAR/Innovatum Suite 7 modules actually behave,
built from formal QA test scripts (network share `\\diskstation\backedup\#Unlocked_Test_Cases\`)
and live exploratory testing against `http://vmsrvtst703/innovatum/WebMenu/`. This is a *behavior*
reference, not a code reference — it captures what the UI does, what fields are required, what
security processes gate what, and which behaviors have been confirmed as bugs vs. confirmed as
correct-but-surprising.

**Maintenance convention:** whenever formal test scripts for a ROBAR module are provided for
review, or a live exploratory testing session against a module is completed, add or update that
module's section here with what was learned — field lists, required-field gotchas, security
process names, confirmed bugs, and anything a future session would otherwise have to rediscover
by re-reading the scripts or re-testing live. See `CLAUDE.md` for the standing instruction that
established this.

Session logs with full step-by-step detail and screenshots-in-spirit live alongside this file as
`.agents/exploratory-session-log-*.md` — this document is the distilled, load-bearing summary;
those are the raw record.

**Cross-project note (2026-09-29):** this file is deliberately project-independent — it lives here
regardless of which specific ROBAR build/checkout a given Claude Code project points at (a new
project gets created for each new build, e.g. `703_20198` today, a future build's own project
later). **Any Claude session doing ROBAR/Innovatum Suite 7 work, in any project, should read this
file (and its companion `.agents/formal-scripts-reviewed.md`, tracking which formal test scripts
have actually been read end-to-end) before starting module-specific work**, and add to both as
part of any exploratory/live-testing or formal-script-reading session — not to a project-scoped
memory file, which is invisible to every other project. If you're a session in a new project and
don't already know this file exists, it's worth asking the user or checking whether an `.agents/`
folder like this one is present in a sibling/parent checkout.

---

## Open To-Dos for Live/Exploratory Testing

Items below are **unresolved disagreements between two documentary sources** (a formal script's own
text/recorded Actual Result vs. a prior code-inspection pass) that could only be settled by actually
driving the live application and observing true current behavior. Whenever a future session does
exploratory or locator-focused testing (Playwright test-writing, MCP browser exploration, or manual
UAT execution) that happens to touch one of these areas, check the item live, then **update the
relevant module section below with the confirmed true behavior and remove the item from this list**
(or narrow it, if only partially resolved). Don't go looking for these proactively on their own — a
dedicated verification-only session is generally lower value than answering them as a side effect of
other work already touching that screen.

- **Campaign Manager — Send to Workflow's `unappMDMChecked` default state.** Is "Use Unapproved MDM
  Item" checked by default? `CM_SendToWorkflow-1.11.docx`'s own text (including a step recording a
  direct `LocalizationResourceDef` query) says **checked/`True`**; a 2026-09-24 code-inspection pass
  recorded it as **unchecked/`false`**. See Campaign Manager section, "Double-confirmation pass"
  subsection, for full detail. Check this the next time a Send to Workflow test/exploration touches
  the job submission page's MDM checkboxes.
- **Campaign Manager — Excel Import's exact error-message catalog.** `CM_ExcelImport-1.7.doc`'s own
  recorded Actual Results show `"Data not formatted correctly."` (plus a more specific
  `"...ApprovedBy must be blank."` variant) and `"Excel file has improper format..."` as genuinely
  observed; a 2026-09-24 code-inspection pass claimed these strings "do not exist" and recorded
  different text instead. Also unresolved from the same script: whether the Import from XLS job
  submission page has a visible Cancel button (the script's own recorded evidence is internally
  inconsistent on this), and whether the "no records" message says "Excel file" (singular) or "Excel
  Files" (plural, per this script's own text). Check next time an Excel Import test/exploration in
  Campaign Manager exercises validation-error paths.
- **Campaign Manager — Mass Item Update's numeric validation message wording.** Does it include the
  article "a" (`"Value can only be a positive number."`, per this script's own recorded Actual
  Result) or not (`"Value can only be positive number."`, per the 2026-09-24 code-inspection note,
  which matches this script's own Expected-column text instead of its Actual)? Check next time a
  Mass Item Update test/exploration hits a non-numeric-value validation case.
- **Campaign Manager — Load External Filter's operator label, specifically for the BASE
  (non-MDM-integration) variant.** `CM_Load_External_Filter-1.21.doc`'s own operator list reads
  `"Not in External Column"` (lowercase "in") consistently throughout; the 2026-09-24 code-inspection
  note attributed `"Not In External File"` to this exact script instead (reserving `"Not in External
  Column"` for the separate `CM_MDM_Load_External_Filter-1.22` MDM-integration variant). Check next
  time a Load External Filter test/exploration in Campaign Manager runs with `CM_MDM_Integration`
  GlobalSetting confirmed OFF, to see which label the base widget actually shows.
- **MDM — Data Retrieval 1.2's "may be testable here without a separate server" correction** (older,
  from 2026-09-29, MDM section) — flagged as re-attempted-live-needed, not yet done. Check next time
  an MDM Data Retrieval test/exploration comes up.
- **MDM — the `masterdatacolumntriggers` field-cascade mechanism** (2026-09-29, MDM section,
  `MDM_Data_Edit4.3.doc`) — documented from the script's text only, still not executed live (needs
  SQL seed access to set up a trigger row). Check if a future session gets SQL access for this kind
  of setup.
- **Label Control — `LC_ExportToExcel.docx`** (2026-09-30) — exists in `Label_Control\7.0.4\` but
  not `7.0.3\`, so never read at all. Check whether this environment's Label Control screen even has
  an Export to Excel action before assuming it applies here; read the script if it does.
- **AlphaNumeric Counter / DataMatrix feature — dedicated testing planned, not yet started**
  (flagged 2026-09-30 after the `Counter_DictPhrase_FieldName` incident above, now resolved) — the
  user wants focused testing of Counters functionality specifically at some point; no formal
  scripts for this have been identified/read yet. Check `Innovatum.PrintServer.Lib`'s
  `doDataMatrix`/`AlphaNumCounter` code (see Print by Lot section) and look for a dedicated
  `Counters`/`DataMatrix`/`AlphaNumeric` formal-script folder on the share drive when this comes up.
- **Label Control — Link to Label Master's third "could not link" message variant: RESOLVED
  2026-10-02.** `"Could not link to master. Matching label master record not found."` (no "or
  latest") is real: live-confirmed for a v1 record when only v0 has a Label Master and Use Latest is
  unchecked (see Bulk Actions row 5).
- **Campaign Manager — Item Edit's RTF Editor button, paused mid-exploration (2026-09-30).**
  Explicitly deprioritized by the user ("save it for later... it isn't something widely used by
  customers") after the native launch and window/control mechanics were already confirmed live, but
  before a working permanent test was finished. See the Campaign Manager section's own "RTF Editor
  — paused, resume later" write-up for everything already learned (control map, the real Save/
  Cancel semantics, the unsaved-changes dialog, variable spawn timing, the orphaned-native-window
  risk) so picking this back up doesn't re-discover any of it from scratch.

---

## Campaign Manager

**Purpose:** Browser-based bulk item/template management and printing workflow entry point.
Create items, approve them, and run bulk actions against selected grid rows.

**Test-suite mining pass (2026-09-30):** re-read `tests/support/campaign-manager.ts` and all 16
`Campaign-Manager/*.spec.ts` files end to end for hard-won automation/behavior findings not yet
distilled here (same exercise as Template Management's, per the user's request). Result: this
section (particularly the "Known testing-tooling limitations" bugs and the 11-bulk-actions table)
was already extremely thorough from earlier live-testing sessions — most of what these tests'
comments describe was already captured, sometimes in more detail than the tests themselves. Three
genuinely new/corrected items surfaced: (1) a previously-undocumented **concurrency hazard** —
Retrieve Items reads/writes per-ACCOUNT, not per-session, server-side query state, so two concurrent
logins as the same account can silently cross-contaminate results (see "Other confirmed findings"
below); (2) the Mass Item Update Submit-button bug this doc had marked "confirmed bug" was actually
**fixed** on 2026-09-11 — table corrected; (3) an old interactive-testing report of "Populate Phrase
never becomes enabled" (Item Translation) was independently re-disconfirmed via Playwright. This
suite is now considered fully mined, same status as Template Management's.

**Formal scripts reviewed:** `CM_ItemDataCompare-1.24`, `CM_ItemTranslation-1.14` (network share,
`Campaign_Manager\7.0.3\`). On 2026-09-24 these were also reviewed against the code while writing
UATs: `CM_BasicFunctions-1.2`, `CM_ExportToXls-1.5`, `CM_ExcelImport-1.7`, `CM_MassItemUpdate-1.4`,
`CM_Load_External_Filter-1.21`, and `IM_ViewHistory-1.32`.

### Code-verified findings (2026-09-24, while writing UATs)

**Processes**
- `Login_CampaignManager` gives access to Campaign Manager.
- Each action has a menu permission from `CMActions`, and some jobs check a second process on
  submit:

| Action | Menu permission | Also checked on submit |
|---|---|---|
| Export to XLS | `CM_SaveXLS` | `Edit_Multiple_Items` |
| Save to PDF | `CM_CreatePDF` | — |
| Mass Item Update | `CM_MassUpdate` | `Edit_Multiple_Items` (checked against the signer) |
| Excel Import button | `CM_ImportXLS` | `Edit_Multiple_Items` (checked against the signer) |
| Item Data Compare | `CM_ItemDataCompare` | — |
| Item Translation | `CM_ItemTranslation` | — |
| Delete external filters | `CM_DEL_ExternalFilters` | — |
| Retire Items | `CM_RetireItems` | — |
| Mass Print | `CM_MassPrint` | — |
| Mass Item Approve | `CM_MassApprove` | — |
| Import Master | `CM_ImportMaster` | — |
| Send to Workflow | `CM_WorkFlowSendTo*` | — |

- View History has **no** security process of its own.
- **Full read of `CM_Security-1.1.doc` (2026-09-29)**: with `Login_CampaignManager` granted but
  every action-level process blank, the module still opens but its "Select Action" dropdown shows
  **no actions at all** (empty, not disabled entries). With `Login_CampaignManager` itself blank,
  the module's icon doesn't render on the Main Menu at all, AND a direct URL to the module redirects
  back to Main Menu without ever showing it — no error page, just a silent redirect.
- **`CM_MassApprove` also gates the single-item "Approve Item" action on the Item Edit screen**
  (`IM_ApproveItem-1.30.doc`, full read 2026-09-29) — the same process as the bulk Mass Item
  Approve action, not a separate per-item process as the name might suggest.

**Basic functions**
- The query "No Items are selected" message has a capital I and no period.
- Limit Results accepts digits only, up to 4 of them. A blank value becomes 1 on blur.
- Query settings are saved per user on the server.
- The Save to PDF page uses "Subfolder", not "Path".
- The Column caption is "Template Name", not "Template".

**Excel Import**
- The button is never greyed out after Reset. It is simply hidden without `CM_ImportXLS`. The
  page has no Cancel button.
- An import is all or nothing: one bad row rolls back the whole import.
- Actual error strings:
  - "The worksheet name cannot be left blank."
  - "Excel file has no records in it."
  - "Excel file is not properly formatted." with the detail "Unable to query ItemNumber,
    LabelType, VersionNumber."
  - "Error during Save." with "The data is not properly formatted." for sheets with row errors.
- The script's "Data not formatted correctly" and "improper format" do not exist.

**Mass Item Update**
- The Column list removes only ItemNumber, VersionNumber and LabelType. It adds Locked Template
  Version, Active, Effective Begin and Effective End.
- Numeric validation message: "Value can only be positive number."
- The caption tooltip lists all label-type-specific captions as ` [a] [b]`.
- The signature labels render as the raw property names "UserName" / "ReasonCode" / "Comment",
  which is a possible cosmetic defect.
- On the item screen, Locked Template Version is a drop-down, not a checkbox.
- Script error: step 4.4 opens I01 after updating I04.

**Item Data Compare**
- Long values are truncated only when over **250** characters, using ASCII "...".
- The job page title uses a plain hyphen: "Item Data Compare - Job Details".
- The checkbox label is "Include intermediate changes".
- `ExcelRowLimit` is read for each job, so no restart is needed.

**Item Translation**
- `CM_ITDictLimit` has owner `LegacySettings`. It is cached, so changing it needs a ServiceHost
  restart.
- The error messages end with "." or ":".

**Load External Filter**
- The operator is "Not In External File", not "Not in External Column".
- After Add Filter the value reads "EXCEL1.xlsx - ItemNumber", with the file extension and a plain
  hyphen.
- **Possible defects:**
  - After an invalid Filter Selections Submit, Submit may stay disabled, so the tester must reopen
    the dialog.
  - Loading a saved filter set may display "EXCEL1.xlsx - EXCEL1.xlsx", because the WCF sets
    ColumnName to SourceName.
  - The CM_MDM_Integration load error is concatenated with no space ("filters.Use of Master
    Data…").
- External Filters activity rows are excluded from the InnoView Activity report.
- **MDM has its own, textually different version of this same feature** — see "Load External
  Filter" under Master Data Management below (different operator label, different Value-box
  format, an en dash vs. this module's hyphen). Don't reuse one module's exact string assertions
  for the other.
- **A THIRD variant exists specifically for MDM-integration-aware filtering, full read of
  `CM_MDM_Load_External_Filter-1.22.doc` (2026-09-29)** — active when the `CM_MDM_Integration`
  GlobalSetting is enabled. Its own operator list spells the concept **`"Not in External Column"`**
  (lowercase "in") — a THIRD distinct capitalization from this module's own `"Not In External
  File"` and MDM's `"Not In External Column"`. Same file-upload validation messages as MDM's
  version (`"File extension is not allowed"`, `"The file selected is invalid and cannot be
  uploaded"`, `"Only one file can be selected when adding a filter..."` — this one IS worded
  identically across modules, unlike the operator label). New: deleting a filter you're not
  authorized for blocks with `"You have selected filters to delete to which you are not
  authorized"`, and **a filter saved while `CM_MDM_Integration` was disabled cannot be loaded once
  it's re-enabled** — a real environment-consistency rule, not just a permissions check.

**CM_MDM_Integration, Save to PDF, and Send to Workflow** (code-verified 2026-09-25)

MDM Integration:
- The prefixes use an ASCII hyphen: "Item - " and "MD - ", not the en dash the scripts show.
- `CM_MDM_Integration` is cached in ServiceHost, so a change needs a ServiceHost restart as well as
  IISRESET. Script 1.23 step 1.7 only does IISRESET.
- A user with no `SCH_*` processes gets a Schema Security page with the "All schemas have been
  disallowed…" message.
- With "MDM Approved Only" checked, the query is an INNER JOIN to approved, effective master data.
  Items without it drop out of the grid.
- `Err_WrongFilterState` fires in both directions (N→Y and Y→N).

Save to PDF:
- Page titles use a hyphen or em dash: "Job Submission - Create PDF" and "Job Detail — Create PDF".
- The message reads "...select the check box to proceed...".
- "User not authorized for this task: CM_SaveToPDFUnapproved" has no trailing period. Script step
  7.3 adds one.
- The expiration precedence is: MD shelf life (MDShelfLife_*), then the item field
  (ShelfLifeFieldName), then the field-definition sample data, then 1D.
- The dictionary results depend on `DictionaryOnlyEffective`=Y, which the script doesn't list.
- "F1.pdf" as a Filename becomes "F1.pdf.pdf".
- Possible defects: the undefined JS function `checkForNoApprovedTemplates()`, and label `for=`
  IDs that don't match their checkboxes.

Send to Workflow:
- The processes are spelled `CM_WorkFlowSendTo*`, with a capital F.
- Error format: "User not authorized for this task. : CM_WorkFlowSendTo_UnAppLabel".
- The shipped `unappMDMChecked` is **false**, so "Use Unapproved MDM Item" is not checked by
  default.
- Shipped defaults: AutoCreateLabelControl=N, AttachMDMDataToWorkflow=N, and
  SupplementalPrimaryAttachment blank. `AutoLinkMasterLCN` is unused.
- The master data message is "Master data does not exist for some of the selected records."
  (lowercase "data").
- The Redline or CDR attachment is chosen **at submit time** from SupplementalPrimaryAttachment.
  The script changes the setting and then inspects workflows created earlier, which won't reflect
  the change.
- Workflow Management labels: the bulk action is "View And Vote" and the tab is "Comments &
  History".
- The MDM Excel file is `Item_MDM_{Item}.xlsx`. Its schema columns use ViewColumnName, not the
  caption.
- There is no item limit per submission.

**IM_BasicFunctions and IM_CreatePDF** (code-verified 2026-09-25)

Label type security (BasicFunctions):
- The banner text is "Some search results are not displayed due to label type security." (the
  script drops "are").
- It shows whenever the user lacks an `LT_*` process for any label type — set once per page
  load — not only when the current query would have returned a hidden item.
- Unauthorized label types are filtered out of the grid at the SQL level and out of the "Field
  Definitions for Label Type" list; querying one directly just gives "No records to view", not an
  authorization error.
- Moving a field to Unassigned removes it from Available Fields and the Column list for that
  label type only.

Item Edit PDF button (CreatePDF):
- The dialog's radios/checkboxes: "Latest Approved Template Version", "Select Template Version",
  "Use Unapproved Dictionary Entries", "Allow Unapproved MDM". All confirmed exact.
- "Template is required." is live Knockout validation on the Template field itself. Since the PDF
  button is disabled whenever Template is blank, you can't reach that message by clicking PDF —
  it appears when the field is cleared.
- "No approved effective template version found." is the tooltip text when no approved+effective
  version exists; the radio is then disabled and "Select Template Version" is auto-selected.
- The PDF read the page's live Template selection, not the saved DB value, so it works on an
  unsaved item.
- An approved-but-ineffective version is skipped by the DB query itself (`LabelsRepository.
  GetLatest`), falling through to the next approved+effective version.
- Dictionary effectiveness filtering (`DictionaryOnlyEffective`) applies regardless of the
  Unapproved Dictionary checkbox — same as Save to PDF.
- No PDF-specific security process gates the button; access depends only on reaching Item Edit.
- "Allow Unapproved MDM" always renders on this dialog; it does not depend on
  `CM_MDM_Integration`.

**Item Change History**
- Labels on the page are "Version" and "Template". The filter defaults are "(Select User)" and
  "(Select Field)".
- Start Date defaults to the first change date.
- Moving a field to Unassigned in Item Screen Layout does not affect the history.
- **Full page structure, confirmed via full read of `IM_ViewHistory-1.32.doc` (2026-09-29)**:
  header shows Item Number, Version Number, Label Type, Template Name, Description; filters are
  Change User / Changed Field dropdowns + Start Date / End Date; grid columns are Change Date,
  Change User, Changed Field, Value Before, Value After — with the same pagination shape used
  throughout this app (Page X of X, a 10/20/30 record-count dropdown defaulting to 10, "View X-X
  of X records"). The "Changed Field" dropdown is populated from whatever fields actually have
  recorded changes for that item (confirmed: `Template Name`/`Description`/`Facility`/
  `ApprovalDateTime`/`Approved By` all appeared after edits touching each).
- **`IM_BasicFunctions-1.25.doc` and `IM_CreatePDF-1.29.doc` re-read directly (2026-09-29) —
  confirmed the existing "code-verified" notes above are accurate**, including the subtle
  "are"/dropped-"are" banner-text distinction already correctly called out — this was NOT a new
  discrepancy, the prior session had already caught it. Genuinely new detail from BasicFunctions:
  Field Defs Management's "Item Screen Layout" action (moving a field to the Unassigned tab) is
  what actually removes it from Available Fields/Column dropdowns — a specific named mechanism for
  the already-documented "moving a field to Unassigned" behavior.

### Double-confirmation pass on the remaining 8 code-verified-only scripts (2026-09-30)
Directly read all 8 scripts' own `.doc` text (`CM_BasicFunctions-1.2`, `CM_ExportToXls-1.5`,
`CM_ExcelImport-1.7`, `CM_MassItemUpdate-1.4`, `CM_Load_External_Filter-1.21`,
`CM_MDM_Integration-1.23`, `CM_SaveToPDF-1.8`, `CM_SendToWorkflow-1.11`) to double-confirm the
2026-09-24/25 code-verified notes above, the same way MDM/CM's other scripts were double-confirmed
earlier. **Unlike those earlier double-confirmations (which all agreed with no corrections needed),
this pass surfaced several real disagreements between the 2026-09-24 code-verified notes and either
the script's own text or its historically-recorded Actual Result column — worth trusting over the
code-verified notes where they conflict, since an executed script's Actual Result is a real tester's
first-hand observation, not a re-derivation:**

- **`unappMDMChecked` is checked (`True`) by default, not unchecked as previously recorded.**
  `CM_SendToWorkflow-1.11.docx` states "Use Unapproved MDM Item" is "selected by default" in at
  least six separate steps (Expected AND Actual columns agree throughout), and one step has the
  tester directly querying `LocalizationResourceDef` for `ResourceKey='unappMDMChecked'` and
  recording the result as `'True'`. This directly contradicts the existing note ("The shipped
  `unappMDMChecked` is **false**, so 'Use Unapproved MDM Item' is not checked by default") —
  **corrected**: treat the checkbox as checked by default unless a live re-check says otherwise;
  the direct DB-query evidence here is about as strong as this kind of finding gets.
- **CM_ExcelImport-1.7's own error-message catalog contradicts the prior "these don't exist"
  claim.** The existing note states the script's `"Data not formatted correctly"` and `"improper
  format"` strings "do not exist" (implying different real messages were found in code). But
  `CM_ExcelImport-1.7.doc`'s own Actual Result column repeatedly confirms `"Data not formatted
  correctly."` as genuinely observed (including a more specific variant, `"Data not formatted
  correctly: ApprovedBy must be blank."`, not previously documented at all) and `"Excel file has
  improper format. Unable to query Item Number, Label Type, Version Number."` as genuinely
  observed too. Also: the "no records" message reads `"Excel Files has no records in it."` (plural
  "Files") in this script, not the singular "Excel file" the code-verified note recorded. **Flagging
  as an open, unresolved discrepancy rather than picking a side** — both a code inspection and a
  script's recorded Actual Result are strong evidence types; this needs a fresh live check to
  settle, not a documentation-only judgment call. Separately, this script's own recorded Actual
  Result for the Job Submission page **does list a visible "Cancel" button** in one step (3.1) but
  drops it in another (1.3) — the existing "the page has no Cancel button" claim isn't cleanly
  supported by this script's own executed evidence either; also unresolved.
- **CM_MassItemUpdate-1.4's numeric validation message includes the article "a."** The script's own
  Actual Result reads `"Value can only be a positive number."` — the existing note recorded it
  without "a" (`"Value can only be positive number."`, matching this script's Expected-column text,
  not its Actual). **Corrected** to include "a" per the tester's actual recorded observation.
- **CM_Load_External_Filter-1.21's own operator list uses `"Not in External Column"` (lowercase
  "in"), not `"Not In External File"`** — appearing consistently in both Expected and Actual for
  this specific script. The existing note attributed `"Not In External File"` to this script
  (1.21) and `"Not in External Column"` only to the separate MDM-integration variant
  (`CM_MDM_Load_External_Filter-1.22`). Since this script's own operator list literally reads `"Not
  in External Column"`, either `CM_MDM_Integration` was active when 1.21 was written/last executed
  (making its own operator list reflect the MDM-integration variant despite being the "base"
  script), or the 2026-09-24 code note mixed the two scripts up. **Flagging as unresolved** — worth
  a live check with `CM_MDM_Integration` confirmed OFF to see which operator label the base,
  non-MDM-integration filter widget actually shows.
- **"Save to PDF uses 'Subfolder', not 'Path'" was miscategorized** — this finding is about
  `CM_SaveToPDF-1.8` (confirmed: "Subfolder" appears dozens of times throughout that script's own
  text), not a Basic Functions finding as the existing bullet list implied by grouping. Moved under
  Save to PDF's own heading above; no factual correction, just a filing fix.
- **Everything else in the 8 scripts' existing notes held up as accurate on direct re-read**,
  including several already-flagged internal script inconsistencies that this pass independently
  re-confirmed rather than contradicted: `CM_SaveToPDFUnapproved`'s trailing-period inconsistency
  (present in some steps, absent in others — matches the existing "script step 7.3 adds one" note),
  the `CM_WorkFlowSendTo_UnAppLabel` message's punctuation varying across at least three forms
  across different steps (`.  :`, `. :`, `.:` — further evidence exact punctuation isn't reliable
  here, don't assert on it precisely), the Locked Template Version checkbox-vs-dropdown distinction
  (genuinely two different controls on two different screens, not a contradiction), and
  `CM_BasicFunctions-1.2`'s own step 1.7/1.8 inconsistency using "Template Name" then "Template" for
  the same field (independently reconfirms the existing "caption is 'Template Name,' not
  'Template'" finding, with the script's own self-contradiction as supporting evidence).
  `CM_ExportToXls-1.5` had nothing to double-confirm beyond what's already documented (its own text
  doesn't test any of the specific claims attributed to it) — reads as accurate but thin.
- **One new, not-previously-documented detail**: `CM_MDM_Integration-1.23`'s own "Item –"/"MD –"
  prefix examples mix a plain hyphen and an en dash inconsistently within the SAME script (e.g.
  `"Item - Item Number"` next to `"Item – Version Number"`) — supports the existing "scripts show
  the en dash, code uses ASCII hyphen" note, but as an internal-inconsistency artifact rather than a
  clean single counter-example.

### Create/Edit/Approve Item — business rules (full read of `IM_CreateNewItem-1.26.doc` and `IM_ApproveItem-1.30.doc`, 2026-09-29)
- **Item Edit page's full field inventory, confirmed exactly**: Item Number, Version, Label Type,
  Description textbox, Template dropdown, PDF button, Lock Version dropdown, Effective Begin date
  field, Effective End date field, Allow Print checkbox, Approved By, Approval Date Time, and the
  Actions dropdown. `Lock Version` renders disabled on a brand-new item.
- **`CM_Edit_Items` gates opening an item for edit** — missing it shows a tooltip (note the
  punctuation: `"User not authorized for this task CM_Edit_Items"`, no period/colon before the
  process name, matching MDM's Quick Edit tooltip style rather than most other `MD_*`/`CM_*`
  messages which do have one).
- **Label Type security (`LT_<LabelType>`) filters BOTH the main grid's search results AND the
  Create New Item dialog's own Label Type dropdown** — partial access shows `"Some search results
  are not displayed due to label type security"` on the main page, and the unauthorized label type
  simply doesn't appear as an option when creating a new item, same red/yellow-icon family as
  schema/field security elsewhere in this app. **Confirmed via full read of
  `CM_LabelTypeSecurity-1.34.doc` (2026-09-29): the dialog-level message is WORDED DIFFERENTLY from
  the page-level one** — Create New Item, Save As New Item/Label Type, and Import from Excel's own
  job submission page all show `"Some label types are not included due to label type security"`
  (not the main grid's `"...search results are not displayed..."` text) — don't conflate the two
  exact strings when asserting on either. Import from Excel additionally reports row-level errors
  for a disallowed label type: `"Label Type is disallowed due to label type security."`, and
  separately for a file whose extension doesn't match the label type's configuration: `"Label type
  does not contain a supported file extension."`
- **Save-blocking validation confirmed exact**: `"Description is required."` and `"Template is
  required."` (client-side, Save blocked until both are filled). Duplicate Item
  Number+Label Type combination: `"Item already exists"`.
- **Audit trail**: current records in `Items`, history in `X_Items` (`ChangeType`: `'A'`=Add,
  `'C'`=Change) — a distinct table pair from MDM's own `ItemHeaders`/`X_ItemHeaders`, reinforcing
  that a Campaign Manager Item and an MDM record are genuinely separate entities in the DB, not
  just conceptually (see the MDM section's own note on this).
- **A Campaign Manager Item currently in an open workflow is locked with the exact same message
  wording as MDM's `PerformMDMWorkflowLock` feature** — `"Item being routed in workflow – cannot
  be modified"` — appearing directly on the Item Edit screen and disabling Approve Item. This
  reads like the identical lock concept applied to the Item itself, not just its linked MDM
  record; worth confirming later whether it's the same GlobalSetting or an unconditional,
  always-on product rule for Items specifically (not yet determined from these two scripts alone).
- **Approve Item's e-signature is checked against the SIGNING credentials, not the logged-in
  session** — confirmed live: staying logged in as an authorized user but entering a DIFFERENT,
  unauthorized user's correct credentials in the signature dialog still blocks with `"User not
  authorized for this task.CM_MassApprove"` (note: no space before the process name — a genuine,
  separate punctuation quirk from the tooltip version above). A wrong password shows `"Invalid
  Username or Password"` — worded differently from MDM's own `"Invalid Username/Password. UserID:
  X"` for the equivalent case; don't reuse one module's exact string for the other. Required-field
  client validation: `"This field is required."` for blank Username/Password.
  Audit trail: `Activity` table, `Action = 'IM Approve Item'`.
- **Field Defs Management** (a separate module, per-Label-Type field caption editor): renaming a
  field's caption there is reflected live on the Item Edit page for every item of that label type
  — the same "shared field/caption definition" pattern MDM's own Schema field captions use, just
  scoped by Label Type instead of Schema.
- **Insert Symbols** (Item Edit, full read of `IM_InsertSymbols-1.37.doc`, 2026-09-29): button sits
  beneath the Template dropdown (not beneath Approved By, unlike MDM's placement), same
  live-sourced-from-Codes-Management and same four disable reasons (uneditable/approved/retired/
  workflow-locked) as MDM's version. Copy confirmation renders **in green, directly inside the
  symbols grid itself** (`"'X' Copied to Clipboard"`) rather than a generic toast.
- **RTF Editor** (Item Edit, full read of `IM_RTFEditor-1.38.doc`, 2026-09-29) — previously
  undocumented: an `RTF` button next to Symbols (same beneath-Template placement, same
  editable/approved/retired/workflow-lock disable rules) opens an "Item RTF Editor" window with a
  rich-text toolbar plus an `RTF Source` button for viewing/editing the raw RTF markup directly.
  Saved changes are stored as raw RTF markup in the corresponding item Memo field.

  **PDF and Insert Symbols confirmed live end-to-end, 2026-09-30** (`Item_PDF_and_Symbols.spec.ts`
  — pure browser, no native automation needed for either): `#viewPDFBtn` only needs a Template set
  (works on an approved OR unapproved item); clicking it opens a jQuery UI dialog
  (`#viewPDFDialog`), whose Submit GETs `items/ViewPDF` then `window.open()`s a real separate PDF
  viewer tab (`.../items/PDFFileWindow?uniqueId=...`) — confirmed the popup actually opens and
  resolves. `#openSymbolsBtn` requires `isEditable()` (unapproved) + a Template; its dialog
  (`#symbolsDiv`, dynamically created) holds plain `<button class="btn" value="...">` symbol
  buttons — clicking one shows a confirmation **`"©" copied to clipboard.`** (lowercase "copied",
  the symbol itself quoted) inside the dialog's own `.message-success` div — **genuinely different
  wording from MDM's own Insert Symbols confirmation** (`"'X' Copied to Clipboard"`, capitalized,
  single-quoted) despite being the same underlying feature concept; don't reuse one module's exact
  string for the other. Gotcha worth keeping: `#symbolsDiv` is only the dialog's CONTENT pane —
  jQuery UI wraps it together with the titlebar (which has its OWN "Close" [X] icon, confusingly
  also named "Close") and the buttonpane as siblings, not children of `#symbolsDiv` — a
  `getByRole('button', {name: 'Close'})` scoped inside `#symbolsDiv` matches zero elements and
  hangs on auto-retry instead of failing fast; scope to `.ui-dialog-buttonpane button:has-text
  ("Close")` instead, same pattern as every other jQuery UI dialog's Submit button in this suite.

  **RTF Editor — paused, resume later (2026-09-30).** Explicitly deprioritized by the user mid-
  exploration ("save it for later... it isn't something widely used by customers") — this is
  everything already confirmed live so a future pass can pick up cleanly rather than re-discovering
  it:
  - **Confirmed enabled for Carton Label** (`memoFieldsAreDefined()` is true — Carton Label has at
    least one real Memo field configured) — not assumed, checked live via the button's own
    `isDisabled()`/`title` state.
  - **Clicking it is a genuine Sentinel native-app launch**, the exact same `innoclient:`-protocol/
    "Open SentinelLauncher?" confirm-dialog chain as Template Management's BarTender launch —
    `bartender.ts`'s `resolveBrowserPid`/`confirmSentinelLaunchPrompt` helpers are reusable as-is
    (that launch mechanism is shared Sentinel infrastructure, not BarTenderEdit-specific, despite
    the file's name). Spawned process: `Innovatum.Sentinel.Plugin.ItemRtfEdit`, window title
    `"Item RTF Editor"`.
  - **Spawn timing is genuinely variable** — confirmed as fast as ~10s in one run and still not
    appeared after a 60-attempt/60s poll budget in another (same machine, same flow) — give this a
    generous budget (120+ attempts/~2min) rather than trusting a single observed timing.
  - **Full control map** (live dump-tree, WPF/UIA "Document"-type controls throughout, not WinForms):
    read-only Item Number/Version Number/Label Type header text, a `drpMemoField` ComboBox (lets a
    multi-memo-field label type choose which field to edit), `drpFonts`/`drpSize` ComboBoxes, a
    `mainToolBar` ToolBar (Cut/Copy/Paste/Undo/Redo, `ToggleBold`/`ToggleItalic`/`ToggleUnderline`,
    `IncreaseFontSize`/`DecreaseFontSize`, `ToggleSuperscript`/`ToggleSubscript`,
    `ToggleBullets`/`ToggleNumbering`, `AlignLeft`/`AlignCenter`/`AlignRight`/`AlignJustify`,
    `IncreaseIndentation`/`DecreaseIndentation`), the actual editable surface (`rtbRtf`, a WPF
    `RichTextBox` exposed as a UIA "Document" control — confirmed typing into it via `sendKeys`
    keyboard input works; a WinForms-style `setText`/ValuePattern approach was never tried and may
    not apply to a WPF control at all), and `RTF Source`/`Save`/`Cancel` buttons.
  - **Critical, counter-intuitive finding confirmed via source** (`ItemRtfEditPresenter.cs`):
    **neither `Save` (`btnSave`) nor `Cancel` (`btnCancel`) closes the window.** `OnSaveRtfData()`
    only calls the save API and then `ViewModel.SelectedField.AcceptChanges()` (clears the dirty
    flag) — no `Close()` call anywhere in that handler. `OnCancelRtfEdit()` likewise only calls
    `RejectChanges()`. Both are **field-level commit/revert actions that leave the window open for
    further editing** — confirmed the hard way live: a `method: 'mouse'` click on either reports
    `{clicked: true}` with no error, yet the window visibly stays open and the process keeps
    running. **Only the window's own titlebar Close [X] button actually closes it** (bare
    `name: 'Close'` against the top-level window works, no `elementName` scoping needed) — this
    fires `OnClosing`, which checks `ViewModel.SelectedField.IsChanged`: if still dirty (Save was
    never clicked, or failed), it raises its own `CustomMessageBoxWindow` ("unsaved changes,
    Continue/Cancel") and cancels the close unless "Continue" is chosen; if clean (a real Save
    already succeeded), it closes immediately with no prompt. This means "did Close need to fight
    through an unsaved-changes prompt" is itself a legitimate way to verify Save actually worked.
    `CustomMessageBoxWindow`'s own buttons are named via WPF `Label` children inside each `Button`
    (`Button_OK`/`Button_Yes`/`Button_No`/`Button_Cancel`, only the relevant ones visible per call)
    — not yet confirmed live whether it's a separate top-level window or nested, and not yet
    confirmed whether its buttons are reachable via a bare `name` match the way the outer window's
    controls are.
  - **Real operational risk, confirmed the hard way**: because this is a genuinely separate desktop
    process from the browser, it does **not** get torn down when a Playwright test's own browser
    context closes or logs out — a test that throws before explicitly closing this window leaves it
    **orphaned on the real desktop indefinitely**. A live run of an early draft of this test did
    exactly that (caught by the user, who was watching the real screen) before a `try/finally`
    force-close (via the titlebar Close, not `btnCancel`) was added around every step that opens
    this window. **Any future automation of this feature MUST wrap every native-window-open step in
    try/finally with a force-close helper from the start** — don't defer that hardening to "once it
    passes once," given how easy it is to leave a real, unexpected window sitting open on a
    person's actual desktop.
  - **Next concrete steps for whoever resumes this**: (1) confirm whether `CustomMessageBoxWindow`
    is a separate top-level window or nested, and what its Continue/Cancel buttons resolve to via
    FlaUI; (2) build the force-close helper to handle BOTH the plain titlebar-Close-succeeds case
    and the titlebar-Close-triggers-unsaved-changes-prompt case, so cleanup is unconditionally
    reliable regardless of dirty state; (3) re-attempt the type→Save→Close→reopen→confirm-persisted
    round trip using titlebar Close (never `btnSave`/`btnCancel`) as the actual window-closing
    action; (4) confirm what `rtbRtf`'s content reads back as via `getProperty` (untested — a WPF
    RichTextBox's UIA "Document" control type may not support a simple `Value` property the way a
    WinForms Edit control does; `TextPattern`'s own document-range text may be needed instead, which
    `flaui_bridge.js` may not currently expose).
- **Mass Item Approve** (bulk, `CM_MassApprove`) — full read of `CM_MassItemApprove-1.3.doc`,
  2026-09-29: a mixed already-approved/unapproved selection blocks with `"Some items are not
  editable"` plus a `Details` link listing the offending rows' Item Number/Label Type/Version
  Number — don't assume this is silently filtered out, it's a hard block with a diagnostic link.
  Job Detail fields match the same Display ID/Date Inserted/Status/Submitting User/Date Completed/
  Percent Complete/items-table shape used by every other CM bulk action's Job Detail page.
- **Save Filters / Load Filters** (main grid, full read of `CM_SaveLoadFilters-1.15.doc`,
  2026-09-29) — Campaign Manager's own equivalent of MDM's Save Search/Load Search: Name +
  Description + `Public` checkbox, `"Filters Saved Successfully"` on save, duplicate-name block
  `"The name is already taken. To save over an existing set, select it from the drop-down."` A
  non-public filter is confirmed NOT visible to a different user's Load Filters list.

  **Confirmed live end-to-end 2026-09-30** (`Save_and_Load_Filters.spec.ts`) — this is classic Web
  Forms + jQuery UI (`Index.aspx`), NOT the Knockout/MVC style Item Edit uses. Save Filters
  (`#btSaveFilters` → `#saveFiltersDialog`): `#txtFilterSaveName`/`#txtFilterSaveDescription`/
  `#chkPublic`, a New/Existing radio (`#radNew`/`#radExisting` + `#drpExistingSets`) for overwriting
  a prior save. POSTs `CampaignManager/SaveFilters` with `{name, description, isPublic,
  recordsPerPage}`; on success shows a generic jQuery UI "Success" dialog (not a stable-id element)
  with the message — confirmed exact text `"Filters Saved Successfully"` matches the formal script.
  Load Filters (`#btLoadFilters` → `#loadFiltersDialog`): on open, POSTs `GetNamedSearches` and
  renders a plain jqGrid (`#jqGrid`, columns Owner/Name/Description) of the account's saved sets;
  clicking a row sets a module-level `selRow` JS variable, and Load then POSTs `LoadFilters` with
  that row's data and, on success, does `document.location.href = ...Index...&isReload=false` — a
  REAL navigation of the grid IFRAME itself (not AJAX), so re-resolve the frame afterward (same
  pattern as View History below). Confirmed a full round trip: save a filter on a real query,
  clear it, Load Filters, select the saved set by name, Load, and the original filter Value comes
  back correctly in the grid's own filter row.
- **Audit trail tables, confirmed via full read of `CM_AuditTrail-1.10.doc` (2026-09-29)**: job
  submissions of every kind (Export to XLS, Mass Update, Import from Excel, etc.) log their
  Display ID into `CMJobs`; item-level field changes log into `X_Items`; general action history
  logs into `Activity`. Same three-table shape applies across bulk and single-item actions alike.
- **Job Inquiry** (full read of `CM_JobInquriy-1.9.doc`, 2026-09-29) — Campaign Manager's own
  equivalent of MDM's Job Inquiry, same shared Column/Operator/Value filter widget (supports
  AND-chained multi-row filters), Retrieve Jobs → Job Detail. No new gotchas beyond confirming it
  exists and follows the standard pattern.

  **Confirmed live end-to-end 2026-09-30** (`Job_Inquiry.spec.ts`), with two real gotchas the doc
  review didn't surface: (1) **there is no visible in-app link INTO Job Inquiry at all** — a
  full source grep across every Campaign Manager view found only one reference, a "Job Inquiry"
  header button on `JobDetail.aspx`, and that button is itself only shown when the Job Detail page
  was reached FROM Job Inquiry in the first place (`fromJobInquiry` query flag its own inline script
  checks) — a fresh job's own Job Detail page (reached by submitting, not searching) always hides
  it. In real product use this looks like a direct-URL/bookmark-only page; reached here the same
  way, navigating the grid iframe straight to `CampaignManager/JobInquiry`. (2) **The default filter
  (when nothing was saved from a prior visit) is `PercentComplete LessThan 100`** — confirmed via
  source (`JobInquiry.aspx`'s own inline script) — i.e. it shows only INCOMPLETE jobs by default. A
  job that finishes almost immediately (100%, Status "Completed") by the time you query — true for
  a fast one like Export to XLS — is silently excluded by that default, not a bug; replace it with
  an explicit filter (e.g. Description ExactlyMatches) rather than trusting the default to find a
  specific known job. Once past both of those, the rest matches the doc: retrieve finds the job by
  Description, its formatter-generated "View Detail" link (`ActionType == "CM"` → JobDetail, else an
  arbitrary `ActionUrl`) correctly navigates back to that job's own Job Detail page.
- **Item Change History ("View History")** — full read of `IM_ViewHistory-1.32.doc` (already
  documented above under "Item Change History"), **confirmed live end-to-end 2026-09-30**
  (`Item_Change_History.spec.ts`): **NOT on the Item Edit page's own "Actions" dropdown at all** —
  confirmed via `Edit.cshtml`'s `DropMenu` construction, which has exactly 5 items (Create New Item,
  Save as New Version, Save as New Item/Label Type, Approve Item, Retire/UnRetire Item) and no
  History entry among them. It's a ROW-level action on the main Campaign Manager GRID instead
  (`Index.aspx`'s own `ActionsFormatter`/`rowActionSelected("view-history")`) — a small "Row
  Actions" dropdown per grid row with exactly two entries, "View/Edit" and "View History". Clicking
  it does a REAL (non-AJAX) form submit of `#frmEditItem` to `items/ItemsHistory`, navigating the
  grid iframe itself — re-resolve the frame afterward, same as Load Filters above. Page structure
  (`ItemsController.ItemsHistory` + `ItemsHistory.cshtml`) matches the doc: header shows Item
  Number/Version/Label Type/Template/Description (Knockout-bound, server-rendered into `initModel`
  up front — no separate AJAX grid-data call to wait for), User/Field/Start/End Date filters, and a
  change grid (`#grdChangeHistory`, columns Change Date/Change User/Changed Field/Value Before/Value
  After). Confirmed live: a brand-new item already has at least one audit row (`ChangeType='A'`,
  Add) the instant it's created, before any further edits — enough on its own to confirm the whole
  feature renders and populates correctly.

### Retire / Unretire Items — bulk and single-item (full read of `CM_RetireItems-1.17.doc` and `IM_RetireItem-1.31.doc`, 2026-09-29)
Two separate surfaces, both gated by `CM_RetireItems` (missing it hides the bulk "Select Action"
option outright, and the single-item Actions-menu version blocks at signature time instead — same
open-vs-signature-gate split pattern already seen elsewhere in this app):
- **Bulk** ("Retire Items" in the main grid's Select Action dropdown): Job Submission page shows
  Selected-count, Description of Job, Retire/Unretire radio (mutually exclusive — whichever
  doesn't match the current selection's state is disabled), an Effective End Date field (Unretire
  only, must be a future date), then the standard Username/Password/ReasonCode/Comment/Submit
  signature block. Job Detail: Display ID, Date Inserted, Status, Submitting User, Date Completed,
  Percent Complete, and a table of the affected items. Mixed active/inactive selection warns
  `"You have selected both Active and Inactive items. If you continue the action you select will
  be applied to all items"` (**note: no comma after "continue" here**, unlike MDM's own
  near-identical Mass Retire-Unretire warning which does have one — a real, if minor, textual
  difference between the two modules' otherwise-matching features). Multi-item Unretire with one
  shared Effective End Date warns `"The effective end date will be applied to all items"`.
- **Single-item** (Item Edit page → Actions → Retire/Unretire): opens a dedicated dialog with its
  own signature block. Required-field client validation: `"This field is required"` for blank
  Username/Password. Wrong password: `"Invalid Username or Password."` Missing `CM_RetireItems`:
  `"User not authorized for this task. CM_RetireItems."` — **note this has a period after "task"
  AND after the process name, unlike Approve Item's own equivalent message
  ("...task.CM_MassApprove", no space, no trailing period) — a genuine product inconsistency
  between two very similar signature-dialog error messages in the same screen family, not a typo
  in this note.** Successfully retiring shows "Retired" in red directly on the Item Edit page.
  Audit trail: `Activity` table (same family as Approve Item's own row).

### Save As New (bulk "Save As New", single-item "Save as New Version", and "Save as New Item/Label Type") — full read of `CM_SaveAsNew-1.6.doc`, `IM_SaveAsNewItem-1.28.doc`, `IM_CreateNewItemVersion-1.27.doc`, 2026-09-29
All three surfaces share the **same** `CM_SaveAsNew` security process (confirmed independently
across all three scripts) — unlike MDM's three separate "Save As New"-style processes, Campaign
Manager uses one process for all of them. Tooltip/error wording for this one process is
inconsistent across the three surfaces though — confirmed live: `"User not authorized for this
task ‘CM_SaveAsNew’"` (single quotes, bulk & single-item Save as New Version) vs. `"User is not
authorized for this task ‘CM_SaveAsNew’"` (note "is not" vs "not", still single quotes, Save as
New Item/Label Type) — a small but real wording drift between what should be the identical gate.
- **Bulk "Save As New"** (main grid Select Action) offers two radio modes: **New Version** (bump
  the version of each selected item in place) or **New Label Type** (spin off new version-0 items
  under a different Label Type + Template). Both radios and Submit get grayed out together, with
  three simultaneous error messages, if the selection is ineligible: `"New label type not
  available for this list of items"`, `"Not all items in this list are their latest version"`,
  `"Cannot create new version or assign new label types from this list of items."` A selection
  that's already unapproved (editable) for the New Version path blocks separately with `"Some
  Items are already editable."` Job Detail page fields: Display ID, Date Inserted, Status,
  Submitting User, Date Completed, Percent Complete, plus an items table (same shape as Retire
  Items' own Job Detail).
- **Single-item "Save as New Item/Label Type"** (Item Edit → Actions): dialog shows read-only
  `Version 0`, a Label Type dropdown (default `(select label type)`), and (once a label type is
  chosen) an Item Number field — both required, `"This field is required"` if left blank. Label
  Type dropdown is filtered by `LT_*` security the same as Create New Item's own dropdown, with
  the dialog-level `"Some label types are not included due to label type security"` message.
- **Single-item "Save as New Version"** (Item Edit → Actions): disabled until the CURRENT version
  is approved (can't version an unapproved item) — confirmed live, the option stays disabled right
  up until Approve Item completes. **A genuinely new rule**: if the item has a `Lock Version` value
  set, it carries forward automatically onto the new version, UNLESS the new version's Template is
  then changed, in which case Lock Version resets to blank.

### Item creation gotcha
The `create-robar-item` skill's documented JS snippet looks up the Template dropdown by
`select.id === 'txtTemplateName'`. On build 7.0.3.20099 that element has **no `id`**, only
`name="txtTemplateName"` — use `document.getElementsByName('txtTemplateName')[0]` instead.

### Scripted create → approve flow (confirmed live via Playwright, `ROBAR_Tests` repo)
`tests/campaign_manager_create_approved_item.js` in the `ROBAR_Tests` repo automates the
full flow end to end. Confirmed mechanics, useful beyond that one script:
- **Create New Item dialog** (`#btnCreateNew` on the Campaign Manager grid) only asks for Item
  Number (`#txtItemNumber`) + Label Type (`#ddlLabelType`) — no Template at this step. Submitting
  navigates to `/InnoPages/items/Edit`.
- On the Item Edit page, **both Template and Description are name-only, no id**:
  `select[name="txtTemplateName"]` and `input[name="txtDescription"]`. Description is not
  required by the creation dialog but **is required to Save** — leaving it blank blocks with
  "Description is required." even though nothing flagged it as required until Save was clicked.
- **Signature dialog ids are duplicated across the page** — `#sigUser`/`#sigPassword`/
  `#sigReason`/`#sigComments` inside `#approveItemDialog` are the same ids used by the
  retire/unretire dialogs' signature blocks (all hidden siblings in the DOM). A bare `#sigUser`
  selector resolves to the wrong (hidden) element; scope every signature field to
  `#approveItemDialog #sigUser` etc.
- Approve Item's AJAX (`POST /InnoPages/items/ApproveItem`) returns `{Success, ErrorMessage,
  IsServiceDown}` and, on success, the page does a full navigation to a fresh
  `items/Edit?itemNumber=...&labelType=...&versionNumber=...` URL rather than just closing the
  dialog — wait for that navigation before asserting the approved state.
- The approved status text lives in `span[data-bind*="approvedStatus"]` (e.g.
  `"MBUser1 - 9/4/2026"`), a sibling `<td>` of the "Approved By:" label — not a child of it. Don't
  assert on `text=Approved By:`'s parent element; it never contains the value.

### An MDM record and a Campaign Manager Item are TWO DISTINCT entities that merely share an Item Number string
Confirmed via `MDM_Print12.1.doc`'s own test-data definitions (`MD1`/`MD2` = "MDM item[s]...
Associated with SCA1" vs. `ITM1`/`ITM2` = "approved effective Item[s]... Associated with TMP1") and
independently reconfirmed live 2026-09-29: creating a Master Data Management schema record (see
that module's section above) does **not** create anything Print by Lot/Print by Order can resolve
as a printable item — that needs a real Campaign Manager Item (this section), created and approved
separately, which merely happens to share the same Item Number string as its MDM counterpart when a
test needs both (e.g. to exercise a template component that pulls in linked MDM field data at print
time). Don't assume creating one creates or substitutes for the other.

### Direct navigation to an item's Edit page, bypassing the grid entirely
`goToItem()` in `tests/support/campaign-manager.ts` navigates straight to
`{origin}/InnoPages/items/Edit?itemNumber=...&labelType=...&versionNumber=0` — reliable and much
simpler than searching/filtering the grid when the item number and label type are already known
(e.g. resuming a partially-set-up item from an earlier run). Two things to know before reusing it
outside `campaign-manager.ts`'s own TST703 default:
- Its hardcoded URL is rooted at the site **origin** (`/InnoPages/...`), not under the WebMenu's
  own `/innovatum/WebMenu/` path — derive the origin from `seed.ts`'s `ROBAR.url`
  (`new URL(ROBAR.url).origin`) rather than concatenating that URL directly, if adapting this for
  a non-TST703 environment.
- This is a genuine top-level `page.goto()`, not navigation inside the WebMenu's iframe shell — so
  every subsequent locator is `page.locator(...)`, not `frame.locator(...)`. A response like
  `ApproveItem`'s own JSON body must be read **inside** the `waitForResponse(...).then(r => r.json())`
  chain, not awaited as a raw `Response` object first and read afterward — this page navigates
  immediately after that response lands, and reading the body after that navigation has already
  happened throws `"No resource with given identifier found"` (confirmed live 2026-09-29). The
  original iframe-scoped `Create_Approved_Item.spec.ts` doesn't hit this, since the iframe's own
  navigation doesn't tear down the top-level page's response cache the same way.

### Save button is correctly disabled when the form has no unsaved changes
The Item Edit page's Save button binds `disable: !isDirty() || templateIsEmpty()`. Re-running a
script that sets Template/Description to the exact same values an earlier run already saved leaves
Save legitimately disabled (`"element is not enabled"` if you blindly click it) — this is correct
product behavior, not a bug or a flake. Check `isEnabled()` before clicking Save when a value might
already match what's persisted, and skip the click entirely when it's already unchanged.

### VAL703-specific Label Type / Template fixtures (confirmed present 2026-09-29)
`A1SuperTemplate` (the TST703 default used throughout `campaign-manager.ts`/
`Create_Approved_Item.spec.ts`) **does not exist in VAL703** — don't assume TST703 fixture names
transfer to other environments. `Carton Label` (Label Type) is confirmed present in both. For a
VAL703-specific Template, prefer one of the environment's own dedicated test fixtures rather than
picking arbitrarily from the full list: `VAL703Temp1`, `VAL703Temp2`, `VAL703TestTemp1`,
`VAL703TestTemp2`.

### Approve (Item Edit → Actions → Approve Item)
E-signature dialog (User Name, Password, Reason Code, Comment). On success the entire form locks
read-only and shows "Approved By: X - date".

### The 11 Bulk Actions ("Select Action" dropdown next to Retrieve Items)

| # | Action | Status | Notes |
|---|---|---|---|
| 1 | Export to XLS | ✅ Working | Async job, Job Description/Filename, completes ~1 min |
| 2 | Import Master | ✅ Working | File-matching screen, color legend (Green/Yellow/Red). **Expanded via full read of `CM_ImportMaster-1.16.doc`, 2026-09-29**: requires a configured UNC `MasterUploadDirectory` GlobalSetting and a matching subdirectory containing files named after the item number. All selected items must share the same Label Type — `"All items must belong to the same label type."` if not. A `Show` dropdown (default "Without Masters") plus independent Green/Yellow/Red checkboxes filter the grid; manually browsing a file for a row turns it green and populates a `PDF To Upload` field. Submitting with nothing selected blocks with `"There are no master files selected for upload."` Gated by `CM_ImportMaster` (missing it hides the whole page, not just disables it). |
| 3 | Item Data Compare | ❌ **Confirmed bug** | Requires **File Name** field (in addition to Job Description) — not obviously required, no validation hint. Even with it filled, fails 100% of the time (3 separate reproductions) with `"External table is not in the expected format."` Likely an OLEDB/Excel-provider issue reading a nonexistent prior-version baseline file. |
| 4 | Item Translation | ✅ Working (multi-step, easy to get wrong) | Full flow: filter dictionary (Column/Operator/Value), check "Include Unapproved" if needed, click **Get Translations** to populate the Dictionary Translations table → expand "Select Fields to Translate" → click a translation row → check item rows → **Populate Phrase**. Skipping the dictionary-search step (just clicking around the item grid) makes it look broken — it silently completes with nothing translated. This was initially mis-flagged as a bug for exactly that reason. **Confirmed end-to-end via Playwright 2026-09-04** (`item-translation.spec.js`): the page auto-loads with a default filter (Phrase/Contains/"a") and immediately fires Get Translations, so no manual filter entry is even needed; Populate Phrase visibly updates the item grid cell and the change persists after submit. Also confirmed: `#SubmitButton` on this page doesn't submit directly — it opens a **second** "Job Submission" modal with its own Job Description + Signature fields, unlike every other bulk action's single-page submit. |
| 5 | Mass Item Approve | ✅ Working | |
| 6 | Mass Item Update | ✅ **Fixed** (was a confirmed bug) | Correctly blocks with "Some items are not editable" if all selected items are approved. **Was a confirmed bug** (independently reproduced 2026-09-04 via Playwright: with a genuinely unapproved/editable item and a fully valid form, `#SubmitButton` fired no `SubmitJob` request at all) — **confirmed fixed live 2026-09-11** (Submit now correctly fires `SubmitJob` and updates the field). The regression test that caught this (written to fail loudly the moment the bug was fixed) was replaced with a normal happy-path test once it did — see `Mass_Item_Update.spec.ts`'s own header comment and git history if this ever regresses. |
| 7 | Mass Print | ✅ Working | Use "Microsoft Print to PDF" to avoid physical printers during testing |
| 8 | Retire Items | ✅ Working | E-signature required |
| 9 | Save as New | ✅ Working | Minor cosmetic gap: `VersionNumber` column blank in the result grid |
| 10 | Save to PDF | ✅ Working, one UX gotcha | `Subfolder` field is effectively required; leaving it blank produces the vague `"Path is invalid."` instead of naming the field |
| 11 | Send to Workflow | ✅ Working | Submit is correctly **disabled** if any selected item is already approved (deliberate business rule). Requires a workflow **Preset** to be selected — `"A workflow preset must be selected."` if skipped, another silently-required field. Also enforces "Workflow comments cannot be left blank." **Most presets in the `#drpPreset` dropdown have zero configured workflow steps** (confirmed via `GetWorkflowSteps` responses 2026-09-04) and fail SubmitJob with `"Workflow steps are empty. A workflow must have at least one step."` — `"ROBAR Only"` is confirmed to have real steps; use it (or re-verify via `GetWorkflowSteps`) rather than assuming any preset works. |

### Other confirmed findings
- **Orphaned job records:** initiating Import Master or Mass Item Update — even without completing
  the final Submit — creates a permanent `Status: Submitted, 0% Complete` row in Job Inquiry that
  never resolves. Reproducible pattern, intentionality unconfirmed.
- Session timeout bug (see "WebMenu-wide issues" below) reproduces here too.
- **A separate, EARLIER interactive-testing report of "Populate Phrase never becomes enabled"
  (Item Translation) did not reproduce via Playwright** (`Item_Translation.spec.ts`, 2026-09-30
  re-check) — the button enabled normally as soon as a dictionary row was clicked, and the
  translation persisted after submit. Treat that earlier report as a stale/environment-specific
  false positive, not an open bug — consistent with row 4's own already-documented "Working" status
  above; this is a second, independent confirmation of it.
- **Concurrency hazard, confirmed via `tests/support/campaign-manager.ts`'s own header comment
  (2026-09-04): the grid's "Retrieve Items" reads/writes some per-ACCOUNT (not per-browser-session)
  server-side query state.** Two concurrent logins as the same account — a leftover/zombie browser
  session still open, or two automated test workers running at once — can cause one session's
  Retrieve Items to silently come back with a COMPLETELY DIFFERENT item than the one just filtered
  for, with no error at all, just silently wrong data. This is why the Playwright suite pins
  `workers: 1` for this whole module. Worth knowing for MANUAL testing too, not just automation: two
  testers (or one tester with two open tabs/sessions) signed in as the same shared account and
  both using Campaign Manager's grid at the same time could see each other's query results bleed
  through with no visible indication anything went wrong.

---

## Workflow Management

**Purpose:** The counterpart to Campaign Manager's "Send to Workflow" — retrieve, vote on, and
administer workflows (item-level, template-level, or standalone non-item/non-template ones
created directly here).

**Formal scripts reviewed:** all 28 scripts under `Workflow_Management\7.0.3\` (see
`.agents/exploratory-session-log-workflow-management.md` for the full per-script breakdown).

### Retrieve/Filter Workflows
- `Find Workflows for User` dropdown (default "Any User") + `Retrieve Workflows`.
- Advanced Options: `User is Included` / `User Can Vote` radios (different semantics — Included =
  user is somewhere in the workflow steps; Can Vote = it's currently their turn), `+Add Filter`,
  All/Open Only/Closed Only dropdown, `Latest Item Version Only`, `Effective Item Only`,
  `Limit Results`, `Field Definitions` dropdown (per-label-type custom field captions, e.g.
  `Code2` → "Change Control" by default).
- Column dropdown for filters has **66 fields**: 54 `Item -` prefixed, 4 `Template -` prefixed
  (Label Type, Template Description, Template Name, Template Version), 8 `WF -` prefixed (Date
  Initiated, Last Status, Last User, Workflow Change Control, Workflow Comments, Workflow
  Description, Workflow Id, Workflow Status).
- `Filter by Change Control` dropdown — separate quick-filter, instantly re-filters the grid; a
  `View Change Control` link opens a 4-tab Detail dialog (Workflow Image/Comments & History/
  Steps/Attachments) scoped to the CC. CC-level attachments are visible across every workflow
  sharing that CC number.
- Grid selection: `Select All` (all pages) vs `Select Page` (current page only) are genuinely
  different and reset on navigation.
- Filters persist per-user across sessions (`UserEnvironment` table, `PageId='WorkflowManagement'`).

### Actions dropdown (page-level, not row-selection-dependent)
- **Create New Workflow** — Job Description, Workflow Comments, and Preset are all required
  (Submit Job stays disabled with live "Required" validation). Optional attachments with
  duplicate-filename detection (`"Upload Failed: Cannot upload duplicate file."`). Gated by
  `WM_Create_New_Workflow`.
- **Preset Management** — full CRUD, gated by `WM_Create_Workflow_Preset`:
  - Create: Preset Name + Description, validated (`"Please specify a preset name."`,
    `"Preset already exists. Please specify a new value."`)
  - Add Step / Edit Step panel fields: User dropdown, Department, `Vote for Entire Group`
    checkbox, `Vote Counts As Veto` dropdown (default None), Approval Group (auto-increments per
    new step), Hours to Respond (default 72), `Notify Immediately`, `Notify Only`, Create Step /
    Update / Delete Step. Validates `"User must be selected"`.
  - Save As clones all current steps into a new preset (same name validation as Create).
  - Active checkbox (unchecking ≠ deleting — inactive presets stay selectable but greyed in the
    dropdown) vs. Delete (confirmation-gated, fully removed from the active list).
  - Full audit trail: `WFHEADERPRESETS`/`WFSTEPPRESETS` (current) mirrored into
    `X_WFHEADERPRESETS`/`X_WFSTEPPRESETS` (history, `ChangeType` A/C/D = Added/Changed/Deleted).

### Bulk Actions dropdown (on selected grid rows) — 4 actions, each independently security-gated
1. **View and Vote** (`WM_ViewAndVote`) — Job Submission grid has header + row-level
   Approve/Reject/`Vote For Dept`/Veto checkboxes, each gated by its own security process
   (`WM_ViewAndVoteCheckAll` for header, `WM_ViewAndVoteCheckBox` for row-level). Detail dialog:
   Workflow Image/Comments & History/Steps/Attachments tabs, vote panel (Comment + Reason,
   default "General"), Previous/Next (auto-advances on Approve/Reject, "This is the last item in
   list" on the final one). Rejecting without a comment is blocked by default
   (`"Comments are required for rejected workflows."`) unless the user holds
   `WM_ViewAndVoteSkipComment`. `WFRejectHasVetoPower` GlobalSetting (default N): when Y, a single
   reject vote instantly rejects the whole workflow. Attachment deletion is double-gated: security
   process (`WM_DeleteWFAttachments`, `_Anyuser` variant for others' uploads) **and** workflow
   status (disabled once Approved/Rejected).
2. **Edit Workflows** (`WorkflowEdit_Option`) — bulk step editor. Actions dropdown inside it:
   `Delete User`, `Replace User`, `Add User` (submenu: Add at Beginning / Add at End / Add to
   Group — each with Append vs Insert). Only affects **open** steps without votes already cast;
   warns when some selected workflows are past that point. Confirmed job-result messages: "User X
   has been added/removed", "User X replaced user Y". Per-step click opens Edit Step (same fields
   as Preset Management's), Update/Delete with cancelable confirmation dialogs. Users are
   color-coded green (voted all)/yellow (partial %, shown)/red (not voted).
3. **Report** (Workflow Summary Report, `WF_Generate_Report`) — generates PDF(s) to a network
   subdirectory under `WFReportPathName` GlobalSetting, either merged
   (`WorkflowReport_Merged_<date>.pdf`) or per-workflow. Attachments auto-append to the bottom
   based on File Purpose being listed in the `AppendWFSummary` Codes entry. **Confirmed working**
   — verified the actual PDF exists on disk after submission.
4. **Export to Excel** — ❌ **Confirmed bug**, see below. Only gated by base module access
   (`Web_WorkflowManagement`), no extra security process.

### Add Attachments
Two independent security processes: `WM_AddAttachment_Open` / `WM_AddAttachment_Closed`.
Attaching to a **closed** workflow triggers `"Adding an attachment to a completed workflow can
replace production files. Would you like to proceed?"`. Attachments can also live at the Change
Control level, visible to every workflow sharing that CC.

### Linked Documents
Gated by `LM_View_LinkManagement`. Opens Link Management in a new tab, pre-filtered by LCN (if
the item has one) or by Item Number + Version + Label Type otherwise; template-level workflows
filter by Template Name + Version + Label Type.

### Redline (requires Sentinel desktop client — not testable via pure browser automation)
Create/Edit Redline buttons launch a desktop editor via the Sentinel chain. Real file-locking
between concurrent editors (Cancel/Continue, or Cancel/Take Control if the user holds
`FP_View and Vote Redline_Edit_Override_Lock`). Auto-toggles Create↔Edit based on whether an
active redline attachment exists (File Purpose = "View and Vote Redline").

### Change Control
CC number is just a configured item field (`Code2` by default, caption controlled via Field
Definitions Management). `ChangeControlRequirement`, `ChangeControlShareName`,
`IsChangeControlApplicableField` GlobalSettings control whether/how it's auto-populated by the
Workflow Service backend — changing these requires an IISRESET + service restarts.

### Features requiring infrastructure this environment doesn't have (out of scope for browser-only testing)
- **Workflow Status Report / Simple Status Report / Limited variants** — driven by
  `InnoTasc.WorkflowStatusReport.exe` run manually on the server via RDP, verified via real email
  inboxes.
- **Workflow Service** — backend Change Control sync; testing requires GlobalSettings changes +
  IISRESET.
- **PreApprove User** (`WMPreApproveUser` GlobalSetting) — grid-filtering-by-configured-user;
  requires GlobalSettings change + IISRESET. Confirmed **off** (blank) in this environment.
- **Localization Resources** — requires importing translated strings via direct SQL and switching
  site language.

### Confirmed bug: Export to Excel silently fails
Clicking Bulk Actions → Export to Excel produces no visible error and no downloaded file — the UI
just returns to idle. Root cause via network trace: `GET ExportToExcel` returns **HTTP 503**
(reproduced 2-for-2 on clean UI-triggered attempts), but the client's polling endpoint
`CheckForExcelExportFileComplete` returns **`true`** regardless, so the client believes the export
succeeded and stops polling — a silent, undetectable failure from the user's perspective. Calling
`ExportToExcel` directly via `fetch()` outside the normal flow returned 200 OK moments later,
suggesting a session-state race between `SaveSelectedWorkflowsToSession` committing and
`ExportToExcel` reading that state, rather than the endpoint being permanently broken.

### Relevant GlobalSettings (as observed 2026-08-25, view-only — do not change without explicit approval)

| Setting | Value | Owner |
|---|---|---|
| `WFInquiryShowCC` | Y | Innovatum.CampaignManager.Plugin.ViewAndVote.WCF |
| `WFInquiryShowId` | Y | Innovatum.CampaignManager.Plugin.ViewAndVote.WCF |
| `WFItemChangeControlField` | Code2 | Innovatum.CampaignManager.Plugin.ViewAndVote.WCF |
| `WFRejectHasVetoPower` | N | Innovatum.CampaignManager.Plugin.ViewAndVote.WCF |
| `LimitWFEmails` | N | InnoTasc.WFReportSummary.WCF |
| `WMPreApproveUser` | *(blank — feature off)* | Innovatum.Pages.WorkflowManagement.WCF |
| `WFReportPathName` | `\\<ROBARServerName>\Network\SignatureReport\` | InnoTasc.WFReportSummary.WCF |

---

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

## Browser Printing

**Purpose:** The browser-based label printing flows themselves (Print by Order, Print by Lot,
Version Printing, Misc Printing, and several specialized variants) — the endpoint of the whole
CM/WM/MDM pipeline, where a lot/order actually gets a physical (or PDF) label.

**Formal scripts reviewed:** all 42 scripts under `Browser_Printing\7.0.1_And_Up\` (see
`.agents/exploratory-session-log-browser-printing.md` for the full per-script breakdown from the
6-way research pass; only a subset was live-tested — see below).

**Unusually infrastructure-heavy module** — more of it is out of reach for browser-only testing
than any prior module. Confirmed blocked: Lot Batch Quantity Adjust and Serial Prefix Trigger
(need an XML drop-folder service reachable only via RDP), Purchase Order Printing (needs custom
stored procedures + a pre-existing Vendors schema), Print Time Redline Comparison (likely needs
the Sentinel desktop client, same pattern as Workflow Management's Redline), Preview Signature
(needs PrintConfig edits + IISRESET + 4 provisioned signer accounts). **DX Printing is confirmed
not configured in this environment** — skip it.

### Print by Order / Version Printing (live-tested, confirmed working)
- Print by Order auto-creates a lot with sensible defaults when given a new order+item combo.
- Reprint flow: credentials + Reason dropdown gate a second print of the same order. Live block
  message reads `"...not granted the Reprint_Label permission"` — the formal script
  (`BPSecurity1.3`) expects `"...BP_Reprint_Label permission"` (with the `BP_` prefix). Cosmetic
  discrepancy, not functional — flag to whoever owns the script.
- **Version Printing** (distinct module from Print by Order — explicit version-select/override
  flow for unapproved/ineffective item+template combinations): `"No approved effective Item. You
  must click OK to override."` → `"Warning! Item is not approved."` (or "not effective") →
  `"Proceed with version: N"` → normal print screen. Confirmed working end-to-end.
- Gated by four named security processes: `Print_Unapproved_Items`, `Print_Ineffective_Items`,
  `Print_Unapproved_Labels`, `Print_Ineffective_Labels`. Only the first was live-tested; captured
  the exact block message (never quoted in the formal script):
  `"User is not authorized to print any version of this item. Ensure that the item and label are
  approved and effective. If not, make sure the user is authorized to print unapproved or
  ineffective items/labels. <ItemNumber>"`
- **Code-verified 2026-09-24 (while writing UAT_BPVersionSelect).** All four checks raise that
  **same** message (`VerPrinting_Not_Authorized_For_Template_Types`,
  `PrintScreenByVersion.aspx.cs` `RemoveUnauthorizedItems` ~406-447). The checks run in this order:
  ineffective item, unapproved item, no effective label, no approved label. So each process can
  only be isolated by test data that fails exactly one condition. All four can be disabled at once
  without one check masking another.
- **Formal script errors in `BPVersionSelect1.2`:**
  - The error appears on the **Next after Item + Lot**, before any version-override prompt. The
    script's "click OK to override" does not happen in these negative cases.
  - The new lot is created **before** the check (`WebPrintOrderNo.cs:232-242`), so every refused
    attempt still leaves a lot behind.
  - Adding a lot needs `BP_Add_Lot_PrintTime`, which the script never mentions.
  - Steps 3.1/4.1 toggle processes for U01 instead of U02 (likely a typo).
  - The access process is `BP_PrintByVersion_Option`.

### ClientPrintMethod PrintConfig setting — why every Printing module triggers a native Sentinel Launcher prompt
Each printing module has a `ClientPrintMethod` PrintConfig setting; for Chrome it's set to
`Sentinel` (per Mason, 2026-09-16). This is why opening the Printing module at all triggers
Chromium's native "Open SentinelLauncher?" external-protocol dialog — the same mechanism already
documented for Template Management's template-editor launch (see
`ROBAR_Tests\tests\Template-Management\Create_and_Approve_Template.spec.ts:40-132` for the full
FlaUI-based handling: this is NOT a JS dialog, `page.on('dialog')` never fires, and a UIA
`click`/InvokePattern on the confirm button doesn't work — real synthesized mouse coordinates via
FlaUI's `clickAt` are required). **For a real manual tester this only shows once ever** — a normal
browser profile persists the dialog's "always open these links in the associated app" checkbox
choice after the first confirmation. **Playwright's browser context is fresh/ephemeral per test
run**, so that choice never persists, and the prompt re-appears on every single automated run.
Two mitigation paths (as of 2026-09-16, still being evaluated for the Browser Printing test suite):
1. Chromium's `AutoLaunchProtocolsFromOrigins` enterprise policy, which can whitelist a specific
   protocol+origin pair to auto-launch without ever prompting — if this can be applied to
   Playwright's launched browser, it would eliminate the dialog (and the FlaUI detour) entirely
   for automated runs.
2. Fall back to the same FlaUI confirm-dialog pattern already proven for Template Management.

### Confirmed bug: MDM effective-status is checked once at item entry, never re-checked at print submit
**Root cause traced via source (2026-09-16), not yet live-tested.** Per FRS MDM20150514100F1.0.2,
a retired/ineffective linked MDM item's data must never appear on a printed label. In practice the
approved/effective check only happens **once**, at the wizard's first item/order/lot entry step:
`PrintMasterItem.MasterDataItem` (`Web\ROBAR\Printing\PrintMasterItem.cs:98-185`) calls
`MasterDataRepository.GetLatestApprovedEffectiveItem(ItemNumber)`
(`Innovatum.DataManagement.Data\Repositories\MasterDataRepository.cs:621-624`) and **caches** the
result. That same `PrintMasterItem` instance is then carried across every later postback via
`PrintSubSession` (`Web\ROBAR\Printing\PrintSubSession.cs:44,276-290`,
`Web\ROBAR\Printing\PrintPageUtils.cs:171-180` — a plain PageID-keyed dictionary, no re-fetch). The
final print submission (`Web\Controllers\PrintOptionSelectionController.cs:264-268, 392-396,
619-623`) reads `subsession.MasterItemToPrint.MasterDataItem` — the stale cached object — with no
`IsApproved`/`IsEffective` re-check anywhere in that path.
**Impact:** if the linked MDM item is retired/made ineffective after the user finishes item entry
but before clicking the final Print button, the label still prints with the stale MDM data.
**Not yet live-reproduced** — this is a static code-trace finding; see
`.agents/test-generation-browser-printing.md` (SC-10) for the regression test designed to prove
it live and the full call-chain citations. **Caveat:** `PrintScreenByVersion.aspx.cs:174`
(explicit-version print, used by Version Printing/Exact Reprint to pin a specific historical
version) is a distinct, intentional flow — don't conflate it with this bug.

### Label Type Exclusion Maintenance (Settings → Label Type Excl.)
Grid of workstations × label types; **checking a box excludes/blocks** that workstation from
printing that label type (confirmed live — this was ambiguous in the formal script). Changes are
live immediately, no save step. Blocked-print message:
`"No printable label types for this workstation due to label type exclusions. <WorkstationName>"`

**Important:** the WebMenu header's `Server: VMSRVTST703` is the **server** name, not the
browser session's client identity — don't assume they match. A Claude-in-Chrome browser session
in this environment resolves to workstation **`MASON-LAPTOP`** for exclusion-checking purposes,
not `VMSRVTST703`. Check all pre-existing workstation entries (`LAN-PC`, `MASON-LAPTOP`,
`NYYA-PC`, `VMSRVTST703` as of this writing) if the actual client identity is unknown.

### Playwright automation notes (Browser-Printing specs, 2026-09-16)

Learned live while building `ROBAR_Tests/tests/Browser-Printing/*.spec.ts` (SC-01 through SC-10
per `.agents/test-generation-browser-printing.md`) — read this before writing another Print
by Order/Lot test, and see `ROBAR_Tests/tests/support/printing.ts` for the resulting helpers.

- **Playwright's own `locator.click()` (including `{ force: true }`) does not reliably trigger a
  postback on `Web/ROBAR/Printing/Screens/PrintScreen.aspx`'s legacy WebForms submit buttons.**
  Confirmed via a headed `@playwright/test` run with full console/network logging: clicking
  `#ctl00_btnNext` via Playwright "succeeds" (no error) but the screen silently stays on the exact
  same state, even though the button is a genuine `<input type="submit">` with no onclick handler
  and the form's own `onsubmit="javascript:return WebForm_OnSubmit();"` is present and
  `window.__doPostBack` exists. **Fix: dispatch a native DOM `.click()` via `frame.evaluate()`**
  (`printing.ts`'s `nativeClick()`) instead of `frame.click()`/`locator.click()` for every
  Next/submit button in this screen family. Confirmed this reliably advances the first two wizard
  transitions (empty-order screen → item/lot-entry screen → Lot Panel). This is a different, newly
  confirmed failure mode from the CSP/UpdatePanel one already documented under "Known
  testing-tooling limitations" below — this one blocks the very *first* postback of Print by
  Order, not just the Lot Panel's.
- **A third transition remains blocked regardless of click method: submitting from the Lot Panel
  itself** (the step that creates the Lot record and would advance to template/label selection).
  Confirmed via response logging that the POST genuinely completes (HTTP 200) — the server's own
  response renders **"Timeout waiting for Sentinel."** on the same screen. Tried Playwright's
  `.click()`, `nativeClick()`, and a raw `dispatchEvent(new MouseEvent('click', ...))` — all three
  produce the identical timeout message. This reproduces regardless of the "Allow Label Control
  Selection" checkbox state (confirmed unchecked by default, so it isn't the trigger). **This
  looks like a genuine Sentinel/`ClientPrintMethod` dependency in the print-submission path**
  (per Mason: `PrintConfig`'s `ClientPrintMethod` is set to `Sentinel` for Chrome clients in this
  environment) that this automated session cannot satisfy — no reachable Sentinel Tray process.
  Note this manifests purely as server-rendered page text in every reproduction attempted here;
  no native browser external-protocol dialog (`innoclient:`-style, the same mechanism Template
  Management's BarTender launch uses) was ever observed in any of these attempts, despite explicit
  network/console monitoring for one. Whether a real interactive session would instead see that
  native dialog at this exact step (as opposed to a server-side timeout) was not resolved this
  session. **Practical effect either way: SC-01, SC-07, SC-08, SC-09, and SC-10 cannot reach a
  working assertion via pure Playwright browser automation in this environment** — all of them
  need to get past this exact transition (Lot Panel submit, or Version Printing's equivalent) to
  reach the print-execution/template-selection screens their oracles depend on. Treat this the
  same as the already-established "requires Sentinel desktop client" scope boundary (Print Time
  Redline Comparison, Template Management's BarTender editing) rather than a pure test-tooling
  problem to keep chasing.
- **Print by Order's initial screen fields, confirmed live:** Print Entity
  `#ctl00_printContentHolder_customControl_ddlPrintEntity` (defaults to `ROBAR` on a fresh load,
  options `England`/`MLAUser1`/`ROBAR`/`Vendors`), Shop Order Number
  `#ctl00_printContentHolder_customControl_txtOrder`, Next `#ctl00_btnNext`, Reset
  `#ctl00_btnResetAll`. A new/unresolvable order number reveals Item Number
  (`...customControl_txtItemNumber`) and Lot Number (`...customControl_txtLotNumber`) fields plus
  the message `"No Lot found for this order/lot/item combination. Please fix or continue."` —
  repeating Next with those still blank changes the message to `"No item found."` and never
  advances, exactly as `exploratory-session-log-robar-print.md` documented manually. Once a valid
  Item Number is supplied, Next reaches the **Lot Panel** (distinct field id prefix `deLot_`, e.g.
  `#ctl00_printContentHolder_deLot_txtLotNumber`/`txtLotManufactured`/`txtLotExpiration`), which
  shows Manufactured/Expires/Reassay already server-defaulted and calculated (REQ-7/8/9) — for
  item `MI080301`, Expires = Manufactured + 1 day, confirmed live and asserted dynamically (not a
  fixed date string) in `Blank_Expiration_Date_Calculated.spec.ts`.
- **WebMenu tile text collisions confirmed live**, beyond the ones already documented for Master
  Data: "Print by order" is a substring of both "Print by order multi" and "Print by order lot";
  "Print by lot" is a substring of "Print by lot multi". Every `openPrintBy*` helper in
  `printing.ts` uses `getByRole('button', { name: ..., exact: true })` for this reason.
- **Campaign Manager was observed throwing a genuine server-side ASP.NET Runtime Error** ("Server
  Error in '/innovatum' Application") when opening the module at all (not a specific action within
  it) during this session (2026-09-16, ~14:15), reproduced twice in a row across two independent
  browser sessions (one Playwright, one direct/manual). This blocked creating a second test item
  needed as a fixture for SC-02/03's multi-item Lot/Order negative test. Not root-caused (could be
  this environment's transient state rather than a build-wide regression) — worth a quick
  re-check next session before assuming it's still broken, and worth mentioning to whoever owns
  the environment if it persists.

**Cleanup gotcha:** this page has no "save" — every checkbox click is immediately live in the DB.
When testing here, re-verify each row was actually reverted (a rushed click during row-switching
can silently fail to register) rather than trusting the last screenshot before moving on — this
bit us once mid-session (a stray leftover exclusion caused an unrelated later test to fail
confusingly until traced back here).

### Add Lot Reason Required (PrintConfig-driven, `ConfigName=LotNumber`/`MultiDocPrint`/etc., `ParamName=AddLotReasonRequired`)
When `Y`, entering a brand-new lot number on Print by Lot (or the equivalent field on other
print flows) triggers: `"You are about to add a new lot record, please select a Reason Code in
order to proceed."` — Reason Code dropdown (required, `"This field is required."` if skipped) +
optional Comment. Confirmed working exactly as documented; toggled live via **Print Config
Management** (no IISRESET needed for this particular setting, unlike several others in this
module).

### Print by Lot Multi / Print by Order Multi (live-tested, confirmed working)
Both let a single Lot Number or Order Number be reused across multiple Order/Lot pairings via an
`Add Lot` button that appears once the primary identifier resolves to an existing record: enter
the new counterpart (Order Number for Lot Multi, Lot Number for Order Multi) + Item Number, and the
page auto-creates the new lot record (Expires/Manufactured/Reassay defaulted) exactly like Print by
Order's single-record auto-creation. `Print by Order Multi`'s Codes-table prerequisite
(`BP_OrderNumberMultiple` tied to the user's security group) is already provisioned for the
`MBAllSecurity` group in this environment — no setup needed to test it.

**Side effect worth knowing:** once a lot number has been associated with more than one order via
Print by Lot Multi, the plain **Print by Lot** screen correctly refuses to resolve it standalone:
`"Multiple Lots found for this Order Number or Lot Number."` — this is `BPPrintbyLot1.1`'s
documented negative-test message, reproducible incidentally just by having tested Lot Multi first.

### View Compare (live-tested, confirmed working)
Reached via any Print-flow's `Select Option` dropdown → `View Compare` → `View` button — opens a
side-by-side (Vertical) or stacked (Horizontal) comparison of the item's saved label master against
the live label being printed, in a new browser tab (`FileComparer.aspx`). If the item has no saved
master yet, the block is `"No master file saved for this item."`

**To create a missing master:** use **Label Control Management → Bulk Actions → Recreate Master**
(keyed by LCN, not Item Number) — standard Job Submission → e-signature → Job Detail pattern.
**Not** Campaign Manager — its Bulk Actions dropdown (`Export to XLS`, `Import Master`, `Item Data
Compare`, `Item Translation`, `Mass Item Approve`, `Mass Item Update`, `Mass Print`, `Retire Items`,
`Save as New`, `Save to PDF`, `Send to Workflow`) has no master-recreation option despite the
formal scripts' setup section reading ambiguously on this point.

Once a master exists, both Vertical (scaled-to-fit, master left / live right) and Horizontal
(native-size, master top / live bottom) layouts render correctly. The default layout selection is
driven by the `ViewCompareAutoAlignment` GlobalSetting in combination with the template's physical
orientation — this environment's current value wasn't independently confirmed via DB, but the
observed default (Vertical) is consistent with either `BPViewCompare1.1` or `.3`'s documented
scenarios.

**Code-verified 2026-09-24 (while writing UAT_BPViewCompare):**
- **Setting:** `ViewCompareAutoAlignment` has SettingOwner `Innovatum.Robar.Printing` and seed
  default `Y`. The page falls back to `N` if the setting is missing.
- **Server side:** the server always renders Vertical first.
- **With `Y`:** a client-side `ChooseAlign()` (`FileComparer.aspx:56-71`) measures the **first
  `<img>`**, which is the print preview (the master is a PDF in an iframe). It switches to
  Horizontal if width ≥ height, so a square preview also goes Horizontal.
- **With `N`:** the layout always stays Vertical.
- **No "auto sized to the label master":** both layouts size the frames to the window. The claim in
  `BPViewCompare1.1` is wrong.
- **Caching:** the setting is held in a static cache (`GlobalSetting.cs`), so changing it needs an
  app-pool recycle or IISRESET.
- **Print by lot flow:** "Override Lot Data" is a checkbox in the lot panel, not a separate screen.
  For a *new* lot, the first Next shows the Item Number / Shop Order Number boxes, not lot details.
  The access process is `BP_PrintByLot_Option`. New lots need `BP_Add_Lot_PrintTime`. View Compare
  itself has no security process; it is enabled by the PrintConfig `PrintPreviewOptions` value.
- **Markup typo:** the radio's Text attribute is `"Vertial"`, although the rendered caption was seen
  live as "Vertical".

### Code-verified findings for BP21CFR / BPLblTyp / BPMasterData / BP_PrintTimeRedline (2026-09-24, while writing UATs)

**Print by order**
- Uses PrintConfig **ConfigName `Print1`**. Five configs share PrintFunction `OrderNumber`, so a
  script that says "the OrderNumber config" is ambiguous. Settings are re-read per print session,
  so reopening the module is enough; no IISRESET is needed.
- Print1 defaults: AllowManualDateEntry `N`, ManualEntryDateFormat `mm/dd/yy`,
  WarnWhenPrintedLabelsExceedsValue `5000`, ReprintBasedOnBatchQty `Y`, LotBatchQuantityField
  `u2`, multiplier `Qty2`, extra `u5`, ItemShelfLifeFieldName `Storage3`.
- Processes:
  - `BP_PrintByOrder_Option` for access.
  - `Print_Label` to print at all.
  - `BP_Add_Lot_PrintTime` to create lots. This is **not** granted to the seeded Print group.
  - `Override_Lot_At_Print` for the lot override.
  - `BP_Reprint_Label` and `BP_Reprint_CanSign` to sign a reprint.

**Lot screen and print screen labels**
- The lot override checkbox's seeded caption is **"Override"**; "Override Lot Data" is only the
  markup default.
- Reprint fields are "User ID: / Password: / Reason: / Comments:". Scripts that say
  "Username/Comment" are wrong.
- The print ID renders below Reset with **no label**.

**Label-count warning**
- It is computed per job as Copy × Serial.
- The seeded text builds to "Number of labels to be printed exceeds 5. . Continue printing?" (a
  double period and lowercase "printing"), in a "Confirm Copies" dialog with Yes/No.

**Reprint determination**
- `S_Reprint` prints "O" on an original and "R" on a reprint.
- With ReprintBasedOnBatchQty `Y`, a print is a reprint once the originals printed ≥
  ceil(BatchQty × multiplier) + extra. The count is per lot + item + label type.
- A blank batch quantity behaves like `N`.

**Time zone offset**
- The Codes CodeType is `TZ_{client machine name}` and Code is a Windows time zone ID.
- It applies only when the lot's Manufactured date is blank and GetMFGDateFromWorkstation is `N`.

**Prompts and shelf life**
- The template prompt share name must be lowercase `prompt/`, because the match is case-sensitive.
- Shelf life comes from PrintConfig `ItemShelfLifeFieldName`, not from the legacy Settings value
  that BPMasterData1.2 cites.

**Label Type Exclusions**
- The menu entry is "Label Type Excl." (Settings), with process `Maintain_LabelType_Exclusions`.
- Checked means **excluded**, and each change saves immediately.
- "Add" only lists the workstation; nothing is saved until a box is checked.
- Excluded label types are simply **not offered** at label type selection. The only message is
  shown when all label types are excluded: "No printable label types for this workstation due to
  label type exclusions."

**Audit reporting in InnoView**
- **21 CFR Part 11 Reporting → Activity History** has these actions: "Print - Print Request",
  "Print - Reprint Signed", and "Print Time Redline Cancellation".
- The Print Time Redline cancellation is saved with a **blank workstation**, so leave the
  Workstation filter on "all" when searching for it.
- **Print History** reports need `Innov_ViewPrintHist`. PrintHistory.SerialNum stores the serial
  **count**, not a serial number.
- There is no InnoView report for PrintRequestsHistory or `x_labeltypeexclusions`.

**Print Time Redline**
- Printer User Commands is a DynamicUI page (Settings, process `Printer_User_Commands`). The row is
  matched on the Windows computer name and the exact printer name.
- On Close, the Reason Code dialog opens **on top of** the compare window, which stays open until
  Submit. The validation message is "This field is required." with a period. The reason code list
  uses CodeType `PrintRedlineComparisonReason` (seed: General).
- The comparison PDF is saved as `Compare_{PrintID}.pdf` (File Purpose "Print Time Redline"),
  including for cancelled jobs.
- The serial dialog is titled "Serial Number Management".
- Client prerequisites: the Sentinel plugin registered and active, the WebView2 runtime, and the
  PDFCompare service.

**BPSecurity1.2–1.4 and BPVersionSelect1.1 (code-verified 2026-09-24)**

Print by order security:
- **Unapproved item:** the message is "No approved effective item found", with no order number and
  no period. The script's "...for this order. S01." is legacy code 10043. An approved item whose
  template is unapproved gives "No approved effective item/label combination found." plus the item
  number instead.
- **Reprint without permission:** "This is a reprint, but the user is not granted the Reprint_Label
  permission." Print is disabled. The message omits the `BP_` prefix even though the process is
  `BP_Reprint_Label`.
- **Signer without sign authority:** "User cannot sign for reprint." followed by a new line and
  "UserID: X, Security: BP_Reprint_CanSign".
  - `BP_Reprint_Label_CanSign` (named in BPSecurity1.4) does not exist.
  - The legacy Security.CanSign column is unused on the web path.
  - Self-signing is allowed.
  - Reason is mandatory: "Please select a reprint reason."
- **Lot override:** needs no e-signature. BPSecurity1.3 step 1.5 asks for credentials only because
  S01 was already printed, which makes that print a reprint. The seeded Print group includes
  `Override_Lot_At_Print`.
- **Default printer:** comes from the last PrintHistory row for the same label and workstation, not
  from a cookie.

Version Printing override prompts are hard-coded in `VersionSelection.ascx.cs`:
- "No approved effective Item.  You must click OK to override." (single Ok button)
- "Please select the Item version."
- "Warning!  Item is not effective." / "Warning!  Item is not approved."
- "Proceed with version: N"
- The template prompts are the same with "Template" in place of "Item".

The versions listed depend on the four `Print_*` processes. No e-signature is involved. The scripts
quote all of these messages slightly wrong ("You must override.", "Warning.").

**Script defects**
- BPLblTyp1.1 skips step 3.8, which step 3.9 cites.
- BP21CFR 6.2 cites "Step 2.1"; it should be 6.1.
- BPMasterData1.4 step 2.4 never selects the mandatory reprint Reason.
- BPMasterData1.5 step 2.2 is ambiguous about how many copies must be printed before the Reprint
  checkbox turns on.

### Test Print (partially live-tested)
`BP_Test_Print` and `BP_Test_Print_Override` are real, confirmed security processes (toggle at
Security Management as usual). The `Test` checkbox itself shows on the print screen whenever the
relevant PrintConfig's `TestPrintShow=Y` (confirmed `Y` for the `LotNumber` config in this
environment). The **required-test-print gating** (`TestPrintRequiredForLot` /
`TestPrintRequiredForSession`, which should lock the checkbox until a test print is performed for
users lacking `BP_Test_Print_Override`) could **not** be exercised: setting
`TestPrintRequiredForLot=Y` via Print Config Management took effect in the grid immediately but had
**zero effect on live print behavior** — a brand-new never-printed lot printed straight through for
a user missing the override process, exactly as if the setting were still `N`. This confirms
`BP_TestPrint1.2`'s own documented requirement for a server-side IISRESET after any `TestPrint*`
PrintConfig change — the running application caches these values and a plain config-table edit
doesn't invalidate that cache. Revert any `TestPrint*` PrintConfig edit back to its original value
if you can't also perform the IISRESET, since it won't be doing anything anyway.

### Out of scope (infrastructure gaps)
- **Lot Batch Quantity Adjust**, **Serial Prefix Trigger** — need `ROBAR_ERP_XML_In` drop-folder
  service, reachable only via RDP to the print server.
- **Purchase Order Printing** — needs custom stored procedures (`SP_PurchaseOrderPrinting`,
  `SP_PurchaseOrderPrinting_NewLine`) and a pre-existing "Vendors" Master Data schema.
- **Print Time Redline Comparison** — likely needs the Sentinel desktop client
  (`Innovatum.Sentinel.Plugin.PrintTimeRedlineCompare`).
- **Preview Signature** — multi-party e-signature gate (`BP_Preview_Sign_Labeling/QA/Operator`
  security processes); needs PrintConfig edits + IISRESET + 4 provisioned accounts.
- **Serialization Flag** — needs a direct PrintConfig DB edit with no UI path
  (`IsSerializedShareName`) plus a pre-configured Master Data schema field (`m_IsSerialized`).
- **Single Piece Flow Printing** — its own setup requires `PrintEntityRequired = Y`, the opposite
  of what every other script (and this environment, by inference) assumes as the default `N` —
  changing it would violate the standing "no GlobalSettings changes" rule.
- **Test Print's required-test-print gating** (`TestPrintRequiredForLot`/`...ForSession`) — needs
  a server-side IISRESET after the PrintConfig change; see above.
- **DX Printing** — confirmed not configured in this environment.

### Not yet tested (in scope, just not reached)
Misc Printing (needs from-scratch Codes/Label Type/Template/Item setup, plus a second test
user+group for one of its four scripts), Serial Management's core Add One/Add Series/duplicate-
detection mechanics (looks genuinely browser-testable, just not reached this pass — the
`PrintEntityRequired`-toggling sections specifically share Test Print's IISRESET dependency above
and should be skipped), Single Serial Printing (`BP_SingleSerialPrint`, `BP_LotSerialMustExist` —
needs a wider pre-seeded item/lot/MDM-schema set than either pass had time to build, plus some
verification substeps need direct SQL/file-share access regardless).

---

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

## Security Management

**Purpose:** The module that governs itself and every other module in this engagement — creates
and edits `Users` and `Groups`, and toggles the `Security` table's per-Group (or per-ungrouped-user)
process authorizations that every other module's `<Prefix>_<Action>` gates read from. Testing it is
inherently recursive: it's the same screen used throughout this engagement to grant/revoke MBUser*
permissions for negative-permission tests in other modules.

**Formal scripts reviewed:** all 6 files under `Security_Management\7.0.2\` (5 test-case areas; see
`.agents/exploratory-session-log-security-management.md` for the full write-up). A
`Versioning - ReadMe.txt` in the same folder notes `Web_Security` was deprecated (DIT #1953) and
removed from the -1.1/-1.3 scripts — already reflected in the current script text.

### Layout: Users vs Groups radio, two-grid design
`Users` / `Groups` radio toggle at top-left. **Groups** (default view): `Group contains` free-text
filter + `Apply Filter`, primary grid (`Group`, `Description`), `+`/pencil icons bottom-left.
**Users**: adds a `Show Active Users Only` checkbox and a `UserID`/`Full Name`/`Group` dropdown +
`contains` field (instant-filter, no separate button); primary grid gains `UserID`, `Full Name`,
`Group` columns. Both views share a secondary grid on the right: `Process`, `Auth` (checkbox),
gated by `Process contains` (instant, case-insensitive, no Apply button needed) and a top-right
`Show processes which are: Authorized / Unauthorized / Both` radio group, plus a `Select All`
checkbox. Hovering a process name shows its description in a native `title`-attribute tooltip
(confirmed via DOM inspection — not always visible in an automated screenshot even when working).

### Add/Edit Group dialog (`+` / pencil icons)
Create mode: `Group` textbox, `Description of Group` textbox, `Copy Security Settings From`
dropdown (any existing Group or User — copies that entity's full process-authorization set onto
the new group), Submit/Cancel. Edit mode (pencil, or double-click a row): identical minus the
`Copy Security Settings From` dropdown; `Group` textbox renders **genuinely disabled** (confirmed
by selecting its text and typing over it — value doesn't change), `Description of Group` is
editable. Validation: `"The Group field cannot be left blank"`, `"Group already exists with
GroupID: <X>"` (blocks even if Description differs).

### Add/Edit User dialog (`+` / pencil icons, Users view)
Create mode fields: `User Id`, `Full Name of User`, `Email Address`, `Facility` dropdown, `Group`
dropdown, `Time Zone` dropdown (required — client-side blocks Submit with `"TimeZone is required"`
before any server round-trip happens, so a duplicate-UserID or blank-required-field test needs
every other required field filled first or the *first* client-side error masks the one you're
trying to trigger), `Active User?` (checked by default), `Authenticate Against Active Directory?`,
`Reset password at next logon` (checked by default), `Password`/`Confirm Password`, `Copy Security
Settings From`. Edit mode drops Password/Confirm Password/Copy Security Settings From entirely and
renders `User Id` **genuinely disabled** (same overtype-test confirmation as Group). Validation:
`"The User ID field cannot be left blank"`, `"User already exists with UserID: <X>"`,
`"FullName is required"` — **note the missing space**, a minor cosmetic discrepancy from the
field's own label "Full Name of User" (see the session log's Finding 2).

### Group-membership security inheritance (the core mechanic)
An **ungrouped** user's row in the Users view shows their own individually-editable process
checkboxes (white/enabled, assuming the logged-in tester has `Security_EditSecurity`). The instant
that user is assigned to a Group (via the Add/Edit User dialog's `Group` dropdown), their
checkboxes are replaced wholesale with that Group's current authorization set and become
**disabled** at the user level — greyed but still checked/unchecked to match the group. Removing
the user from the group (`Group` dropdown → `Choose one...`) reverts them to their own
individually-editable set, defaulting to all-unauthorized. This inheritance-on-assign/revert-on-
remove behavior is instantaneous and confirmed live, not just per the formal script's description.

### Split-permission model: `Security_EditUsersAndGroups` vs `Security_EditSecurity`
These two processes gate genuinely independent halves of the module, confirmed by testing both
directions live with a real negative-permission user (MBUser2 / MBSomeSecurity):

| Has `Security_EditUsersAndGroups` | Has `Security_EditSecurity` | `+`/pencil icons | Process checkboxes |
|---|---|---|---|
| ✅ | ❌ | Present, functional (minus `Copy Security Settings From` in Add/Edit Group) | Disabled |
| ❌ | ✅ | **Absent entirely** — not just disabled, not rendered at all | Enabled, fully editable |
| ✅ | ✅ (normal admin, e.g. MBUser1) | Present, full-featured | Enabled |

Neither process alone grants full module access — a user needs both to fully administer Security
Management. `View_Security` alone (no edit process) grants read-only module access only.

### Playwright-confirmed 2026-10-04 (`tests/Security-Management/`, helpers `tests/support/security.ts`, all 3/3)
Source: `Innovatum.Pages.SecurityManagement.MVC` (Views/Security/Management.cshtml, AddEditGroup/AddEditUser.cshtml) + `Innovatum.Pages.Security.WCF`. Run as the seed user; **only MB\* users/groups are ever written** (`assertMb()` guard). Groups and users can never be deleted, so `Security_Groups` / `Security_Users` leave one `MBPWG<stamp>` / `MBPWU<stamp>` behind per run (user deactivated); `Security_Effect_On_Login` uses two FIXED fixtures, group `MBPWLoginGrp` + user `MBPWLogin01` (password = seed password, no forced change).
- **Anatomy.** Frame `InnoPages/Security/Management`. Plain tables (NOT jqGrid): `#group_tableBody_tbody tr` (`td#groupID` + description), `#user_tableBody_tbody tr` (`td#userID #fullName #groupID`, hidden `td#userEnabled input`), `#processes_tableBody_tbody tr` (name td + `input.process_cb`, 412 processes on TST703). Radios `#rbUsers/#rbGroups`, `#rbAuth/#rbUnauth/#rbBoth`; filters `#groupFilterInput`+`#btnApplyGroupFilter`, `#userFilterColumnSelect`(USERID/FULLNAME/GROUP)+`#userFilterInput`+`#btnApplyUserFilter`, `#cbActiveUsersOnly`, `#processFilterInput` (**listens for `keyup` only — `fill()` needs a dispatched keyup**), `#cbSelectAll` (its container is hidden whenever a filter hides rows). Row click → `GetSecurityProcesses`; double-click opens Edit. Add/Edit icons `#btnAddRecord/#btnEditRecord` exist only with `Security_EditUsersAndGroups`; checkboxes are enabled only with `Security_EditSecurity` AND for an ungrouped user or a group.
- **There is no Save button.** Every process checkbox POSTs immediately (`UpdateSecurityProcess {userOrGroupId, process, isEnabled}`; Select All → `UpdateAllSecurityProcesses`) and persists across a reload. Add/Edit dialogs (`#addEditGroupDialog` / `#addEditUserDialog`, Submit/Cancel buttons) reload the whole Management page on success (`DefaultView=GROUP|USER`).
- **Group dialog:** ids `#group_input_groupid/_description/_copysecurity`. Messages: blank → "The Group field cannot be left blank" + **"Description is required"** (Description is mandatory); max 30 / 80 chars → "GroupID can not be longer than 30 characters" / "Description can not be longer than 80 characters"; duplicate (case-insensitive) → an error dialog "Group already exists with GroupID: X" + Continue (not an inline message). Copy-from entries read `GROUP - <name>` / `USER - <id>`; copying gives the new group exactly the source's authorizations. Edit mode: Group name disabled, Copy row present but hidden.
- **User dialog:** `#users_input_userid/_fullname/_email/_facility/_group/_timezone/_active/_adauth/_resetpassword/_password/_confirmpassword/_copysecurity`. Defaults: Active on, AD off, **Reset password at next logon ON** (uncheck it for a user who must log in directly). Blank → "The User ID field cannot be left blank", "FullName is required", "TimeZone is required", "Password is required"; too long → "UserID/FullName/Email can not be longer than 30/80/255 characters"; "Password values do not match"; duplicate → error dialog "User already exists with UserID: X". Group and Copy-security are mutually exclusive (picking one disables the other). Edit mode: User Id disabled; Active unchecked → row greyed (`rgb(170,170,170)`) and hidden by "Show Active Users Only".
- **Inheritance:** an ungrouped user has its own editable set (a created-with-copy user got 391 of the source group's 392 after one toggle). Assigning a group shows the group's set, all checkboxes + Select All disabled. **Removing the group leaves the user with NOTHING authorized (0) — the earlier individual set is gone** (tracker observation).
- **Security effect (live, as MBPWLogin01 in a second browser context):** the Web Menu login requires **`Login_WebMenu`** (`Web/WebMenu/Default.aspx MustBeAuthorizedFor`); without it the login form shows "User not authorized for this task." and no menu. With only `Login_WebMenu` the Main Menu shows just "Prompt Samples"; `MD_Management_Option` adds the **Master Data** tile, `MD_JobInquiry_Option` adds **MD Job Inquiry**, `View_Security` adds **Security Management**; removing a process removes its tile on the next login. With only `View_Security` the Security page is read-only (no Add/Edit icons, every checkbox + Select All disabled).
- **CRITICAL finding (tracker):** the write endpoints have no server-side authorization — that read-only user POSTed `UpdateSecurityProcess` for an MB group and the server returned `Success:true` and changed it (3/3). `UpdateUser/UpdateGroup/UpdateAllSecurityProcesses` look the same in code but were not posted.

### Out-of-scope this session
`BP_Reprint_CanSign` live e-signature reprint testing (Security_Management-1.4 covers Print by
Order, -1.5 covers Multi Document Printing) — both need an existing printed order/lot/item
combination plus `PrintConfig` entries (`NeedESignatureForReprint = Y`) not set up this session.
Reading these two scripts did surface a resolved cross-reference to a prior open question from the
Browser Printing session — see the session log's Finding 1: the reprint-block message
`"...not granted the Reprint_Label permission"` (no `BP_` prefix) is the scripts' own documented
expectation here, meaning the Browser Printing session's flagged discrepancy was the *older*
`BPSecurity1.3` script being stale, not a product defect. All DB-level audit-trail verification
steps (`Users`, `X_Users`, `Groups`, `X_Groups`, `Security`, `X_Security`) — no direct SQL access
this session, consistent with every prior module.

---

## Print by Lot (ROBAR Print Screen / Lot Panel)

**Formal UAT executed:** `UAT_6356.doc` (2026-09-09, DIT #6356 — "the JavaScript is not
interpreting the disabled attribute of fields properly," scoped to the `Manufactured` field). All
16 steps passed; see `.claude/skills/uat-execution/SKILL.md` for the execution process itself.

**Formal scripts reviewed:** `PE_PrintByLot.doc` (network share, `Print_Entity\`), read fully
2026-09-29. The real formal-script home for this screen turned out to be the `Print_Entity`
top-level share folder (`PE_*` prefix), not a folder named after "Print by Lot" itself — 16 sibling
`PE_*` scripts (`PE_PrintByLotMulti`, `PE_PrintByOrder(Multi)`, `PE_VersionPrinting`,
`PE_FlexPrinting`, `PE_MultiDocumentPrinting`, `PE_LotManagment(_Import)`,
`PE_PrintEntityManagement`, `PE_(User)PrintEntityManagement`, `PE_UserPrintEntityUpdate`,
`PE_ServerPrinting`, `PE_MiscPrinting`, `PE_PrintHistoryInquiry`, plus a `PrintEntity_TestPlan.doc`)
remain unread as of this pass — only the one most directly relevant to Print by Lot's own screen was
read this session.

### Live bug found 2026-09-30: `KeyNotFoundException` in the AlphaNumeric Counter/DataMatrix pipeline — NOT specific to Print by Lot
Discovered live (user hit it printing item `MI093002`/Carton Label via Print by Lot, `http://
vmsrvval703`) and root-caused via a real `AppLog_*.log` + a codebase search — **this is a
print-SERVER-side bug in the DataMatrix/Counter feature, not a Print by Lot (or even web-menu) bug
specifically** — it would fire from ANY print screen printing a label that uses the AlphaNumeric
Counter feature, given the same misconfiguration. Filed here because Print by Lot is where it was
found, but don't assume it's scoped to this one screen.

**User-facing symptom**: a blank-titled dialog reading `"Print request failed. The given key was
not present in the dictionary."` — the generic `InnoUserException` wrapper
(`Lib/Src/DotNet/Innovatum/Exceptions.cs:767-772`, localized prefix `Err_RobarFoundation.
Print_Request_Failed`) concatenating the raw `.Message` of whatever exception the print SERVER
(not the web app) caught, stored verbatim in `printRequests.ResponseMessage` and echoed back to the
browser after `PrintOptionSelectionController.cs:921-922` polls `PrintRequests_Completed`.

**Confirmed root cause** (log stack trace, 100% reproducible — 4/4 identical failures in one log):
```
System.Collections.Generic.KeyNotFoundException: The given key was not present in the dictionary.
   at System.Collections.Generic.Dictionary`2.get_Item(TKey key)
   at Innovatum.PrintServer.Lib.Server.PrintRequest.PrintRequestStaticWorker.counterReachedEndSequence(Item item, String& errorMessage)
   at Innovatum.PrintServer.Lib.Server.PrintRequest.PrintRequestStaticWorker.doDataMatrix(PrintApp btEngine, Print_Request printRequest, PrintRequestData[]& dataList)
   at Innovatum.PrintServer.Lib.Server.PrintRequest.PrintRequestStaticWorker.SatisfyRemotePrint(...)
   at ...DoPrint(...) at ...WorkFromQueue(...)
```
`counterReachedEndSequence` (`Innovatum.PrintServer.Lib/Server/PrintRequest/
PrintRequestStaticWorker.cs:632`) does:
```csharp
string fieldName = SystemSettings.GetSetting("Counter_DictPhrase_FieldName").Value;
Dictionary<string, string> itemFields = item.FieldsAsString();
countersRow = dbConn.Counters_Get(itemFields[fieldName]);   // raw indexer, no TryGetValue/ContainsKey
```
`doDataMatrix()` only runs this path when the printed template includes the AlphaNumeric Counter
share name. The `Counter_DictPhrase_FieldName` GlobalSetting (`SettingOwner = 'LegacySettings'`)
**installer-seeds to a blank string** (`GlobalSettingsDefaultRecords_LegacySettings.cs:35`) —
`item.FieldsAsString()` is keyed by real master-data field names, so a blank (or any
misconfigured/mistyped) value is guaranteed not to be a key → the indexer throws. A sibling
unguarded indexer exists one call deeper too (`DataMatrix.cs:227-236`,
`AlphaNumCounter.CounterDictionaryPhrase`), same setting, same failure mode, just not reached first.

**Fix (data, not code)**: check `GlobalSettings` where `SettingName = 'Counter_DictPhrase_FieldName'`
and `SettingOwner = 'LegacySettings'` — it must be set to a real field name that exists on the
printed item's master data. **CONFIRMED FIXED 2026-09-30** — applied and re-tested, error no longer
occurs. A proper code fix (replace the raw indexer with `TryGetValue` and throw a clearer,
actionable message identifying the bad field name) would still be worth raising separately, since
the underlying unguarded-dictionary-lookup pattern remains in the code — but the immediate,
blocking issue is resolved. **Dedicated Counters-functionality testing is planned for later** —
this incident surfaced the AlphaNumeric Counter/DataMatrix feature as something worth a real formal
pass of its own, not yet started.

### Print Entity assignment mechanics (from `PE_PrintByLot.doc`, distinct from the Manufactured-field bug above)
A **Print Entity** (`PE1`/`PE2`/etc., managed in Print Entity Management) is a separate concept from
the Manufactured-field business rule above — it governs which named entity's data (e.g. an
`L_PrintEntity` template sharename) gets burned onto the label, and which user can print for which
entity:
- **`PrintEntityRequired` GlobalSetting** (`SettingOwner = 'Innovatum'`) is the master switch: `N` →
  the Print Entity drop-down doesn't render on the Print by Lot screen at all, and any authorized
  new-lot-at-print-time insert auto-assigns a hardcoded Print Entity of **`ROBAR`**. `Y` → the
  drop-down renders, populated with only the ACTIVE Print Entities assigned to the logged-in user
  (an inactive one assigned to the user, e.g. `PE1` in this script, never appears even though it's
  assigned). Changing this setting needs an IISRESET to take effect — same restart requirement
  pattern as other GlobalSettings changes.
- **`BP_Add_Lot_PrintTime`** security process gates whether a user can create a brand-new
  Lot/Order/Item combination directly from the Print by Lot screen when the entered Lot doesn't
  resolve to an existing record — without it: `"User not authorized for this task."` and the print
  job cannot proceed, even though the screen itself opened fine.
- **User↔Print-Entity assignment cardinality drives three distinct drop-down states**: zero active
  Print Entities assigned (or none assigned at all) → hard block, `"No active Print Entities
  associated with this user. Cannot proceed."`, both on initial load AND after clicking Next. Exactly
  one active Print Entity assigned → drop-down still renders but is **pre-selected and grayed out**
  (not editable, not hidden). Two or more active → a real editable drop-down, default-sorted
  **ascending**, but overridden to **default to the user's own last-used active Print Entity** per
  their most recent `PRINTHISTORY` row once one exists (not just alphabetically-first anymore).
- The selected Print Entity is written to the `LOTS` table row for that Lot/Order/Item combination
  (confirmed via Lot Management's own grid showing the assigned Print Entity column) and burns onto
  the printed label wherever the template binds the `L_PrintEntity` sharename.

### Remaining `PE_*` scripts read 2026-09-30 — full module now covered
Read all 16 remaining scripts in `Print_Entity\` (`PrintEntity_TestPlan.doc` index plus every `PE_*`
script except `PE_PrintByLot.doc`, covered above). Net new findings, organized by area:

**The same PE-assignment mechanic repeats verbatim across every print module entry point, just
swapped security-process name and PrintConfig `ConfigName`** — confirmed by fully reading
`PE_PrintByOrder.doc` and grep-scanning `PE_PrintByLotMulti.doc`, `PE_PrintByOrderMulti.doc`,
`PE_ServerPrinting.doc`, `PE_VersionPrinting.doc`, `PE_MiscPrinting.doc`, `PE_PrintByOrderLot.doc`,
`PE_FlexPrinting.doc`, `PE_MultiDocumentPrinting.doc`. Same exact requirement IDs
(`PE.161004.F.6.1`-`.8`), same exact GlobalSettings/messages/drop-down behavior as `PE_PrintByLot`
— only the module name, the gating security process (`BP_PrintByOrder_Option`,
`BP_PrintByLotMulti_Option`, etc.), and the `PrintConfig` `ConfigName` (`Print1`, `LotNumberMultiple`,
etc.) change per screen. **One real, non-obvious exception**: the "no lot found" error message is
NOT identical between single-record and multi-record ("...Multi") print screens — the single-record
screens (Print by Lot, Print by Order) show a plain `"No Lot found."`/`"No lot found"`, while the
Multi screens show a longer, batch-aware message: `"No Lot found for this order/lot/item
combination. Please fix or continue. <LOT>"` (with a Fix/Continue affordance, since a Multi screen
processes several rows at once and shouldn't abort the whole batch over one bad row). Don't assume
that message text transfers between a screen's single and Multi variant.

**`PrintEntity` is part of the `LOTS` table's own primary key, not just a plain column**
(`PE_LotManagment.doc`'s own stated assumption: "not null constraint and is part of the primary
key") — meaning the exact same Lot/Order/Item combination can legitimately exist as MULTIPLE
distinct `LOTS` rows differing only by Print Entity (confirmed live in the script: the same
ORD1/LOT1/ITM1 combination is added twice, once under PE2 and once under the default `ROBAR`, both
coexisting). Don't assume Lot/Order/Item alone uniquely identifies a lot record in this schema.

**Lot Management (`PE_LotManagment.doc`, 564 lines):** a `Print Entity` column appears in the Lots
grid; search results and the Add-Record dialog's Print Entity drop-down are both filtered to the
logged-in user's own assigned print entities (ACTIVE only for the drop-down; active+inactive for
search-result filtering). Exactly one assigned active entity → the Edit dialog's Print Entity field
is pre-populated and **disabled** (can't be changed), same single-entity-lock pattern as the print
screens. Zero active entities assigned → Add dialog's Print Entity field is blank+disabled AND the
Submit button is disabled (can't add a lot at all). A user entirely absent from `UserPrintEntity`
→ `"No records to view"`, every icon disabled (not just filtered results — total lockout). When
`PrintEntityRequired = N`: the Print Entity column/field disappears from the Edit dialog entirely
(not just made optional), and any new lot record is silently written with `ROBAR`.

**Lot Management Excel Import (`PE_LotManagment_Import.doc`, 440 lines):** three distinct exact
validation-tooltip messages on the Print Entity column, each for a different bad input: `"Print
Entity is not linked to the UserID: <user>"` (a real PE value the importing user isn't assigned to),
`"This column does not allow null values."` (blank cell, when `PrintEntityRequired = Y`), and — a
genuinely surprising one — `"ROBAR is a required value for this column"` when
`PrintEntityRequired = N`: with the setting off, the import doesn't just ignore the column, it
actively REJECTS any value in it other than the literal string `ROBAR` (confirmed against both a
blank cell and an explicit real Print Entity value, both rejected with the same message). A
successful import shows `"Validation Successful"` then a `DisplayId` + `"Upload Successful"` message
(standard job-submission pattern, same shape as other modules' Excel Import features).

**Print History Inquiry (`PE_PrintHistoryInquiry.doc`, 380 lines):** `Print Entity` is a configurable
column (via the `PrintHist_List` GlobalSetting) and search/sort field (`PrintHist_Criteria`) in the
Print History grid, also shown on the row-level "See Detail" dialog, and surfaced a third place — the
InnoView "View Print History" report — as an optional search-criteria field. Same access-scoping
pattern as Lot Management: a user absent from `UserPrintEntity` sees no records at all; a user with
`*` (ALL) sees everything unfiltered; `PrintEntityRequired = N` removes the Print-Entity-based
filtering entirely for search results.

**Print Entity Management (`PE_PrintEntityManagement.doc`, 559 lines) — the CRUD screen for Print
Entity records themselves:** standard shared-grid layout (Add Filter/Retrieve Data/Reset, `+`/pencil
icons). `PE_View_PrintEntityMgmt` gates module visibility entirely (module link absent, not just a
disabled screen). `PE_Maintain_PrintEntity` (separate from the View process, same split-permission
pattern as Security Management's `EditUsersAndGroups`/`EditSecurity`) gates the `+`/pencil icons —
without it, both are disabled and double-clicking a record for edit shows `"User not authorized to
edit"`. Add dialog: `Print Entity Name` (free text, becomes disabled immediately after Save — can
never be renamed after creation, confirmed both live and by direct `PrintEntity`/`X_PrintEntity`
table query), `Print Entity description`, `Active` checkbox (**unchecked by default**, unlike most
other modules' "active by default" convention). Validation: `"Field cannot be blank"` (name),
`"Print Entity already exists"` (case-insensitive duplicate check — confirmed by attempting the same
name in all-uppercase against an existing lowercase one). A separate `PE_View_UserPrintEntity`
process (checked independently) gates whether a link to User Print Entity Management even appears on
this screen.

**User Print Entity Management (`PE_UserPrintEntityManagement.doc`, 260 lines) — the read-side
grid of user↔print-entity relationships:** `PE_View_UserPrintEntity` gates the whole module;
`PE_View_PrintEntityMgmt` (independently) gates whether a link back to Print Entity Management shows
on this screen — same cross-linking permission-independence pattern as the reverse direction above.
Grid columns: `User ID`, `Full Name`, `Security Group`, `Active User`, `Facility`, `Print Entity` —
plus a `Select All` checkbox and per-row checkboxes feeding the Bulk Actions dropdown (the only
action being "User Print Entity Update," covered next).

**User Print Entity Update (`PE_UserPrintEntityUpdate.doc`, 961 lines, 34 sub-requirements) — the
richest script in this batch, the actual assignment-editing screen:** reached via User Print Entity
Management's Bulk Actions dropdown (`"Please select record(s)"` if none checked). A tri-state
checkbox grid (checked/unchecked/**indeterminate**) lets one assignment operation apply to MULTIPLE
selected users at once: a Print Entity checked for ALL selected users shows a plain checkmark; one
assigned to only SOME of the selected users renders **indeterminate (-)** — clicking an indeterminate
box moves it to checked (assign to everyone), clicking again unchecks (remove from everyone).
**The `All(*)` wildcard row is mutually exclusive with every named Print Entity**: checking `All(*)`
immediately disables and unchecks every other row in the grid (can't hold both a specific entity AND
the wildcard); the reverse isn't tested but the disable direction is one-way in the script's own
flow. A filter dropdown (`Any (Print Entity)` / `With Assigned Users` / `With Unassigned Users`)
narrows which Print Entity rows show, independent of the tri-state values themselves. Clicking away
to the "User Print Entity Management" link with unsaved changes prompts `"Changes will not be saved.
Would you like to Proceed?"` (Yes/No). Update succeeds → `"Update successful"` and the screen
collapses back to just the link (grid/search/Update button all hidden) — matches the
job-submission-style "success replaces the form" pattern seen elsewhere. **Failure handling**: if
`ROBAR_ServiceHost` is stopped mid-edit and Update is clicked, the message is specifically `"Update
failed. Service Host is not running"` (not a generic error) — a good concrete example of this
family of message for other modules' own ServiceHost-down scenarios. All changes are audited to
`X_UserPrintEntity`, independently viewable via InnoView's own `"X User Print Entity"` report
(User ID dropdown + free-text Print Entity search field, no security-scoping mentioned for this
report itself).

**Remaining gap:** none — all 17 `Print_Entity\` scripts have now been read. This closes the one
module-wide first-read gap flagged 2026-09-29.

### Navigation and screen structure
Main-menu tile "Print by lot" (`div.menuIconBtnText`, exact text — don't let a substring match
also catch "Print by lot multi") loads `Innovatum/ROBAR/printing/Screens/PrintScreen.aspx?
ConfigName=LotNumber` into an iframe. Two-stage flow: an initial lot-resolution screen (`Lot
Number` / `Item Number` / `Order Number` text fields + `Next`/`Reset`) — if the lot number alone
resolves unambiguously, it skips straight to the Lot Panel; if ambiguous or new, it prompts for
Item/Order too. The **Lot Panel** itself shows `Lot`, `Order`, `Expires`, `Manufactured`,
`Reassay`, `U1`-`U5`/`Batch Qty` fields (each date field paired with its own
`img.ui-datepicker-trigger` calendar icon, inserted as the field's own `nextElementSibling` in the
DOM — target a specific field's icon that way, not by icon index, since Expires/Manufactured/
Reassay each have one), plus an `Override Lot Data` checkbox (`#ctl00_printContentHolder_deLot_
chbLotOverride`) that only renders when `Override_Lot_At_Print` is granted.

### Manufactured field's Enabled/Disabled business rule (confirmed via UAT_6356, all 16 combinations)
A strict priority hierarchy, highest wins:
1. **`BP_AllowMfgChangeAtPrint`** security process, if granted on the user's role/group →
   Manufactured **unconditionally Enabled**, regardless of the Override checkbox's state, whether
   `Override_Lot_At_Print` is even granted, the lot's print history, or the EditMode resource
   (item 4 below). If `Override_Lot_At_Print` isn't also granted, the checkbox isn't displayed at
   all — the field is still Enabled.
2. **`BP_AllowMfgSetAtPrint`** (only relevant if `BP_AllowMfgChangeAtPrint` is NOT granted) → forces
   Enabled **only when the lot has never been successfully printed** (no `PrintHistory` row with
   `PrintStatus = 'Printed'` for that lot). The instant a lot has any such history, this process
   stops applying — falls through to item 3 — regardless of Override checkbox/EditMode.
3. **Absent both processes** (or a lot with prior print history, for #2): the field's default is
   **Disabled**, and neither checking the `Override Lot Data` checkbox nor the EditMode
   localization resource (below) can force it Enabled without one of the two named processes.
   `Override_Lot_At_Print` alone only controls whether the checkbox is *displayed* — it does not
   by itself change the field's default state.
4. **EditMode localization resource** — `LocalizationResourceDef` row: `ResourceType =
   'Innovatum.ROBAR.Printing.Web.LotEntry.Lot.Lot_Manafactured'` (note the real, in-DB literal
   typo "Manafactured" — reproduce it exactly), `ResourceKey = 'EditMode'`, `ResourceValue =
   'Enabled'`/`'Disabled'`. **Confirmed via UAT_6356 that this resource has no independent effect
   on the field's Enabled/Disabled state at all** in any of the 16 tested combinations — it's
   fully subordinate to items 1-3 above. (A UAT step's own prose named a different, incorrect
   `ResourceType`/`ResourceKey` pair — `'Innovatum.ROBAR.Printing.Web.LotEntry'` /
   `'Lot_Manafactured'` — that doesn't match the actual table; the identifiers above are the real
   ones, confirmed by the tester's own `SELECT` against `LocalizationResourceDef`.)

**The calendar-icon interactivity is the actual DIT #6356 symptom, and now correctly tracks the
field's Disabled state** (fix confirmed working): when Manufactured is Enabled, its icon carries
`style="opacity: 1; cursor: pointer;"` and clicking it opens a live `#ui-datepicker-div` popup.
When Disabled, the icon's own style becomes `opacity: 0.5` and a click no longer opens the
popup — this is the concrete, DOM-verifiable proof the underlying bug (the icon remaining
interactive despite a disabled field) is fixed. Don't rely on a screenshot alone to prove this —
read the icon's `style` attribute and confirm the click's actual effect on `#ui-datepicker-div`'s
visibility.

### Test-user gotcha: `MBAllSecurity`-style "everything granted" groups contaminate this specific test
A group described as having "all functions included and authorized" (this corpus's
`MBAllSecurity`) already behaves as if it has one of `BP_AllowMfgChangeAtPrint`/
`BP_AllowMfgSetAtPrint` granted by default — a brand-new, never-printed lot showed Manufactured
Enabled for that group's test user with no process explicitly checked. **For this specific
business rule, use a group with a small, precisely-controlled set of processes** (this corpus:
`MBSomeSecurity` via `MBUser2`) so each of the three relevant processes
(`BP_AllowMfgChangeAtPrint`, `BP_AllowMfgSetAtPrint`, `Override_Lot_At_Print`) can be toggled
independently without an unrelated already-granted process masking the result.

### Establishing a lot with real prior print history
The 16-step matrix needs both a never-printed lot and an already-printed one. **Completing an
actual print (Lot Panel → Next → print-options screen → Print) could not be driven reliably via
Playwright** — see the ASP.NET-AJAX/CSP entry under "Known testing-tooling limitations" below.
**Confirmed working via the interactive/real browser**: log in as the test user, Print by Lot,
Next through to the print-options screen, select a label type, and Print (a "Microsoft Print to
PDF" target is sufficient to create a real `PrintHistory` row — no physical printer needed). Ask
the user to do this one action in their own browser if Playwright can't complete it, then reuse
the resulting lot number for the rest of the run.

---

## Template Management

**Purpose:** Create, edit, approve, retire, and route BarTender (`.btw`, plus `.docx`/`.indd`)
label templates through workflow. Uniquely among ROBAR web modules, several core actions launch a
**native desktop app** (BarTenderEdit, via Innovatum's Sentinel plugin) rather than staying purely
browser-based.

**Formal scripts reviewed:** all 15 `TM_*.doc` scripts (`TM_CreateNewTemplate-1.6`,
`TM_LabelCharacteristics-1.1`, `TM_RetireTemplates-1.2`, `TM_ApproveTemplates-1.3`,
`TM_Comments-1.4`, `TM_Search&Filter-1.5`, `TM_ViewEditTemplates-1.7`,
`TM_SubmitToWorkflow-1.8`, `TM_SaveAsNew-1.9`, `TM_Approvals-1.10`, `TM_GetData-1.11`,
`TM_Replace-1.12`, `TM_LocalizationResources-1.13`, `TM_Edit_Attributes-1.14`,
`TM_Download-1.15`), read via Word COM automation (`.doc` is pre-OOXML binary, not readable as
plain text) since they don't ship as `.docx`. Source-grounded against
`Innovatum.Pages.TemplateManagement.MVC` (controller, `Management.cshtml`, `TemplateManagementModel.js`)
in the `MsBuild` repo rather than guessed — see `ROBAR_Tests/tests/support/bartender.ts` and
`ROBAR_Tests/tests/Template-Management/*.spec.ts` for the confirmed-live selectors this produced.

**Live exploratory session (2026-09-30):** drove the actual running app end to end via a throwaway
Playwright script (`tests/Template-Management/zz_Exploratory_Navigation.spec.ts`, not a permanent
test — kept for now since it still needs the fix noted below, delete or fix before relying on it),
focused on navigation/locators per the user's own request. Findings:

- **The grid table (`#grdJqGrid`) and its pager (`.ui-jqgrid-pager`) genuinely do not exist in the
  DOM at all before the first Retrieve Data** — confirmed via `.count()` returning 0 for both
  pre-search, not just hidden. Don't assume either is queryable on initial page load.
- **Bulk Actions (`#drpActions`) exists in the DOM pre-search but is not visible** (`isVisible():
  false`) until the grid has data — a previously-undocumented gating fact, the Bulk-Actions
  counterpart to Main Actions (`#drpMainActions`, which IS available and clickable pre-search, no
  search needed first — confirmed live, asymmetric with Bulk Actions).
- **A fresh filter row's default Column reads as `LabelName` on live re-check** — the existing
  "Search/filter widget" note above (written 2026-09-14) says a fresh row defaults to
  `ApprovalDateTime`. Reproduced consistently across multiple runs today. Not chasing down why it
  changed (environment data, a real product change, or the original observation being
  session/state-dependent) — flagging as the current confirmed-live behavior, supersedes the older
  note for this specific default.
- **A new, real Playwright/CDP-level gotcha, reproduced twice**: a locator action that resolves via
  `.catch()` (e.g. `.innerText().catch(() => fallback)` against a selector that may not exist) can
  leave the page/CDP session in a state where the *very next*, completely unrelated page-level
  operation (`page.screenshot()`, `page.keyboard.press()`) **hangs indefinitely** — not slowly, not
  with an error, genuinely forever, consuming the full test timeout. Root cause not understood;
  the fix is to avoid the pattern entirely — use `.count()` (resolves immediately, no actionability
  wait, zero-or-more) to check existence instead of a caught read, and give every custom locator
  action an explicit bounded `timeout` so a real problem fails fast instead of silently hanging.
  Worth remembering as a testing-tooling limitation for any future exploratory Playwright work in
  this app, not just Template Management.
- **A leftover/orphaned BarTender process from a prior interrupted test run can itself break the
  next run's Sentinel-launch-confirmation sequence** — reproduced live: with a stale
  `Innovatum.Sentinel.Plugin.BarTenderEdit` process already running from an earlier crashed
  attempt, `confirmSentinelLaunchPrompt` failed with "dialog never closed after repeated click
  attempts" two runs in a row; after the user manually closed the leftover process, the exact same
  script launched BarTender cleanly on the next attempt. `findBartenderProcess`'s own
  before/after-snapshot diffing already anticipates a leftover process existing, but apparently
  isn't sufficient to prevent this specific failure mode — always confirm no stale BarTender/
  Sentinel process is running before starting a fresh automated run, don't rely solely on the
  diffing fallback.
- **A genuine, reproducible precision gap found in `addTextObjectBoundToSharename`'s right-click
  step, confirmed via live visual inspection (not just automated failure)**: the object placement
  and "Center Horizontally/Vertically On Template" commands DO work correctly (confirmed: the
  Undo button read "Undo Center Vertically On Template" after the sequence, and a direct screenshot
  showed "Sample Text" genuinely centered on the label) — but the subsequent right-click, aimed at
  Workspace's own bounding-rectangle center as a proxy for the object's center, missed the object
  and landed on the label instead (confirmed by the user watching live: "Properties..." wasn't
  found because the context menu that opened was the label's, not the text object's). Workspace's
  own center is evidently close to but not exactly the same point as the template's/object's true
  center in this environment — small enough a gap that it had worked before, but not reliable
  enough to trust blindly.

  **FIXED 2026-09-30** — investigated by launching BarTender standalone via `BarTend.exe`
  (`C:\Program Files\Seagull\BarTender 2022\BarTend.exe`) directly, independent of the ROBAR web
  menu entirely (the user's own suggestion — BarTender is just a third-party desktop app, so
  there's no need to drive the whole Sentinel-launch round trip just to iterate on a FlaUI
  interaction against it). Root fix: the placed object stays selected after placement/centering
  (Arrange commands act on the current selection with no extra select-click needed), so
  `Edit > Properties...` (a real menu item, confirmed via dump-tree — carries the shortcut label
  "Alt+Enter", though the fix uses the menu click rather than the raw shortcut for explicitness)
  opens the exact same "Text Properties" dialog with **no coordinate targeting of the object at
  all** — the precision problem is eliminated, not tuned. Confirmed live for two objects placed at
  different positions on the same template (one centered, one deliberately off-center via a new
  `placeAtOffset` option), both opened Properties via this same menu path with zero failures, and
  then re-confirmed end-to-end through the REAL web-menu flow (not just the standalone
  investigation) — `zz_Exploratory_Navigation.spec.ts`'s full create → BarTender → add text object
  → save → close sequence completed with no retries needed. `addTextObjectBoundToSharename` also
  gained two new options for the multi-object case this was originally flagged for: `center`
  (defaults `true`; pass `false` for a 2nd+ object so it doesn't stack on the first, which always
  centers at the same spot) and `placeAtOffset` (a distinct Workspace-relative placement point per
  object). See `tests/support/bartender.ts`'s own updated doc comment for the full detail.
  `ROBAR_Tests/scripts/inspect-btw.ps1` (below) can independently verify the eventual saved
  result's actual sharename bindings, without needing BarTender or FlaUI at all.

  **Re-confirmed live 2026-09-30 against TST703 (see "Environment selection" below) with a REAL
  two-sharename template**, exactly the upcoming test scenario this was all for: both objects
  (`I_Num` centered, `I_Desc` off-center via the new `placeAtOffset`) added with zero retries
  across two separate runs. **Caught a second, related issue the same day**: the first attempt's
  `placeAtOffset` was computed as a fraction of Workspace's own full `Width`/`Height` (e.g. `Width *
  0.25`) — the user, watching live, caught that this landed the second object hanging half off the
  label entirely. Visually confirmed via a standalone `BarTend.exe` screenshot of the saved file.
  Root cause: the label occupies only a portion of the visibly-larger Workspace pane, so a fraction
  of Workspace's FULL size overshoots the label's actual bounds. Fix: offset from Workspace's own
  CENTER (already proven reliable) by a modest, fixed amount (confirmed working: center minus
  ~150/~80) rather than computing a position from Workspace's raw top-left corner as a large
  fraction of its full size. `tests/support/bartender.ts`'s own `AddTextObjectOptions.placeAtOffset`
  doc comment now carries this warning. Second run, re-verified visually: both objects landed
  cleanly within the label, no overlap, no hanging off the edge.

  **FIXED 2026-09-30** (same day, later session) — root cause turned out to be TWO separate
  issues, not one:
  1. The "0 bindings" symptom on a couple of standalone debug saves was actually a **false alarm
     caused by the save never really happening** — a blind `sendKeys(['RETURN'])` used to dismiss
     BarTender's own "Save Warning" dialog (a real, previously-undocumented confirmation: *"Warning!
     You are about to save this document using a newer version of BarTender. Once saved, you will
     be unable to open the document using an older version of BarTender."*, buttons `"Continue With
     Save"`/`"Cancel"`) isn't reliable — OS focus isn't guaranteed to be on that dialog when the
     keys are sent. Clicking the actual `"Continue With Save"` button by name (`automationId: "1"`)
     is the robust fix — same general lesson as playbook item 9 below, now doubly confirmed.
  2. **The real, deeper bug**: freshly-created files (saved directly from a current BarTender 2022
     R5 build, independent of ROBAR/Sentinel) use a genuinely different internal property label —
     `"DataSource"` (no space) — instead of mature/converted files' `"Data Source"` (with space),
     encoded via a different mechanism entirely: a general-purpose length-prefixed string primitive
     used for EVERY string property in this format, `FF FE FF <length-byte>` immediately followed
     by that many UTF-16LE characters. Worse, `"DataSource"` is itself a substring of the UNRELATED
     property name `"DataSourceGeneral"` (a property-browser breadcrumb path,
     `"Root.MasterSelectedObject.DataSourceGeneral.DataSource"`), so a naive text search for either
     anchor produces false positives. The robust fix: abandon text-anchoring for this layout
     entirely and scan for the `FF FE FF <len>` primitive directly, keep only strings matching a
     real object's own display name (`"Text N"`/`"Barcode N"` — NOT `"Box 1"`, an internal
     administrative pseudo-object confirmed to produce heavy noise), and take the next non-empty
     such string as the bound value, excluding candidates that are bare digits or leftover
     `"DataSource"`/`"Data Source"` label fragments. Confirmed via a live standalone debug session
     (`BarTend.exe` + a hand-built FlaUI script, no ROBAR/web flow needed) that also independently
     discovered a real, previously-undocumented BarTender format quirk: part of this file format's
     text is **not reliably decodable as flat little-endian UTF-16** even a few bytes away from
     text that decodes perfectly fine (confirmed: a `.NET Unicode.GetString()` of the region right
     before a known-good `"Text 1"` match came back byte-order-swapped, each character exactly
     256× its correct ASCII value) — a genuine reason to prefer the length-prefixed primitive over
     any text-based search for this file format generally.
  3. **Bonus discovery, not previously known**: this fix's broader scan also revealed that mature
     library files have MANY MORE real sharename bindings than the original "Data Source"-only scan
     ever found — e.g. `A1SuperTemplate_v0.btw` actually binds `L_PrintEntity`, `I_Ver`, `L_Exd`,
     `L_Mfd`, `m_versionnumber`, `md_brand`, `md_primedi`, `md_shelflife`, and `I_ShelfLife`, not
     just the `I_Desc`/`I_Num` pair previously known — the "Data Source" (with-space) label is
     evidently only spelled out in full for the first couple of objects in a file's own internal
     schema, with later objects using the more compact encoding this fix now also handles.
  Re-ran across the entire template library after the fix: `MTDX1_BT2022_v0.btw`,
  `MTLotTemp_v0.btw`, and `PromptTest.btw` (all previously "0 bindings") now show real, correctly-
  formed sharenames. One remaining minor/understood residual: a handful of fields across a few
  files (particularly `MTLanguagesTemp_v0.btw`/`PromptTest.btw`, which lean on the
  `prompt<Question={...}>` dynamic-token mechanism documented in Dictionary Management) report a
  literal `"Screen Data"` or `"Share Name"` instead of a real sharename — this looks like a genuine,
  different binding TYPE (manually-entered/prompted at print time, not a database field) rather
  than tool noise, not chased further.

**Test-suite mining pass (2026-09-30):** re-read `bartender.ts`, `templates.ts`, and all 11
`Template-Management/*.spec.ts` files' own inline comments end to end specifically looking for
hard-won automation findings not yet distilled here (the user's own prompt — a lot of time went into
determining BarTender/Sentinel/Template Editor locators when this suite was built). Result: this
section and the "Driving BarTender/Sentinel native dialogs" playbook below were already quite
thorough from that original build-out; the genuinely new material found was the Sentinel LAUNCH
sequence itself and the Approve/Signature-Required flow's crash-vs-hang distinction (added to the
playbook section), plus Edit Attributes' exact validation message/endpoint and a
close-after-clean-Save confirmation (added just above). One real near-miss worth flagging for next
time: an early draft of this pass duplicated the existing "Get Data is a nested BarTender dialog"
writeup into the playbook section before catching it — check this section's own existing content
FIRST before mining a spec file that already has a dedicated writeup here (`Get_Data.spec.ts`,
`Replace_Template.spec.ts`, `Save_As_New.spec.ts`, `Comments.spec.ts`, `Download.spec.ts`,
`Mass_Approve_Templates.spec.ts`, `Mass_Retire_Unretire_Templates.spec.ts` all already have one).
This suite is now considered fully mined — a future session doesn't need to re-read these spec
files' comments looking for more, only re-check here if the tests themselves change.

### Row Actions (per-record dropdown, stays nested in the row's own gridcell — confirmed via live
DOM snapshot, doesn't get repositioned elsewhere by the dropMenu jQuery plugin)
View/Edit Template, View/Edit Comments, View Label Characteristics, Replace Template, Edit
Attributes, Download, Save As New. Grid row checkboxes are named `jqg_grdJqGrid_<GUID>` — the GUID
is the row's own DB id, **not** derived from the template name — locate a row by its visible
Template Name text first, then find the checkbox within that row, rather than trying to construct
the checkbox selector directly.

### Bulk Actions ("Bulk Actions" dropdown, requires ≥1 row checked)
Approve Templates, Retire Templates (also handles Unretire, via a radio toggle on the same job
submission page), Submit to Workflow, Download. Each of the first three (job-submission-pattern)
actions POSTs to `CreateJob` then full-page-navigates to its own submission view
(`ApproveJobSubmission`/`RetireJobSubmission`/`SendToWorkflowJobSubmission`) — not a modal, unlike
Campaign Manager's bulk actions.

**Submit to Workflow — confirmed live end-to-end 2026-09-30** (previously had no test coverage at
all): **no e-signature fields** (unlike Approve/Retire) — real field ids: `#txtJobDescription`
(Job Description), `#txtComment` (Workflow Comments), `#drpPreset` (Preset dropdown), a `Link
External PDF` checkbox, `+ Add Attachments`, `#btnSubmit` ("Submit Job"). Also present but not yet
exercised: `#txtDepartment`, `#txtApprovalGroup`, `#txtHoursToRespond`, `#drpUser`,
`#drpVoteVeto` — likely only relevant for specific preset configurations. Choosing a Preset
dynamically loads and displays its configured step(s) inline on the page itself (confirmed:
selecting `"ROBAR Only"` — the same preset already confirmed to have real steps in Campaign
Manager's own Send to Workflow — showed `"1  ROBAR (ROBAR Default User)  Add Step"`), via a
`GetWorkflowSteps`-style call. **`#btnSubmit`'s enable binding needs an explicit blur after filling
`#txtComment`** — the same "`.fill()` alone doesn't recompute a Knockout `enable:` binding" pattern
confirmed repeatedly elsewhere in this app (e.g. `Mass_Approve_Templates.spec.ts`'s signature
fields) — press Tab or otherwise blur before checking/relying on the button's enabled state. On
success, POSTs to a `SubmitJob` endpoint returning `{JobID, Success: true, JobDetailUrl,
ErrorString}`, then navigates to a "Submit to Workflow Job Detail" page: header (Display ID, Date
Inserted, Status, Submitting User, Date Completed, Percent Complete) plus a "Template Job Detail"
sub-grid (Template Name/Label Type/Template Version/Status/Message columns) showing per-template
status (`"Inserted"` immediately after submit).

### Template Management security gating — live, as a real MB user (`Template-Management/Security_Gating.spec.ts`, 2026-10-04)
Fixtures `MBPWLoginGrp` + `MBPWLogin01` (see Security Management); admin (seed user) edits the group, the MB user logs in fresh each state (roles are read at LOGIN). Source: `TemplateManagementController` (`[Authorize(Roles="Web_Template_Management")]`, `IsInRole("TM_...")`) + `Management.cshtml` `authMsg`; WCF `TemplateManagementService` re-checks the SIGNING user for Approve/Retire/Send to Workflow (`RequestCheck(signature, …, _approveSecurityProcess)`) and `TM_Edit_Templates` for edits.
- **Tile:** `Web_Template_Management` (without it the Template Management tile is absent). **Visibility of templates:** label-type security — the user needs `LT_<Label Type>` (e.g. `LT_Carton Label`) or the grid returns 0 rows with "Some search results are not included due to label type security." (this notice also shows for users who lack SOME label types).
- **Actions are never hidden, they are flagged:** a missing process leaves the menu item in place with a tooltip `User not authorized for this task <PROCESS>.` (the item is non-functional). Mapping, each process alone enables exactly: `TM_Approve_Templates` → bulk Approve Templates; `TM_Retire_Templates` → bulk Retire Templates; `TM_WorkflowSendTo` → bulk Submit to Workflow; `TM_Download_Templates` → row Download + bulk Download; `TM_Edit_Templates` → row Replace Template + Save As New; `TM_Edit_Attributes` → row Edit Attributes; `TM_View_Comments` → row View/Edit Comments. **View/Edit Template and View Label Characteristics are open to every user** who can see the template (no process). `TM_Edit_Comments`, `TM_Delete_Comments`, `TM_Comment_Super` live inside the Comments dialog (not exercised).
- **Approval state also gates:** on an APPROVED template Replace Template and Edit Attributes carry the tooltip `Template is approved.` even with every TM_* process (approved templates are locked; Save As New New Version is the route). On UNAPPROVED templates, with all TM_* processes every row/bulk action is open.
- Row-action menu and bulk menu are plain jQuery menus (`ul:visible li`); the tooltip is the `title` attribute of the `li`/`a`; bulk `li` textContent includes the inline click-binding script, so read `innerText`.

### Approve Templates — negative paths, live (`Template-Management/Mass_Approve_Negative.spec.ts`, headless, 3/3, 2026-10-04)
Bulk Actions > Approve Templates opens an in-frame page "Approve Templates — Selected: N" (heading `Approve Templates`, fields `#txtJobDescription #sigUser #sigPassword #sigReason #sigComments`, `#btnSubmit`; reasons `Select Reason / General / New Template / Reviewed and Approved`). **Tick the row and WAIT for the `GetSelectedItemIds` response before opening Bulk Actions** — otherwise the menu click answers the error dialog "Please select one or more records." even though the box looks ticked. `#btnSubmit` stays disabled until description, user, password AND a reason are filled (blur Password). **Wrong password → "Invalid Username/Password." shown under the Signature header, in place** (no dialog, no job, still on the submission page). **An already-approved selection** → the page text reads "All templates are already approved." and the whole form (description, signature fields, Submit) is DISABLED — no job can be created (same pattern as Assign GTIN on approved MD records). Approving unapproved templates successfully is covered by `Mass_Approve_Templates.spec.ts` (consumes a throw-away template).

### Any flow that opens BarTender launches a real native desktop process
Create New Template, Replace Template, and Save As New all trigger the same sequence: submitting
the dialog fires `GetFileToken`, whose response navigates a hidden `#sentinelFrame` to a custom
`innoclient:` protocol URL, which makes Chrome show a native "Open SentinelLauncher?"
confirm-to-launch-external-app dialog — **not a JS dialog, no Playwright API for it at all**, has
to be driven via native UI Automation (see `ROBAR_Tests/scripts/flaui_bridge.js` /
`tests/support/bartender.ts`). Confirming it launches `Innovatum.Sentinel.Plugin.BarTenderEdit.exe`
(window title "Template Editor"), a wrapper hosting the real BarTender Designer plus its own
Save/Get Data/Approve/Comments/Save As/Close Tab action bar. **In normal manual browser use, this
prompt only appears once per browser profile** — Chrome auto-launches the app silently on
subsequent occurrences within the same profile. Confirmed-live reference flow for the full
create → edit (add + name-bind a Text object to a sharename) → save → close sequence:
`ROBAR_Tests/tests/Template-Management/Create_and_Approve_Template.spec.ts` (add txt object, save,
approve) and `.../View_Label_Characteristics.spec.ts` (add txt object, save, close without
approving).

### Row-action clicks must be scoped to the row, not the whole frame, for knockout-bound dialogs
`Create New Template`, `Replace Template`, `Save As New`, and `Edit Attributes` are all
**statically declared** knockout-bound dialogs in `Management.cshtml`
(`data-bind="dialog: ..., dialogVisible: ..."`) — their jQuery UI `.ui-dialog` wrapper (title bar
included) gets created once at page load / first knockout bind, then just shown/hidden via the
`dialogVisible` observable. That means an unscoped `frame.getByText('Edit Attributes', { exact:
true })` (or Replace Template / Save As New) matches **two** elements even before the dialog is
ever opened: the row's menu link AND the dialog's own (hidden) `.ui-dialog-title` span, causing a
Playwright strict-mode violation. Confirmed live 2026-09-11 building `Edit_Attributes.spec.ts`.
**Fix: scope the row-action click to the row locator itself** (e.g.
`row.getByText('Edit Attributes', { exact: true }).click()`), not `frame.getByText(...)`. This does
NOT apply to `View Label Characteristics` or `View/Edit Comments` — those build their dialog markup
fresh via AJAX on each click, so there's nothing pre-existing to collide with.

### Bulk-action job submission pages: Submit button needs an explicit blur after Password
Confirmed live 2026-09-11 building `Mass_Approve_Templates.spec.ts`: on the Approve/Retire/Submit-
to-Workflow job submission pages (all using the shared `SignatureComponentTemplate`
`#sigUser`/`#sigPassword`/`#sigReason`/`#sigComments`), the Submit button's `sigValid()`-driven
`enable` binding does not recompute purely from filling the fields — confirmed reproducible even
with Playwright's own `.fill()` (which does dispatch input/change events). The button stays
disabled until Password is explicitly blurred (e.g. `page.press('#sigPassword', 'Tab')`) — assert
the button is actually enabled before clicking it, don't assume a fixed settle delay is enough.
Likely applies to any other page using this same signature component, not just Approve.

### Driving a readonly jQuery UI datepicker field (Unretire's Effective End Date, Edit Attributes' Effective Begin/End)
These fields are `readonly` (the custom `datepicker:` knockout binding sets that attribute), so
`.fill()` doesn't work on them. Confirmed live 2026-09-11 building
`Mass_Retire_Unretire_Templates.spec.ts`'s Unretire path: click the field itself or its calendar
icon (e.g. `#effectiveEndDiv img`) to open a `.ui-datepicker` popup. Its "Today" button only
navigates the calendar to the current month/year -- it does **not** select a date. The actual
selection is clicking the day-of-month link itself (`.ui-datepicker-calendar` `getByRole('link',
{ name: String(dayNumber), exact: true })`), which both fills the input with the right value and
closes the popup. This same technique should work for Edit_Attributes.spec.ts's Effective
Begin/End fields too, which that test currently skips for exactly this readonly-input reason.

### Search/filter widget instance is named "dvFilters" here, not "Filters"
Same shared `CriteriaFilter` jQuery widget as Campaign Manager, but instantiated as
`Innovatum.CriteriaFilters.Options("dvFilters", "Labels", columnModel)` — form field names are
`dvFilters[0].Column` / `dvFilters[0].Operator` / `dvFilters[0].Value`, **not** `Filters[0].*` like
Campaign Manager's instance. Don't assume field-naming is consistent cross-module for a shared
widget — confirm via a live DOM dump (`frame.locator('#dvFilters').innerHTML()`) rather than
copying another module's selector. Template Name's filter column value is `LabelName`. Same
account-level "remember last search" persistence as Campaign Manager (restored automatically after
the module loads and a Retrieve Data-equivalent trigger fires) — expect a pre-existing filter row
already present, don't assume the filter area starts empty.

### TM_Search&Filter-1.5's "Filter will take precedence" dialog no longer exists (confirmed live, 2026-09-14)
The formal script describes a confirmation pop-up ("Filter will take precedence over the search
criteria") when a Column/Operator/Value criteria filter AND a non-default `#drpApprove` value
("Approved Only"/"Unapproved Only") are both set before clicking Retrieve Data. **Confirmed live
this dialog no longer appears.** Actual current behavior: changing `#drpApprove` away from its
default ("Approved and Unapproved") **silently removes every existing criteria filter row from the
DOM immediately**, with no confirmation and no explicit user action beyond the dropdown change
itself — Retrieve Data then runs against the dropdown value alone. A real product-behavior
deviation from an evidently-outdated script, not a guess or a flake — `Search_and_Filter.spec.ts`
asserts this actual behavior (`.criteriaFilter-Filter` count drops to 0 right after the `select`).
Worth flagging back to whoever owns the formal test scripts if that document ever gets revised.

**UPDATE 2026-10-04 (`Search_and_Filter.spec.ts`, 3/3, ~2.3 min, as Claude01, TST703 7.0.3.20198) — the note above is OUT OF DATE for this build:** choosing `Unapproved Only` / `Approved Only` with a criteria row present NO LONGER removes the row — the row stays, there is no dialog, and Retrieve applies BOTH (AND): e.g. Unapproved Only + Template Name contains "MB" returned only MB* templates that are unapproved (empty Approved By, Approval Date shown as `1/1/1900`). Everything else in the note holds. Further facts from the same spec: Page = Actions menu (only `Create New Template`), `#drpApprove` (Approved Only / Unapproved Only / Approved and Unapproved), `#chkLatestVersion`, `#chkEffectiveOnly`, `#chkFilterByDataSource`, `#txtResultLimit` (default 500; "of 500" in the pager when more match), `#btnRetrieveData`, `#btnReset`; Bulk Actions (`#drpActions`: Approve Templates, Retire Templates, Submit to Workflow, Download) appear only after a row is ticked; row Actions: View/Edit Template, View/Edit Comments, View Label Characteristics, Replace Template, Edit Attributes, Download, Save As New; grid columns Id, Actions, Template Name, Label Type, Version, Description, Effective Begin, Effective End, Approved By, Approval Date Time, Document Owner (default "Robar"). Filter columns: Approval Date Time, Approved By, Description, Document Owner, Effective Begin, Effective End, Label Type, Template Name (`LabelName`), Version. **Operators depend on the column type** — Template Name/Approved By offer 10 (Contains, Does Not Match, Does Not Contain, In, Not In, Greater Than, Less Than, Exactly Matches, Is Blank, Is Not Blank); date and Version columns offer 8 (no Is Blank / Is Not Blank). `In` / `Not In` take a **comma**-separated list (a semicolon returns 0). Two rows AND together. Page size select `.ui-pg-selbox` = 10/20/30 (default 10). **Filter by Data Source** (`#chkFilterByDataSource`, then click `#dataSourceSelector` to open the checkbox list `#dataSourceDropdown`; first entry Select All): lists EVERY share name used by any template on the server (265 on TST703: `I_*`, `L_*`, `m_*`, `md_*`, `<English>` language tags, `L_Mfd/<format>` variants ...); ticking e.g. `md_brand` keeps only templates bound to it (the `MBGDMD*` templates from A1SuperTemplate match, the `MBSide*` templates that only bind `I_Num` do not) and it ANDs with criteria rows — a quick way to answer "which templates use this master-data share name". **Reset does NOT clear Filter by Data Source** (the checkbox and its selection come back after Reset and after a reload until a Retrieve with it unchecked persists the change; tracker observation).

Other confirmed mechanics for this same widget while building that test: a fresh filter row's
`Column` defaults to `ApprovalDateTime` (a date-typed column, whose `Value` becomes a readonly
jQuery UI datepicker — same family of gotcha as Edit Attributes/Unretire elsewhere), so pick a
text-typed column like `ApprovedBy` for a second row that just needs a plain text `Value`. The
AND/OR join selector for a row is `select[name="dvFilters[N].AndOr"]` (options `And`/`Or`) and only
renders on a row once a following row exists. `#drpApprove`'s three `<option>`s all have an empty
`value=""` — select by `{ label: ... }`/visible text, not by value. The grid's page-size selector
has no id, only the class `.ui-pg-selbox` (standard jqGrid pager markup), with real `value`s `10`/
`20`/`30`. Reset (`#btnReset`) fully restores both the criteria filter (back to zero rows) and
`#drpApprove` (back to "Approved and Unapproved") in one click.

**"Add Filter" click target — corrected 2026-09-29 (Master Data Management, `check_item_state4.spec.ts`):**
the source (`CriteriaFilter.js` ~L274-288) renders the AddButton as a `<div class="criteriaFilter-
AddButton">` containing TWO separate, non-overlapping `<span>`s that both show "Add Filter" text —
an icon span (`.html(settings.addButtonText)` on an icon `<span>`) and a second plain text span —
but the click handler (`addButtonText.on("click.criteriaFilter", addClick)`) is bound ONLY to the
second span. **This DOES matter for Playwright's own `.click()`, contrary to what was assumed
here previously**: `frame.getByText('Add Filter', { exact: true }).first().click()` resolves to
the icon span (whichever sorts first in DOM order) and produces a real, "successful" click with no
error — it just clicks an element with no handler, since the two spans sit side by side rather than
stacked, so there's nothing for the click to land "on top of" per the old assumption. Confirmed
live: the `.criteriaFilter-FilterGroup` div stayed empty (no new filter row) after `.first().click()`
with no error, only `.last().click()` (plus `{ force: true }` in one MDM run) actually added a row.
Use `.last()`, not `.first()`, for this widget's Add Filter link in any module.

A fresh filter row's **Operator defaults to "Exactly Matches", not "Contains"** — confirmed live
this produces silent false-negative empty results for a substring search unless changed explicitly
(the row's second `<select>`, option label `Contains`). Also, a fresh row's **Column defaults to
the first `<option>` in the column list**, whose Value editor type follows the column's own data
type (a `<select>` for boolean-like columns, a readonly datepicker display for date columns, a
plain `<input>` for text/numeric) — switch Column to the field you actually want FIRST, then locate
the Value editor, since its tag/role changes depending on which Column is currently selected.

### Replace Template's confirm-to-replace dialog has no stable container id, and is rebuilt fresh every Submit click
Confirmed live and via source (2026-09-14) building `Replace_Template.spec.ts` (test now passing —
see that file for the working version of everything below):
`#replaceTemplateDialog` (a statically-declared knockout dialog, same row-scoping gotcha as Edit
Attributes/Create/Save As New) has a real `#replaceFileInput` file field that fires
`CheckForSameFileType` on `change`, toggling `#replaceFileValidationContainer`
("New file must be of the same file type as the existing file.") and `#btnReplaceTemplateSubmit`'s
disabled state. Clicking that Submit button builds an **ad-hoc jQuery UI dialog with no id of its
own** (`Management.cshtml`'s `replaceTemplateDialogOptions` — a bare `$('<div/>').dialog(...)`,
rebuilt from scratch on every Submit click, never reused) — only its
`#btnConfirmReplaceTemplateContinue`/`#btnConfirmReplaceTemplateCancel` button ids are fixed.

**Two confirmed strict-mode collision traps here, both found via real Playwright failures, not
anticipated up front:**
1. A bare `.message-warning` locator for this dialog's text is **not unique** — it also matches
   this frame's pre-existing static "Some search results/label types are not included due to label
   type security" banners (Create New Template's, Save As New's, and the grid's own), which share
   the `message message-warning` classes plus an extra `message-compact` this dynamically-built
   confirmation div doesn't have. Use `.message-warning:not(.message-compact)` instead, or scope by
   the dynamic message text itself.
2. Clicking that dialog's **Cancel does nothing server-side and closes BOTH it and the underlying
   Replace Template dialog** (`clearReplaceTemplateDialogParameters()` runs in its `beforeClose`) —
   matches `TM_Replace-1.12`'s own script (Cancel leaves no "Replaced Template File" record) — but
   jQuery UI's `.dialog("close")` only **hides** the div, it is never removed from the DOM. If a
   test cancels once and then submits again (e.g. to test both the cancel path and the real replace
   in one run, as `Replace_Template.spec.ts` does), there are now TWO
   `#btnConfirmReplaceTemplateContinue` elements in the DOM — one stale/hidden, one live — and an
   unscoped id locator on the second attempt is a strict-mode violation. Fix: scope with
   `:visible` (e.g. `#btnConfirmReplaceTemplateContinue:visible`).

**Continue** POSTs `UploadTemplateFile` → `ReplaceTemplate` → `GetFileToken` in sequence — the same
`GetFileToken`/`launchEditor` call Create New Template uses, so it launches BarTender via the exact
same Sentinel-prompt sequence and `tests/support/bartender.ts` is reusable as-is afterward.
`tests/support/templates.ts`'s `resolveBtwFile()` (backed by `ROBAR_BTW_FILE`/`ROBAR_BTW_LIBRARY_DIR`
in `seed.ts`) is the intended way to pick the replacement `.btw` file for this flow — it was added
specifically for this dialog's "browse for an existing template" case, confirmed working here.

**The pinned `ROBAR_BTW_FILE` (`A1SuperTemplate_v0.btw`) is a real, fully-built template, not a
blank canvas** — confirmed the hard way: after replacing with it and reopening BarTender, adding
*another* text object and trying to name its data source `"I_Num"` failed with BarTender's own
`"The data source name 'I_Num' already exists"` error, because that exact sharename is already
bound to an existing object in this file. Any test that opens BarTender after a Replace/Save As New
using this file should NOT assume a blank template the way Create New Template's blank
`NewTemplate.btw` starter allows — either just Save+Close the replaced content as-is, or check what
data sources already exist first. This also means `I_Num` is a reliable, already-present sharename
to assert on via View Label Characteristics after replacing with this specific file, with no need
to add it.

### Save As New's two validation failures use genuinely different mechanisms
Confirmed live and via source (2026-09-14) building `Save_As_New.spec.ts`:
`#saveAsNewDialog` (same statically-declared knockout dialog / row-scoping gotcha as Edit
Attributes/Create/Replace Template) defaults to the **"New Template/Label Type"** radio
(`#rbNewTemplate`) with **"New Version"** (`#rbNewVersion`) disabled whenever the source template is
unapproved or not the latest version (`isNewVersionDisabled` computed:
`!data.isApproved || !data.isLatest`, `TemplateManagementModel.js`) — matches `TM_SaveAsNew-1.9`'s
own script. The "New Template/Label Type" form (`#txtSaveAsTemplateName`/`#txtSaveAsDescription`/
`#ddlSaveAsLabelType`) has **two validation paths that behave differently, not one**:
- **All fields blank** → client-side only, blocked in `validateSaveAsNew()` before any AJAX call,
  shown as a single consolidated message in `#saveAsNewValidationErrorDiv`: "Template Name,
  Description and Label Type are required fields and cannot be left blank". The dialog stays open
  (`submitSaveAsNew()` never reaches `viewModel.showSaveAsNewDialog(false)`).
- **Duplicate template name** → also client-side only (a live/async knockout uniqueness validator
  on `newTemplateNameForSaveAs`, not a server round trip) — confirmed live by watching network
  traffic: no `SaveAsNew` POST fires at all. Shown as an **inline per-field message** ("Template Name
  already exists.") in a `<span class="validationMessage">` sibling right after
  `#txtSaveAsTemplateName`, not in `#saveAsNewValidationErrorDiv`. The dialog also stays open here.
  Reading `Management.cshtml`'s `submitSaveAsNew()` source alone suggests the server's `SaveAsNew`
  response `ErrorMessage` also feeds `#saveAsNewValidationErrorDiv` on failure — true for some other
  server-rejected case, but **not what actually happens for a duplicate name** in practice; don't
  trust that code path without live-checking which validator actually fires for a given case.

A valid, unique submission POSTs `SaveAsNew` → `GetFileToken` — the same `GetFileToken`/`launchEditor`
call Create New Template and Replace Template use, so `tests/support/bartender.ts` is reusable
as-is afterward. The new template is copied from the source's actual content (confirmed live: a
source template with a real "I_Num"-bound text object produces a copy whose View Label
Characteristics also shows "I_Num") — so the same "already exists" data-source-name collision
Replace Template hit with `A1SuperTemplate_v0.btw` applies here too if the source already has
content and a test tries to add the same sharename again after Save As New.

### View/Edit Template has no dialog at all, and View/Edit Comments opens a real separate browser window
Confirmed live and via source (2026-09-14): `raViewEditTemplate`'s row action is wired directly to
`openFile(fileId)` (`Management.cshtml`) — no dialog, no file picker, nothing statically-declared to
collide with, just straight into the same `GetFileToken`/`launchEditor`/BarTender sequence every
other BarTender-launching action shares. Confirmed live via network trace: clicking it fires
`GetFileToken` immediately, with no `CheckForOpenFile`-style gate call first (unlike Replace
Template's `loadReplaceTemplateDialog`) — the native "locked for editing by..." message
`TM_ViewEditTemplates-1.7` describes must be a Sentinel/BarTender-level check, not this web layer.

**Edit Attributes' own exact validation/endpoint, confirmed 2026-09-30** (the row-scoping/readonly-
datepicker gotchas above were already documented; these specifics weren't yet): submitting
`#editTemplateAttributesDialog` with a blank Description shows `"Description is required."` as a
plain text node injected next to the field — not a separate stable-selector element — and blocks
client-side (dialog stays open, no network call). A valid submission POSTs
`UpdateTemplateAttributes`; the dialog's own Submit button (`#btnSaveTemplateAttributes`) is a
`.ui-dialog-buttonpane` sibling of the content div, same pattern as every other Template Management
dialog — locate it unscoped via `frame`, not `dialog.locator(...)`.

**Close Tab after a clean Save does not show the "Save any changes...?" prompt — now confirmed for
BOTH an untouched AND a modified-then-saved template**, closing a real gap `bartender.ts`'s own
`closeTemplateEditor` docstring had flagged as unconfirmed for the modified case (it only had
live confirmation for a freshly-created, never-touched template). `View_Edit_Template.spec.ts`
modifies an existing template (adds a text object), Saves, then Close Tabs cleanly with no prompt
— the same assumption `closeTemplateEditor` already relies on elsewhere now holds for this case too.

`raViewEditComments`, by contrast, is the one Template Management action that isn't an in-page
dialog or a BarTender launch at all — its handler is a plain `window.open(...)` to a genuinely
separate page (`TemplateManagement/Comments?templateName=...&versionNumber=...`,
`Views/TemplateManagement/Comments.cshtml`). In Playwright, capture it via
`context.waitForEvent('page')` around the triggering click, not a frame/dialog locator — see
`Comments.spec.ts`. That page has no BarTender/FlaUI involvement whatsoever, and confirmed live
that MCP's own popup sometimes needs the click re-fired (a `window.open` from an iframe occasionally
didn't produce a new tab on the first click during live exploration; calling `openCommentsDialog(...)`
directly via `page.evaluate` reproduced it reliably) — not yet seen in an actual Playwright test run,
noted here in case it recurs.

**Both of Comments' own comment-text `<textarea>`s (`#txtNewComment` for a new comment, and the
per-comment edit box) are bound with `valueUpdate: 'afterkeydown'`** — confirmed live the same way
several other knockout-bound fields in this app have turned out to need real keystrokes: Playwright's
`.fill()` sets the value and fires input/change events, but the Submit button stayed disabled
because the `afterkeydown` binding specifically listens for keydown events, which `.fill()` never
dispatches. Fix: `locator.pressSequentially(text)` (or `browser_type`'s `slowly: true` during MCP
exploration) instead of `.fill()` for these two fields specifically. Comments has no confirmation
dialog for Delete (`deleteComment()`'s own `//TODO: are you sure?` comment — it really does delete
immediately, single click, confirmed live) and Cancel on an in-progress edit reverts the textarea's
displayed content with no server call at all.

### Template Editor's own action bar — Comments, PDF, Save As (the wrapper's 3 remaining buttons) — confirmed live 2026-09-30
Completes personal hands-on coverage of all 8 `tlpActions` buttons (`btnSave`, `btnSaveAs`,
`btnCloseTab`, `btnApprove`, `btnGetData`, `btnComments`, `btnRestore`, `btnPDF` — the full set,
confirmed via live dump-tree) plus all 4 Bulk Actions (Approve, Retire/Unretire, Submit to Workflow,
Download). Save/Close Tab/Approve/Get Data/Restore were already covered by existing specs; these
three were the gap.

**Comments (`btnComments`) is architecturally distinct from the row-level "View/Edit Comments"
action above, despite rendering the same underlying page.** The Template Editor's own button opens a
REAL native dialog (`Window Name="Template Comments"`, `AutomationId="CommentsDialog"`, with its own
`TitleBar`/`Close` button — a genuine top-level-ish window, unlike Text Properties' nested dialogs)
that embeds a live browser control (`ClassName="Internet Explorer_Server"`) pointing at the exact
same URL the row action's `window.open(...)` uses
(`TemplateManagement/Comments?encryptedUserId=...&templateName=...&versionNumber=0`) — same content,
two different presentation mechanisms (one a native-hosted embedded browser, one a plain browser
tab). Its own controls: `[Edit] AutomationId="txtNewComment"`, `[Button] Name="Submit"`, and the
dialog's `TitleBar`'s own `[Button] Name="Close" AutomationId="Close"` — **must click this Close
button to dismiss it; it's modal and blocks subsequent Template Editor action-bar clicks** (confirmed
the hard way — clicking PDF and Save As immediately afterward without closing Comments first just
re-returned the Comments dialog's own unchanged tree, not real PDF/Save As behavior).

**PDF (`btnPDF`) is the one Template Editor button whose result is a genuine separate TOP-LEVEL
process, not a nested child window — the first confirmed exception to this playbook's item 2 below.**
A `dumpTree` scoped to `title: 'Template Editor'` shows NO change at all after clicking it — looks
like a no-op. It isn't: a full, untitled-scoped Win32 `EnumWindows` (plain P/Invoke, not FlaUI) right
after the click reveals a brand new top-level window, `"<TemplateName>_v<version>.pdf - Adobe Acrobat
Reader (64-bit)"`, in a completely different process. **Lesson for any future "the click did nothing"
dead end: before concluding a button is a no-op, always widen the search to a full untitled-scoped
top-level window enumeration — not just a wider/deeper dumpTree of the known window — since some
actions genuinely hand off to an unrelated external process.** Confirmed working correctly: the PDF
itself opened fine and displayed the real label content.

**Real bug found alongside this: PDF export crashes a background "Font Capture" helper process.**
Immediately after the PDF button's click (present in a window enumeration taken right after), a
`"Font Capture: Windows - Application Error"` dialog appeared — `"The exception unknown software
exception (0xc06d007e) occurred in the application at location 0x00007FFE12BF483A."`, with a single
OK button. `0xc06d007e` is the generic "unknown C++ exception" code the CRT uses for an unhandled
C++ exception that escapes to the top — i.e. "Font Capture" (presumably BarTender/Sentinel's
font-embedding-for-PDF helper process) threw and crashed outright. **Non-blocking** — the PDF still
generated correctly and opened fine in Acrobat Reader despite the helper's crash — but a real,
reproducible defect worth flagging upstream (BarTender/Sentinel's PDF export path), not a test
artifact. Oddity worth noting: the crash dialog's owning window, per `GetWindowThreadProcessId`,
belongs to `csrss.exe`, not a process named "Font Capture" — this matches the legacy NT hard-error
popup mechanism (pre-WER `NtRaiseHardError`), where csrss itself displays the dialog on behalf of a
process that has typically already terminated by the time you inspect it; not itself a new bug, just
explains why there's no live "Font Capture.exe" process to find afterward.

**Save As (`btnSaveAs`) opens a native WinForms dialog, `"Save Template As New"`
(`AutomationId="SaveAsNewDialog"`), that is functionally a native-hosted mirror of the web row
action's `#saveAsNewDialog` documented above** — same two radio choices (`New Version`
`rbNewVersion` / `New Template / Label Type` `rbNewTemplate`), same fields
(`txtTemplateName`/`txtDescription`/`ddlLabelTypes`), same Cancel/Submit (`btnCancel`/`btnSubmit`),
and confirmed live to produce the **exact same two validation messages** as the web dialog:
"Template Name, Description and Label Type are required fields and cannot be left blank." (all
blank) and "Template name already exists." (duplicate name) — shown in a `pnlError`/`lblError` pane
that also relabels the surrounding `pnlButtons` pane's own accessible Name to the error text (a UI
Automation quirk, not two separate messages).

**Key finding: selecting "New Version" does NOT let you keep the current template's own name** — it
still requires a name that doesn't already exist, rejecting the current template's own name with
the same "Template name already exists." message a duplicate gets under "New Template / Label Type".
This means, despite the label, this dialog's "New Version" option is not an in-place versioning
shortcut the way plain `Save` (`btnSave`) is — it still always creates a distinct new template
record. (Plain `Save` remains the button that versions the CURRENT template in place — already
confirmed working via existing specs; this dialog is Save As's own separate code path.) Confirmed a
full successful round trip with a unique name: Submit closed the dialog, and the SAME BarTender
window/process re-titled to the new `<name>_v0.btw` and loaded the newly-saved-as template content
— no separate window/process spawned, matching the row-level Save As New's own
`GetFileToken`/`launchEditor` reuse pattern.

**Also confirmed: the `ddlLabelTypes` ComboBox does not respond to `setText` via `ValuePattern`
reliably** — a first attempt using `ValuePattern` on `txtTemplateName` produced a garbled readback
(`"iMBSaveAsTest50016"` instead of `"MBSaveAsTest50016"` — an extra leading character), yet the
Submit still went through and created a template with the garbled name, confirming the dialog's own
server-side validation doesn't re-check the exact string UI Automation itself believes it wrote. Per
item 8 in the playbook below, prefer `method: 'win32'` (raw `WM_SETTEXT`/`WM_GETTEXT`) over the
default `ValuePattern` for `setText` against this class of legacy WinForms control — not yet retried
here, but consistent with the existing documented fix for Signature Required's own fields.

### Download (row + bulk) is pure browser download handling, no BarTender involved
Confirmed live and via source (2026-09-14) building `Download.spec.ts`: row-level Download
(`raDownloadTemplate` → `downloadTemplate(fileId)`) POSTs `DownloadTemplateFile` and downloads the
raw file directly, named `"<templateName>_v<version>.btw"`; Bulk Actions' Download
(`#actBulkDownload` → `bulkDownloadTemplates()`) POSTs `BulkDownloadTemplates` and **always zips,
even for a single selected template**, named `"Templates_<yyyyMMddHHmmss>.zip"`. Both go through
`triggerFileDownload()`, which navigates a hidden nested `<iframe>` to a
`GetDownloadFile?downloadKey=...` URL rather than a direct link click or `<a download>` — but
Playwright's page-level `download` event still fires the same way regardless (confirmed live: fires
even though the request originates from a frame nested inside the already-nested module iframe).
Bulk Download with nothing selected shows the same generic ad-hoc `showError()` dialog other bulk
actions use elsewhere in this app (title "Error", single "OK" button, message here is "Please
select one or more records.") — rendered inside the module iframe, not the top page.

**Reuse the `#actBulkDownload` id (confirmed via source: `.Action("actBulkDownload", ...)`), not a
text match, for the Bulk Actions "Download" click.** The row-level action list ALSO has a "Download"
entry sharing the exact same localization key/text — since the row-actions dropdown's DOM node is
left behind (merely hidden, not removed) after first being opened, same as the confirmed pattern for
Replace Template's confirmation dialog, an unscoped `frame.getByText('Download')` used after the row
action menu has already been opened once earlier in the same test risks the identical strict-mode
collision found there. Not yet hit in an actual test run — pre-empted here since the row-level
Download step necessarily runs before the bulk one in the same test and the failure mode is already
well-established in this codebase.

### Get Data is a nested BarTender dialog, but its own dead ends are worth knowing about
Confirmed live (2026-09-14) building `Get_Data.spec.ts`: "Get Data" (`btnGetData`) and "Restore"
(`btnRestore`) both live in the same Template Editor `tlpActions` pane as Save/Comments/Close Tab
(`title: 'Template Editor'` scoping, same as those). The Get Data dialog itself is a genuine child
`[Window]` (AutomationId `GetDataDialog`) directly under "Template Editor" -- reachable from
`bartenderPid` via `elementAutomationId: 'GetDataDialog'` (NOT `elementName: 'Get Data'`). Its
Submit button is `btnSubmit`, nested one level deeper inside a `pnlButtons` pane; like
Create_and_Approve_Template.spec.ts's own Approve/Submit buttons, it needs `method: 'mouse'` --
default UI Automation InvokePattern hangs the same way, since its handler does real synchronous
work (replacing the template's Item-level sharenames with the selected item's data).

**Two dead ends worth remembering before repeating them:**
- `title: 'Get Data'` matches nothing at all, despite the dialog visually having its own full
  title bar (icon + text + close button) that looks exactly like genuine top-level window chrome.
  Visual window chrome is not proof of being a real top-level window in this app -- confirmed via a
  full `dump-tree --title "Template Editor"` that it's a nested child window instead.
- A bare `elementName: 'Get Data'` search does NOT fail cleanly -- it **times out**
  (`"Timed out resolving --element-name/--element-automation-id scope"`) despite "Get Data" being
  a real Name in the tree one level up (on the `[Window]` element itself, not a descendant of it).
  Root cause not fully understood; scoping by AutomationId instead sidestepped it rather than
  explaining it. If a future `elementName` search times out instead of returning "not found," don't
  assume the name is wrong -- get a full dump-tree of the known-working parent window instead of
  iterating on name guesses.

**How this was actually diagnosed, for the pattern rather than just the answer:** neither a
processId-only `dump-tree` nor a `title`-scoped one against "Get Data" produced anything (both came
back empty/erroring) while the dialog was genuinely open on screen. What worked was dumping the
*known-good* parent window (`--title "Template Editor" --max-depth 20`, redirected straight to a
file) and reading the whole tree to find the real nesting -- rather than continuing to guess at the
missing piece's own title/name directly. Worth reaching for first next time a native dialog's
controls aren't resolving, instead of iterating on guesses about the dialog itself.

**Two more findings from the same debugging session, both worth carrying forward:**
- `dumpTree`/`screenshot` only accept `processId`/`title` -- unlike `click`/`getProperty`/`setText`,
  they have no `elementName`/`elementAutomationId`-style nested-scoping parameter at all. There is
  no way to directly dump-tree or screenshot a nested dialog like `GetDataDialog` by itself; always
  target the nearest resolvable top-level-ish window (here, `title: 'Template Editor'`) and read the
  nested subtree out of that dump instead.
- **A `processId`-only `dumpTree`/`screenshot` (no `title`) consistently returns empty/nothing for
  BarTenderEdit specifically** -- confirmed across multiple separate captures throughout this
  debugging session, not a one-off. BarTenderEdit is a multi-window process (the "Template Editor"
  wrapper, the "... - BarTender Designer" MDI frame, and others all share one pid), and whatever
  "default main window" a bare processId resolves to for this app doesn't produce usable output.
  Always pass an explicit `title` (`'Template Editor'` is the one every other click in this suite
  already scopes by and is reliably resolvable) rather than relying on the processId-only default.
- **`launchTemplateEditor()`'s own readiness gate (BarTender Designer's "Text" MenuItem
  `IsEnabled`) does not guarantee the separate wrapper window's own action bar (Save/Get Data/etc.)
  is ready yet.** Every existing test that touches the action bar does several real canvas
  interactions first (drag, right-click, type into a wizard), incidentally giving the wrapper time
  to finish initializing -- `Get_Data.spec.ts` was the first test to click an action-bar button
  immediately after `launchTemplateEditor()` returns with nothing in between, and hit exactly this
  gap: `NoClickablePointException` on that first click, then every subsequent click (including the
  previously-always-reliable "Save") timing out unable to find anything at all, consistent with the
  whole window being in a not-yet-fully-interactive state rather than any individual button being
  wrongly targeted. Fix: explicitly gate on the action bar's own readiness first (e.g.
  `getProperty` the "Get Data" button's `IsEnabled` with a real `retrySeconds` budget), the same
  technique `launchTemplateEditor` already uses for BarTender's own toolbar -- don't assume that
  existing gate covers a part of the UI it was never actually confirmed against.

**More findings from the same "Get Data" debugging marathon (2026-09-14) -- `Get_Data.spec.ts` is
now passing; see that file for the final working sequence. Kept here because the dead ends are
exactly the kind of thing worth not re-discovering:**
- **The "Get Data" button's click handler blocks synchronously, the same as Approve's.** The
  default click method throws `NoClickablePointException` on it, consistently and immediately.
  `method: 'win32'` (raw `SendMessage(BM_CLICK)`, chosen because it needs no screen-coordinate
  resolution at all) got the click to actually fire — the dialog visibly started opening — but then
  hung and got killed by Node's own execFile timeout (`SIGTERM`), because `BM_CLICK` is exactly as
  synchronous as the default `InvokePattern` method and the handler doesn't return until the modal
  dialog closes. `method: 'mouse'` (real `SendInput`, fire-and-forget) is what actually works
  cleanly for this button — same fix Approve/Submit already needed elsewhere in this suite, and a
  good reminder that a button opening a dialog synchronously is reason enough to reach for `mouse`
  first, rather than rediscovering it fresh each time a new button turns out to need it.
- **`FlaUIAutomation.exe`'s own retry loop caps every single sub-attempt at a hard 15 seconds via
  `PerAttemptTimeout`, regardless of the `--retry-seconds` budget passed in** — and
  `TryWithTimeout`'s `Task.Wait(timeout)` does not cancel the underlying task when it times out, so
  a genuinely-hung call keeps its thread running in the background while the retry loop just starts
  a new one. Net effect: if a specific FlaUI operation (e.g. `FindFirstDescendant` against a
  particular element) truly hangs rather than merely running slowly, **raising `retrySeconds` from
  20 to 90 produces the exact same "Timed out searching for control" error, every time** — no
  amount of extra budget helps, because no single attempt ever gets more than 15s regardless.
  Don't burn a debugging cycle bumping the number again if a second attempt at a higher
  `retrySeconds` reproduces byte-for-byte the same error text as the first — that's the signal it's
  a real hang, not a slow-but-finishing search, and the fix has to be architectural (narrow/avoid
  the search) rather than a bigger timeout.
- **A bare `--name` search (no `--automation-id`) against a WinForms `DataGridView`'s individual
  virtualized/MSAA-bridged cell elements (here, `[Edit]`-typed cells like `"Item Number Row 0, Not
  sorted."`) appears to hang FlaUI's `FindFirstDescendant` outright**, not just run slowly — proven
  by narrowing the search root from the whole `GetDataDialog` window down to just `dgvItemGrid`
  (the grid's own small subtree: one header row + one data row) and getting the identical failure
  either way. Their own `AutomationId`s do exist in a dump-tree (e.g. `"429487824"`) but are large,
  per-instance numbers — not safe to hardcode across runs. **Turned out to be moot**: the row
  doesn't need to be clicked at all -- it's already selected by default, and every earlier Submit
  failure that looked like evidence for "needs a row click first" was actually caused by unrelated,
  since-fixed window-scoping bugs (`elementName: 'Get Data'` and `title: 'Get Data'`, both wrong).
  If a real row click is ever needed for a similar grid elsewhere, `clickAt` against the grid
  container's own resolvable AutomationId, computed from its `BoundingRectangle` plus an assumed
  standard WinForms row/header height, is the untried fallback approach — avoid a bare `--name`
  search against individual grid cells in this app.
- **The final working sequence, for reference**: gate on `Restore`'s own `IsEnabled` (starts
  `False`) as a cheap real-effect check; click "Get Data" (`title: 'Template Editor'`, plain
  `--name`, `method: 'mouse'`); click "Submit" scoped to `elementAutomationId: 'pnlButtons'` (the
  small button-pane containing just Cancel/Submit — NOT the whole `GetDataDialog`, whose subtree
  also contains the slow Master Data grid) with `automationId: 'btnSubmit'` and `method: 'mouse'`;
  confirm `Restore` flipped to `IsEnabled: True` (proof Submit really changed something, not just
  that the click didn't throw); click "Restore" (`title: 'Template Editor'`, `automationId:
  'btnRestore'`, `method: 'mouse'`); then the normal `saveTemplate`/`closeTemplateEditor`.

---

## Destination Labeling (DL)

Source: 14 legacy Word "Integration Test Case" documents (`DL_AutoPrint`, `DL_BarcodeParseStoredProc`,
`DL_CMActions`, `DL_CreateOrder`, `DL_DataChecking`, `DL_GlobalSettings`, `DL_Licensing`,
`DL_LocalizationResources`, `DL_PrintAll`, `DL_PrintHistory`, `DL_PrintingHierarchy`,
`DL_RegularPrinting`, `DL_RequireVerification`, `DL_Security`), authored 2017–2019 and last revised
as late as 2021, extracted from a `DELETEME` folder and reviewed 2026-09-15 before deletion. **The
`DL_` prefix means "Destination Labeling," not the folder's own name** — every one of these 14
documents, despite generic-sounding filenames, turned out to test facets of the same module: printing
destination-specific labels/documents (e.g. country- or customer-specific packaging inserts) via a
dedicated web module, keyed off a Destination Code and driven by GS1 barcode scans. This module had
no prior section in this reference — it is not the same thing as the "Browser Printing" module's
Print by Order/Lot pages, and no evidence in any of the 14 docs suggests they share code.

**Caveat that applies to nearly everything below:** all 14 source documents are unexecuted blank test
script templates — their "Actual Result" columns mechanically mirror "Expected Result" text (often
missing a negation, e.g. "is not checked" → "checked"), and Pass/Fail, Deviations, and Signature
fields are blank throughout. None of them document a confirmed historical defect. Treat every rule
below as **intended/spec behavior as of ~2018**, not as verified current behavior — and note that this
module also predates the 7.x MVC refactor described in the project CLAUDE.md, so UI chrome, menu
hosting, and exact navigation steps are the least trustworthy part of these documents even where the
underlying business rules are likely still accurate. Login/navigation is uniformly described as
"the Innovatum Web Menu" without distinguishing the legacy Web Forms `Web/WebMenu/` from the modern
`Innovatum.WebMenu` — verify which currently hosts this module. The client install step is uniformly
named `Sentinel_Setup.exe`, which predates the current Launcher → Tray → plugin chain
(`Innovatum.Client.Loader` → `Innovatum.Sentinel.Tray`).

### Common setup (repeated across nearly all 14 documents)
- `MenuWebIntegration.BP_DestLabeling` must be enabled for the module to appear at all — without it,
  the module is invisible, not just disabled.
- `GlobalSettings` rows under `SettingOwner = Innovatum.Pages.DestinationLabeling.Printing.WCF`
  (this owner string already confirms the module was InnoPages/WCF-plugin-based even in the ~2018
  source docs) define schema/field indirection for Destination Codes and Destination Templates:
  `DestCode_SchemaName`, `DestCode_Code_SchemaField`, `DestCode_Description_SchemaField`,
  `DestCode_Active_SchemaField`, `DestCode_LangPrefix`, `DestTemplate_SchemaName`,
  `DestTemplate_Code_SchemaField`, `DestTemplate_Template_SchemaField`, `DestLabelingPhraseField`
  (which Item/Master Data field holds the source phrase for dictionary translation — test data used
  `I_PName`), `DefaultDestination` (which field holds the destination code — test data used `I_Dest`),
  `DestVerificationTemplate` (templated string, format `<DestCode>_<ItemNumber>_<LabelType>`). One
  document (`DL_CMActions`) updates these via raw SQL using owner `Innovatum.Pages.DestinationLabeling.Printing`
  (no `.WCF` suffix) — a discrepancy in the source itself; verify the real current owner string rather
  than trusting either copy blindly.
- `PrintConfig` row(s) with `ConfigName = DestLabeling`, `PrintFunction = OrderNumber`: params seen
  across the docs include `EnforceMasterData`/`EnforceMasterDataStatus`, `AutoCheckMultipleCopies`,
  `AutoCheckPrintLabels`, `AutoCheckPrintDocs`, `AutoCheckRequireVerification`, `StartingSerialNumber`,
  `BarcodeParseStoredProcedure` (default `DestLabelingDefaultParse`), `PrintServerTimeout` (minutes,
  decimal e.g. `0.5`), `WarnWhenPrintedLabelsExceedsValue` (default 50), `NeedESignatureForReprint`.
- `Codes` table drives several lookups: `CodeType='IncludedLabelTypes'` / `Code='DestLabeling'`
  (pipe-delimited label types eligible for DL), `CodeType='IncludedFilePurpose'` / `Code='DestLabeling'`
  (pipe-delimited document purposes eligible), `CodeType='ExcludedLabelTypes'` / `Code=<PrintFunction>`
  (used by *other* print pages to hide DL label types — see Regular Printing below),
  `CodeType='DLP_Label'` / `CodeType='DLP_Doc'`, `Code=<workstation name>`, `Description=<printer
  model(s), comma-separated>` (per-workstation label/document printer eligibility).
- `Settings` table: `DictionaryOnlyApproved`, `DictionaryOnlyEffective` (Y/N) control which phrase
  version (approved vs. effective) dictionary translation picks per language.
- Items/orders need a released, Approved+Effective LCN linking Item + Master Data + Template; a valid
  GTIN+Lot (and optionally Serial Number) barcode; `PICKHEADER`/`PICKDETAIL` rows with
  `SourceSystem='ROBAR'`, `HeaderStatus='Pending'`.

### GlobalSettings caching gotcha (strongly corroborated — appears in 4+ of the 14 docs)
- **Settings appear to be read once at `ROBAR_ServiceHost` startup, not live-reloaded.** Every
  `GlobalSettings` change in these test cases is followed by manually stopping and restarting the
  `ROBAR_ServiceHost` Windows service before the new value takes effect (current architecture doc
  calls this service `Innovatum.ServiceHost` — confirm actual current service name). One document's
  `PrintConfig.EnforceMasterDataStatus` change is notably *not* followed by a restart step, which
  hints `PrintConfig` may not be cached the same way GlobalSettings is — inconsistent evidence within
  the source set itself, worth confirming directly rather than assuming either way.
- `DestCode_*` settings are validated **eagerly**, at module open — blank or invalid values block
  the module from opening at all: *"Error occurred while loading all required Destination information.
  Please check Global Settings..."*.
- `DestTemplate_*` settings are validated **lazily**, only at first barcode scan — the module opens
  fine and only then fails with *"No print rows found for given barcode ''"*. Useful diagnostic split
  if a report says "module won't open" vs. "module opens but scanning does nothing."
- A blank `DestVerificationTemplate` produces its own distinctly-named error: *"DestVerificationTemplate
  Global Setting could not be found"* — different from the generic DestCode error above.
- Translations further depend on **item data**, not just settings: an item with no value in the field
  named by `DestLabelingPhraseField` prints language identifiers but no translated text even when every
  setting is correct — a "translations missing" report could be missing item master data, not a
  misconfigured setting.
- Destination **Active** flag and **language order** are edited via Master Data Management (not
  GlobalSettings) and are picked up live: deactivating a destination removes it from the dropdown;
  reordering its language rows changes the on-screen display order — confirms this part is data-driven,
  not cached the way GlobalSettings is.

### Barcode parsing (GS1)
- Parsing logic is pluggable per `PrintConfig.BarcodeParseStoredProcedure` (default
  `DestLabelingDefaultParse`).
- Recognized GS1 Application Identifiers: GTIN (01), Expiration Date (17), Manufactured Date (11),
  Lot Number (10), Serial Number (21). Any other AI: *"Unable to recognize GS1 data identifier. The
  accepted GS1 data identifiers are GTIN(01), Expiration(17), Manufactured(11) Lot(10), and
  SerialNumber(21)"*.
- A single scan that doesn't supply every required field opens a **Barcode Scan** dialog with
  **Fields Found** (populated) and **Fields Required** (missing, with manual-entry fallback). Multiple
  scans accumulate — a later scan can overwrite an earlier field's value or add a new field. **Reset**
  clears accumulated state; **Current Scan** resumes an in-progress accumulation.
- Blank `BarcodeParseStoredProcedure` config → *"Unable to parse Barcode. Print Config
  'BarcodeParseStoredProcedure' is blank"*. Parsed barcode with no matching printable Item → *"No print
  rows found for given barcode"*. Parsed Item/Lot not in the current order's worklist → *"No worklist
  item found for this ItemNumber/LotNumber combination"*.

### Order / Worklist mechanics
- Entering an Order Number with no matching worklist → *"No worklist elements found for the entered
  order number: <OrderNumber>"*.
- **Create Order** auto-generates an Order Number as `ccyymmdd-0001` (current date + 4-digit sequence,
  recorded as `PickHeader.CreatedOn`); the field is not editable afterward. Re-entering an existing
  order number and clicking Create Order → *"Order already exists"*.
- Orders created via **Create Order** (ad hoc, Ordered = N/A) cannot use **Print All** — only manual
  scan/pack. Orders retrieved by an existing Order Number can.
- Worklist grid: Material, Lot, Packed, Ordered, Status (Pending/In Progress/Complete), per-row
  **Reset** and **-1** (decrement Packed by 1, disabled at 0), grid-level **Show Done**, **Reset All**,
  **Print All**.
- **Packed and Ordered are a direct read of `PickDetail`, not computed at print time** — confirmed
  against the live current-7.x source (`Innovatum.Pages.DestinationLabeling.Printing.WCF\DestLabelingDB.cs`),
  not just the old test docs, so this is higher-confidence than most of this section. Grid `Ordered` =
  `PickDetail.OrderedQuantity`, grid `Packed` = `PickDetail.ScannedQuantity`. `Status` is **not a stored
  column** — it's derived live by comparing the two (`ScannedQuantity < OrderedQuantity` = pending, per
  `DestLabelingDB.NumPendingWorklistRows`); Complete once `ScannedQuantity >= OrderedQuantity`. Real
  table name is `PickDetail` (singular) — the old docs' occasional `PICKDETAILS` (plural) is wrong.
  - **`OrderedQuantity` is set once, at row `INSERT`, and is never `UPDATE`d again anywhere in this
    service.** The module's *own* only insert path (`DestLabelingService.CreateOrder` → an ad-hoc
    barcode scan against a brand-new order) hardcodes `OrderedQuantity = -1` (rendered as `Ordered =
    N/A` in the grid) via `DestLabelingDB.InsertPickDetail(...)`. So **this module never itself creates
    a row with a real (non-N/A) Ordered quantity** — for a row to show a real number, some other
    process must `INSERT` into `PickDetail` with that value already populated before the user ever
    opens the order in Destination Labeling (an external order interface/import, or a manual/DBA
    seed for test purposes — outside this WCF project's own code, not documented in the old `DL_*`
    docs either). Confirms an open question those docs left dangling: their preconditions all specify
    `SourceSystem = 'ROBAR'` on pre-loaded orders, but the module's own two `InsertPickHeader` call
    sites use `SourceSystem = 'AutoCreateOrder'` (auto-numbered `ccyymmdd-0001` order) or
    `'CreateOrder'` (user-typed order number) — neither is `'ROBAR'`, so `'ROBAR'`-tagged orders are
    confirmed to originate outside this module.
  - **`ScannedQuantity`** starts at `0` on that same ad-hoc insert, then changes only via
    `DestLabelingDB`'s three update paths: a successful print (`ScannedQuantity = ScannedQuantity +
    <copies>`), the **-1** button (`ScannedQuantity = ScannedQuantity - 1`), and **Reset**/**Reset All**
    (`ScannedQuantity = 0`, all rows for **Reset All**).
- Custom columns can be added directly to `PICKHEADER`/`PICKDETAIL` (e.g. via `ALTER TABLE`) and flow
  through as sharenames into every downstream print/preview surface (order Detail dialog, printed
  labels, Campaign Manager PDF output, Label Master workflow PDFs, ROBAR Designer sample generation).
  A sharename with no backing value renders blank rather than erroring.

### Print All
- Enabled only when at least one worklist row is Pending/In Progress with a real Ordered quantity (not
  N/A) and not every row is already Complete.
- On click, locks the four auto-print checkboxes (Require Verification / Print Multiple Copies / Auto
  Print Label / Auto Print Documents) and processes worklist rows top to bottom; copies printed per row
  = Ordered − Packed.
- **On any print error, Print All halts entirely** rather than skipping the failed item and continuing
  — the document's own section header claims errors "will be ignored," but the step-level expected
  results directly contradict that summary. Treat halt-and-require-manual-resume as the real behavior;
  re-clicking Print All resumes with the *next* unfinished row, not an automatic retry of the failed one.
- Serialization: with `StartingSerialNumber` set, `S_Ser` components auto-increment per copy from that
  seed (ignoring their own Embedded Data); `S_USerial` always increments from the template's own
  Embedded Data value regardless of the print config. With `StartingSerialNumber` blank, both fall back
  to the template's own Embedded Data (blank Embedded Data on `S_Ser` → blank serial printed).

### AutoPrint
- `AutoCheckPrintLabels`/`AutoCheckPrintDocs` set the default checked state of the corresponding
  checkboxes; scanning a barcode with them checked auto-prints all matching pending
  labels/documents for that item/lot without a manual Print click.
- Caching (`DESTLABELINGCACHE`: Hash/LCN/PrinterModel/Contents/Inserted) is written **only** for
  non-serialized label prints — never for documents, never for serialized labels.
- `PRINTHISTORY` gets one row per print; the actual serial value lives in `PRINTHISTORYSERIALS`
  (keyed by `LASTTOUCH`) — **no `LOTSERIALNUMBERS` row is created for DL-driven prints**, unlike other
  printing flows.
- No printer configured for a row's type → Printer shows "No Printers," row silently stays Pending with
  a disabled Print button — no error surfaced, easy to mistake for a stuck job.
- A row that fails to auto-print shows an Error icon with its Print button re-enabled for manual retry;
  other rows are unaffected (per-row failure, not all-or-nothing — this differs from Print All's
  halt-on-error behavior above, so don't conflate the two flows).
- Document auto-print additionally depends on an `AttachmentParameters` row
  (`Parameter Purpose='DestinationLanguage'`) matching an ISO language code valid for the order's
  Destination Code.

### Require Verification
- When checked, each printed row is highlighted yellow pending verification; hovering the Template
  cell reveals a verification code, which must be scanned/entered into Barcode Scan to turn the row
  green and increment Worklist Packed by 1. Re-scanning an already-verified code →
  *"This row has already been verified."*
- Unchecked: printing directly increments Packed, no scan step.
- Print Multiple Copies + Require Verification together: one verification scan still increments Packed
  by only 1 regardless of copies printed. Print Multiple Copies alone (verification off): Packed
  increments by the *smallest* number of copies successfully printed across the action's rows.
- Templates must carry `Dest_Verification`, `Dest_Destination`, `Dest_DestinationName` sharenames for
  the verification code/destination info to appear on the printed label.
- Copies field: negative/non-integer disables Print; exceeding `WarnWhenPrintedLabelsExceedsValue`
  (default 50) prompts a Yes/No confirmation rather than hard-blocking.
- Order Status flips "Incomplete (# Items Pending)" → "Complete (0 Items Pending)" once every item is
  packed; page background turns green and Order Number auto-clears. Session History dialog corresponds
  to `DestLabelingSessionDetail` rows with `Status = Verified`.

### Printer hierarchy / selection — confirmed against live source, higher confidence than most of this section
Traced through `DestLabelingPrinters.cs`, `DestLabelingService.cs`, `DestLabelingDB.cs`, and the shared
`Lib\Src\DotNet\Innovatum\ROBAR\PrinterOptionsStrategyPrtCtrl.cs` (2026-09-15). Two distinct layers:
- **Per-workstation eligibility (DL-specific)** — `Codes` table: `CodeType='DLP_Label'` (labels) /
  `CodeType='DLP_Doc'` (documents), `Code`=workstation name (case-insensitive match), `Description`=
  comma-separated eligible printer **model** name(s). No configured model for that workstation/type →
  "No Printers," Print disabled for that row. **Asymmetry**: label printers are further filtered to
  only those the client reports as `Available` (shared with the ROBAR Print Server,
  `GetOnlyPrintServerPrinters()`); document printers use the full unfiltered client printer list
  (`GetAllPrinters()`) — no print-server-sharing requirement for docs.
- **Template/Item/Workstation override — the real `PrinterControl` table, shared system-wide, NOT
  DL-specific** — accessed via `RobarDb.GetPossiblePrinterControlRecords(item, label, workstation)` +
  `PrinterControl.GetPrecedenceComparisonRules(...)`, the same mechanism Regular Print and Single Piece
  Flow printing use. Precedence-based rule matching (most specific Template/Item/Workstation wins,
  wildcards supported); a matching rule narrows the printer list to just the printers it names.
  **Only applied to label printers** — `DestLabelingService.cs` calls
  `PrinterOptionsStrategyPrtCtrl.FilterPrintersUsingPrtCtrl(...)` on the label-printer list only;
  document printers skip this filter entirely.
- **Default/ordering** — `DestLabelingDB.WorkstationPrinters(...)` sorts the eligible printers
  **descending by most recent `PrintHistory` record** for that exact printer+workstation+template
  combo, so "last used for this template on this workstation" lands first/default in the picker —
  confirms and pins down the old docs' "auto-select last used" claim.
- ROBAR Print Server down → per-row Error icon, message *"Timeout waiting for Print Server. Waited
  {timeout} minutes for a response."* (timeout from `PrintConfig.PrintServerTimeout`, in minutes).
  Failures are per-row/independent — one row's print failure doesn't block others on the same order.

### Print History integration
- DL print history records use a `PrintID` prefixed `DEST_`.
- The **first** print of a given item/lot/template combo in a session creates a new Print History
  record; a **subsequent** print of the same combo in the same session **updates** that record instead
  (`PrintDate` refreshes, `Copies` increments) rather than creating a duplicate row.
- Label prints populate `LCN`; document prints (e.g. IFU) leave `LCN` blank — the same item/order/lot
  can have two separate Print History rows (one with LCN, one without) depending on artifact type.
- Session History UI (all prints, resets, scans including failed ones, each with its own status/message)
  is backed by `DestLabelingSessionHeader`/`DestLabelingSessionDetail`, independent of Print History.

### Translation / dictionary resolution — inconsistency between two docs, don't over-merge
Both `DL_CMActions` (Campaign Manager's Save to PDF / Recreate Master / Send to Workflow output) and
`DL_RegularPrinting` (other, non-DL print pages consuming DL sharenames via `DefaultDestination`)
document a translation resolution matrix keyed on destination validity × phrase-field validity, but
the two **do not agree** on one cell — treat this as an open question to verify against live behavior
rather than a single confirmed rule:
- Both agree: valid destination + valid phrase → dictionary translation; invalid destination (either
  case) → template's own sample text.
- `DL_CMActions` says valid destination + invalid/blank phrase → falls back to **data from the item
  record**.
- `DL_RegularPrinting` says valid destination + invalid/blank phrase → **blank** output.
- This may be a genuine difference between the two print contexts (Campaign Manager vs. Regular Print
  pages) rather than a documentation error — don't assume one is simply wrong without checking live.
- Also relevant: `DefaultDestination` (GlobalSettings) applies to all print pages *except* DX Printing,
  per `DL_RegularPrinting`.
- Regular Printing separately documents that DL label types can be excluded from other print modules
  via `Codes` (`CodeType=ExcludedLabelTypes`, `Code=<PrintFunction>`); when active, printing that order
  elsewhere shows *"No printable label types for this workstation due to label type exclusions.
  {Workstation}"*.

### Licensing
- License usage is tracked per workstation+printer combination in a `printers` table
  (`workstation`, `LastActive`). A license is consumed only when there's no existing record for that
  workstation/printer combo, or its `LastActive` is more than 24 hours stale — printing again within
  24 hours from the same workstation/printer doesn't consume an extra license.
- License allocation (Allowed vs. Used, for `Innovatum.Robar.Printing.Web`) was viewable via a License
  Manager admin page at `http://localhost/Innovatum/Licensing/Admin/Manager.aspx` (a Web Forms `.aspx`
  page — verify this path/UI still exists in 7.x before relying on it).

### Localization
- Localizable strings live in `localizationresourcedef` (definitions) + `localizationresources`
  (translated values), joined by `ResourceType`+`ResourceKey`+`CultureCode`. An `IISRESET` was required
  after inserting new translation rows for them to take effect (verify against current caching
  behavior). Per CLAUDE.md, seed localization data now lives under
  `Innovatum.Install/ROBARDB/BaseProductTables/LocalizationResourceDef/Default_Localizations/` rather
  than the old ConfigManager `AppLocalize` classes — this doc's manual SQL/Excel workflow for adding a
  new language predates that reorganization.
- Localization covers page title, section headers, buttons, field labels, and status/error messages
  throughout the module (confirmed broad coverage, not just a few strings).

### Security process gating (granular, per-feature)
- `BP_DestLabeling` gates module visibility entirely (module icon absent, not just disabled, if
  missing). Beyond that, each feature is gated by its own independent process — losing one hides only
  that control, not the page:
  - `BP_Dest_CreateOrder` → Create Order button
  - `BP_Dest_RequireVerification` → Require Verification checkbox
  - `BP_Dest_PrintMultipleCopies` → Print Multiple Copies checkbox
  - `BP_Dest_EditWorklist` → Reset All / Reset / -1 buttons
  - `BP_Dest_PrintAll` → Print All button
- This module-level-process-plus-per-feature-processes pattern (`BP_<Module>` /
  `BP_<Module>_<Feature>`) is a reusable reference pattern worth checking for on other modules with
  similar naming.

### Campaign Manager (CM) Actions — despite the `DL_CMActions` filename, this is Campaign Manager, not Communications Manager
- Validates that Campaign Manager's **Save to PDF**, **Recreate Master**, and **Send to Workflow**
  actions apply the correct destination + phrase translation when generating Destination Label
  PDFs/masters — same schema-not-found / blank-setting failure modes as the live module (`Schema not
  found '<value>'`, surfaced as `CompletedWithErrors` rather than a hard failure).
  Applies identically whether reached via Save to PDF/Recreate Master (already-approved items) or Send
  to Workflow (unapproved items tied to a Change Control — reached in this test via Campaign Manager's
  **Mass Item Update** action, which associates unapproved items with a change control so they surface
  under Campaign Manager's "Unapproved Only" filter).

### Possibly obsolete (Web Forms era) items not already called out above
- "ROBAR Designer" is referenced as the tool for editing `Codes` records in several docs — current
  architecture manages this kind of reference data through `Innovatum.DataManagement.Web` (Master
  Data); confirm whether "ROBAR Designer" still exists under that name or was folded in.
- A separately-launched "Printer Control web module" (`DL_PrintingHierarchy`) — verify it still exists
  as a standalone module under this name in the current InnoPages/API plugin structure.
- Destination Labeling's current 7.x home is most likely `Innovatum.API.SN.DestinationLabelPrinting.MVC`
  going by the plugin name in CLAUDE.md's project map — not confirmed against any of these 14 docs
  directly (they predate that naming), but worth checking there first when validating any of the above.

---

## Driving BarTender/Sentinel native dialogs (playbook)

Read this FIRST before writing FlaUI interaction code for any NEW BarTender Editor action or
dialog, in Template Management or any other module that ends up launching Sentinel/BarTender.
Distilled from the extensive live debugging behind `Create_and_Approve_Template.spec.ts`'s original
Approve/Signature flow and `Get_Data.spec.ts`'s Get Data/Restore flow — both took many iterations to
get right, and the same handful of gotchas caused most of that cost both times. Following this
checklist up front should turn a multi-hour debugging marathon into a first- or second-try success.

**Added 2026-10-02 (two-object label layout work):**
- **To SEE the BarTender canvas, capture the `Workspace` element, not the window.** The "Template
  Editor" top-level window is only the banner strip (action bar); the designer is a child window
  (`<file>.btw - BarTender Designer`) holding the `Workspace` pane. `flaui.screenshot()` can't narrow to
  an element, but the CLI can: `FlaUIAutomation.exe screenshot --process-id <pid> --element-name
  Workspace --out <png>` (the Node wrapper simply doesn't pass `--element-name` through). The capture
  is the label cropped 12px inside the pane on every edge, so image coords + 12 = Workspace coords.
- **Text-object spacing:** a default text box is ~68px tall (Workspace rect 1608x725, standard 4"x2"
  label). With the first object auto-centered, a second object dragged to center -80px overlapped it by
  half a line; **-135px above center (x -150) leaves ~45px of clear space.** Use
  `bartender.secondTextObjectOffset(workspaceRect)` (support/bartender.ts) rather than a literal.
- **View > Data Source Names shows each text box's sharename on the label itself** (user's tip,
  verified live 2026-10-02). The menu item is named `Data Source Names<TAB>F12` (shortcut text is part
  of the name; `flaui.click` matches by substring, `controlType: 'MenuItem'`) and it is a TOGGLE.
  `bartender.captureDataSourceNames(page, pid, outPath)` turns it on, captures the `Workspace`
  canvas, and turns it back off. The user wants this screenshot as evidence in UATs and formal test
  scripts after a template is created.
- **The Sentinel launch prompt click needs the browser in the FOREGROUND.** `clickAt` is a real
  SendInput click on whatever window is topmost at that pixel; with Slack/Word/etc. in front it "succeeds"
  against the wrong window and "Open SentinelLauncher?" never closes (failed 3x in a row after working
  all morning). `confirmSentinelLaunchPrompt` now calls `bringWindowToForeground` before every attempt.
- **Launching `BarTend.exe` standalone is NOT a shortcut here:** it opens fine
  (`C:\Program Files\Seagull\BarTender 2022\BarTend.exe <file.btw>`, Designer window ~16s later), but
  neither FlaUI nor raw Windows UI Automation can see that window (0 elements for its pid, neither
  process elevated) -- so nothing can drive it. Use the Template Management launch path instead.

**1. Ground every selector in a real dump-tree before writing any interaction code.** Don't guess
control names from a formal test script's prose or from a screenshot alone — get the actual
process id (`list-processes --name-contains bartend`) and dump the KNOWN-reachable top-level window
(`--title "Template Editor"`, generous `--max-depth` like 15-20, redirected straight to a file) while
the new dialog is open on screen. Read the file directly rather than relying on secondhand
descriptions of what's on screen.

**2. Assume any dialog opened by a BarTender button click is a NESTED CHILD WINDOW, never a real
top-level window** — even if it visually has its own title bar and close button (confirmed
misleading for Get Data, and already known for Signature Required/Text Properties/the Change Data
Source Name Wizard). Concretely:
- `title: '<the dialog's own name>'` will not resolve it — `FindWindow`'s top-level enumeration
  doesn't see it.
- Reach its controls via `elementAutomationId: '<the dialog's own AutomationId, from the dump>'`
  passed alongside `title: 'Template Editor'` (or whatever the real top-level window is) on
  `click`/`getProperty`/`setText`. Prefer this over `elementName` — a bare `elementName` search has
  been observed to time out unpredictably (a `NoClickablePointException`-adjacent failure) rather
  than resolve or fail cleanly, for reasons not fully understood.
- `dumpTree`/`screenshot` do NOT support `elementName`/`elementAutomationId` nested scoping at all
  (only `click`/`getProperty`/`setText` do) — there is no way to directly dump or screenshot a
  nested dialog by itself. Always target the nearest resolvable top-level-ish window instead and
  read the nested subtree out of that dump.
- A `processId`-only `dumpTree`/`screenshot` (no `title`) has been confirmed to consistently return
  empty/nothing for this multi-window BarTenderEdit process. Always pass an explicit `title`
  (`'Template Editor'` is the one every existing click in this suite already scopes by).
- **Confirmed exception (Template Editor's `PDF` button, 2026-09-30): not every dialog opened by a
  BarTender button click is nested inside the known window at all** — some hand off to a genuinely
  separate top-level process (PDF hands off to the system's own PDF viewer, e.g. Adobe Acrobat
  Reader, as its own process, and a crash it triggered showed up as a THIRD, unrelated top-level
  window). A `title`-scoped `dumpTree` of `'Template Editor'` showed literally no change at all after
  the click — looked exactly like a no-op. Before concluding a click did nothing, widen to a plain
  Win32 `EnumWindows` (a quick ad-hoc PowerShell/.NET P/Invoke snippet, not FlaUI) across ALL visible
  top-level windows, not just a deeper/wider dump of the window you already know about.

**3. Pick the click method deliberately, don't wait to hit a hang.** Default to `method: 'mouse'`
for ANY button that submits, confirms, or opens another dialog — i.e. anything whose click handler
plausibly does real work synchronously. Reasoning: the default click method (UI Automation's
`InvokePattern.Invoke()`) is itself a blocking synchronous COM call that hangs until the handler
returns, and a handler that does real synchronous work (shows a modal dialog, writes data) never
returns until that work is done. **`method: 'win32'` (raw `SendMessage(BM_CLICK)`) is JUST AS
SYNCHRONOUS and will hang identically** — it looks like it should help (it needs no
screen-coordinate resolution, so it seems like a good fix for a `NoClickablePointException`) but
it isn't a fix for a blocking-handler problem, only for a point-resolution problem specifically.
Only `method: 'mouse'` (real `SendInput`, fire-and-forget regardless of what the handler does) is
safe for this whole category of button. Confirmed true for Approve/Submit (original file) and Get
Data/Submit (this file) independently — treat it as the default assumption for any new
submit/confirm-style button, not a fallback to reach for after failing twice.

**4. Always pass `automationId` alongside `name` when you have it**, even for a plain (non-nested)
click. `FindControl` tries `ByAutomationId` first and returns immediately if it matches, skipping
the slower/riskier by-name fallback path entirely.

**5. Never target an individual `DataGridView` CELL by name.** A bare `--name` search against a
WinForms `DataGridView`'s individual virtualized/MSAA-bridged cell elements (e.g. an `[Edit]`-typed
cell like `"Item Number Row 0, Not sorted."`) has been confirmed to hang FlaUI's
`FindFirstDescendant` outright, regardless of how narrowly the search root is scoped (tried both the
whole containing dialog and the grid's own small subtree directly — identical hang either way). If a
specific row/cell genuinely must be clicked, use `clickAt` against the GRID CONTAINER's own
resolvable AutomationId (read its `BoundingRectangle` via `getProperty` first, then compute a pixel
offset — a standard WinForms header height (~23px) plus half a row height (~11px) is a reasonable
starting guess) rather than searching for the cell by name. Also worth checking first: does the row
actually need clicking at all, or is it already selected by default? (It was, for Get Data — the
"needs a row click" theory turned out to be based on unrelated scoping bugs, not a real requirement.)

**6. If raising `retrySeconds` reproduces the IDENTICAL error text, that's proof of a real hang, not
evidence more time would help — stop bumping the number.** `FlaUIAutomation.exe`'s own retry loop
(`PerAttemptTimeout` in `Program.cs`) caps every single sub-attempt at a hard 15 seconds internally
regardless of the `--retry-seconds` budget passed in, and `TryWithTimeout`'s `Task.Wait(timeout)`
never cancels the underlying task when it times out — a genuinely-stuck call just keeps its thread
running in the background while the retry loop starts another one. A truly slow-but-eventually-
succeeding search benefits from a bigger budget; a hung one produces the exact same failure at 20s
and at 90s. Confirm which one you're looking at (same error text = hang) before deciding whether to
widen a timeout or fix the underlying scoping/method/target instead.

**7. Strip out diagnostic scaffolding once a flow is confirmed working.** Dump-tree/screenshot
captures on every step are essential while bootstrapping a new dialog (each one is a separate
`FlaUIAutomation.exe` process launch, and skipping them is exactly why a passing test can still feel
slow), but they're pure overhead once selectors are proven. Replace them with one cheap, meaningful
assertion if one exists (e.g. a `getProperty` check that a button's `IsEnabled` state actually
flipped as a result of the action, proving it had a real effect — not just that the click didn't
throw). Relatedly: never let a `try/catch` swallow a real failure into a `console.log` only — use
`try/finally` if diagnostics-on-failure are still wanted, but let genuine errors propagate. A
"passing" test must mean the thing actually worked, not that every step silently no-opped.

**8. `method: 'mouse'` vs `'win32'` are NOT interchangeable "safe" alternatives to the UIA default —
each fails a different way, and picking wrong can crash the whole app, not just hang.** Distilled
2026-09-30 from `Create_and_Approve_Template.spec.ts`'s Approve/Signature-Required flow (the
deepest debugging in this whole suite — three misdiagnoses before the real root cause, see that
file's own inline comments for the full narrative, condensed here):
- The default click (`InvokePattern.Invoke()`) and `method: 'win32'` (`SendMessage(BM_CLICK)`) are
  **both fully synchronous** — they block until the target's click handler returns. For a button
  whose handler does real synchronous work (opens a modal dialog, submits data, tears down the
  process), neither ever returns until that work finishes — indistinguishable from a genuine hang
  from the caller's side, EXCEPT that `BM_CLICK` on a handler that closes/crashes the app mid-call
  can bring down the whole target process instead of just hanging (confirmed live: BarTenderEdit's
  Approve button crashed outright under `win32`, raw COM error `0x80040201`, process gone).
- `method: 'mouse'` (real `SendInput`, a genuine synthesized OS-level click) is the only
  fire-and-forget option — it returns immediately regardless of what the handler does, because it
  isn't a blocking call INTO the handler at all, just an OS input event. **Default to `mouse` for any
  button that submits, confirms, opens another dialog, or closes a window/tab/process** — this
  generalizes item 3 above with a concrete crash case, not just a hang case.
- **`setText`/read-back for these legacy WinForms controls is separately unreliable via UI
  Automation** (`ValuePattern`), independent of the click-method issue — confirmed live: a write
  reported success but the field stayed empty, and this survived two other misdiagnoses (a
  stale-cache read-back bug, then over-inflating `retrySeconds` to compensate) before the real fix:
  pass `method: 'win32'` on `setText` itself (raw `WM_SETTEXT`/`WM_GETTEXT`), the same technique
  legacy-automation tools like AutoIt use for exactly this class of app. This ALSO fixes verifying a
  masked password field — UIA's `Value` property always reads back `null` for a password box (by
  design, the OS hides it), but `WM_GETTEXT` doesn't have that limitation, so `verify: true` becomes
  usable there too once `method: 'win32'` is in play.
- **A dialog's fields can have BLANK accessible names** even when a `Static` label sitting next to
  them (e.g. "User:", "Password:") makes them look nameable — confirmed for BarTender's own
  Signature Required dialog (`txtUser`/`txtPassword` Edit controls have empty `Name`, the readable
  text is a separate sibling `Static` element). `automationId` alone must carry the match in that
  case; a `name` passed alongside it is then just a readable placeholder in the code, not something
  `FindControl` actually needs.
- **The same numeric `automationId` (e.g. `"1"`) is commonly reused across DIFFERENT nested dialogs**
  for their own default button (OK in one, Close in another) — a generic Win32 convention, not a
  collision bug. This is exactly why item 2's `elementName` scoping (to the specific dialog the
  button lives in) matters even when `automationId` alone looks unambiguous enough.

**9. When debugging a NEW BarTender interaction, launch BarTender standalone instead of driving the
whole web-menu round trip every iteration.** BarTender is just a third-party desktop app
(`C:\Program Files\Seagull\BarTender 2022\BarTend.exe`) — it doesn't need Sentinel, the ROBAR web
menu, or a GetFileToken round trip to open; `Start-Process BarTend.exe "<path-to-a-.btw-file>"`
opens it directly against any template file (a scratch copy of the shared `NewTemplate.btw` base is
a safe starting point, so nothing shared gets modified). The resulting window's title is simply
`"<filename> - BarTender Designer"` (no `"Template Editor"` wrapper — that wrapper is an
Innovatum/Sentinel-specific layer, absent here) and its whole control structure (Workspace, the
Arrange toolbar, the Menu Bar, etc.) is otherwise identical to what the wrapped version exposes, so
findings transfer directly. This is exactly how the `addTextObjectBoundToSharename` right-click fix
below was found and validated — several fast dump-tree/click/screenshot iterations directly against
a standalone `BarTend.exe` instance, with no login/create-template/Sentinel-prompt overhead per
attempt, then ported into `bartender.ts` and confirmed once, end-to-end, through the real web-menu
flow to prove it holds in production context. Prefer this whenever iterating on a specific
in-BarTender interaction; save the full web-menu round trip for final confirmation, not every
attempt along the way.
- One real gotcha hit this way: saving a modified template standalone (`Ctrl+S`, or the Main
  toolbar's own `Save` button — which has no distinguishing `automationId` in this window, unlike
  the Sentinel wrapper's own `btnSave`) can pop a **"Save Warning"** dialog (format/compatibility
  confirmation) that FlaUI's own `dumpTree`/`click` calls, scoped either by title or by processId
  alone, couldn't resolve or even enumerate (calls hung rather than erroring) — while raw Win32
  `EnumWindows` (a quick ad-hoc PowerShell/.NET P/Invoke snippet) found it immediately, confirming
  it really was open and blocking, not a phantom. Since the dialog reliably has OS input focus the
  moment it appears, a plain `sendKeys(['RETURN'])` (which targets whatever currently has focus, not
  a specific resolved element) dismissed it cleanly where every FlaUI-resolved-target approach had
  failed. Worth trying first for any similarly "unresolvable but definitely open" native dialog.

**10. `flaui.listProcesses()` silently filters to ONLY processes with a non-empty `MainWindowTitle`
at query time** — confirmed via `FlaUIAutomation`'s own source (`Program.cs`'s `CmdListProcesses`:
`.Where(p => p.mainWindowTitle.Length > 0)`), not documented anywhere in the CLI's own JSON output.
A just-spawned process whose window hasn't acquired a title yet (or is taking unusually long to,
e.g. under real-world resource contention after many hours of repeated launches) is **completely
invisible** to this call no matter how long or how many times you poll it — there is no way to tell
"genuinely never launched" apart from "launched fine, just titleless so far" through this call alone.
Real incident (2026-09-30): Sentinel Tray's own log confirmed `Innovatum.Sentinel.Plugin.
BarTenderEdit.exe` launched successfully and passed its own WCF `isAlive` handshake with a real PID
on every attempt, yet `listProcesses()` — polled for over 2 minutes — never found it, sending the
debugging effort down several wrong paths (suspecting Sentinel Tray itself, session timeouts, etc.)
before the title-filter was found in source. **Fix for detecting a process purely by name,
independent of whether it has a window/title yet: shell out to `Get-Process -Name '<name>'`
directly** (e.g. via Node's `child_process.execFile('powershell.exe', [...])`) rather than relying
on this tool's own `list-processes` command for that specific question.

**11. `clickAt`'s synthesized mouse click (`SendInput`) can report success while the click lands on
a COMPLETELY DIFFERENT window** — confirmed live 2026-09-30, three times in a row. `clickAt`
resolves a target element's on-screen coordinate correctly and reports a genuine successful
click (`clickedAt: true`, with the exact right coordinate inside the target's own bounding
rectangle) — but `SendInput` dispatches to whatever window is PHYSICALLY topmost at that real
screen pixel at the moment the click fires, regardless of which window FlaUI logically resolved
the coordinate from. If some other window on the desktop (a terminal, a scratch file viewer, an
editor — anything left open from other work happening on the same machine) happens to be covering
that exact screen region, the real click goes there instead, and FlaUI has no way to know or report
this — it only knows it successfully dispatched an input event at coordinate (X, Y), not what
actually received it. This silently broke the "Open SentinelLauncher?" confirm click specifically
(a before/after `dumpTree` showed the dialog completely unchanged despite three consecutive
"successful" clicks), costing significant debugging time chasing session-timeout and process-
detection theories before this was found. **Fix: force the target window to the foreground (a raw
Win32 `SetForegroundWindow`, e.g. via a small ad-hoc PowerShell/.NET P/Invoke snippet) immediately
before any `clickAt` call, and don't trust `clickedAt: true` alone — verify the expected UI change
actually happened afterward** (e.g. re-`dumpTree` and confirm the dialog/element is actually gone),
the same "don't trust the click result, verify the real effect" lesson already learned elsewhere in
this playbook (item 7), now confirmed to apply to `clickAt` specifically, not just click-method
choice. This is a strong argument for the Claude Code /Claude Desktop window itself, terminal panes,
or other tool windows being fully minimized or moved off-screen during any long unattended run of
native-automation tests — anything left visible on top of the target app is a real risk, not just
cosmetic.
- Combined with item 10 above and the already-documented WebMenu session-timeout bug (see
  "WebMenu-wide issues" — `RefreshTimeout()` only resets on a literal `mousemove`, never fires
  reliably from inside a nested iframe), these three issues together fully explain a multi-hour
  debugging session (2026-09-30) chasing what first looked like session timeouts, then process-
  detection gaps, before the real root cause (the click itself never landing) was found via a
  targeted before/after `dumpTree` around a single isolated click — a useful diagnostic pattern to
  reach for earlier next time full end-to-end reruns aren't converging: isolate the ONE step in
  question into its own minimal script rather than re-running the whole expensive flow repeatedly.

### Launching Sentinel/BarTender itself (the step before any of the above applies)
Every Template Management flow that opens BarTender (Create New Template, Replace Template, Save As
New) fires the identical launch sequence first — distilled 2026-09-30 from
`tests/support/bartender.ts` (the current, proven, reusable extraction) and
`Create_and_Approve_Template.spec.ts`'s own inline history (the original, more narrated source; kept
intentionally untouched so its proven mechanics can't be broken by changes elsewhere):
- Submitting the dialog fires `GetFileToken`, whose response navigates a hidden `#sentinelFrame` to
  an `innoclient:` custom-protocol URL — this triggers Chromium's own native, unstyled "Open
  SentinelLauncher?" confirm-external-app dialog. **Not a JS dialog** — `page.on('dialog')` never
  fires and Playwright has no API for it; everything from here on is real desktop UI Automation via
  `scripts/flaui_bridge.js`.
- That dialog is **not a separate top-level window** — it's a Chromium Views bubble (`ClassName
  "RootView"`, titled `"Open SentinelLauncher?"` — no space, with the `?`) nested INSIDE the
  browser's own top-level window. A `--title` scoped search (`FindWindow`'s top-level enumeration)
  never finds it and just hangs to timeout; the fix is scoping by the browser's own `--process-id`
  alone, letting `FindControl` reach the nested bubble as a descendant.
- Resolving that PID needs real disambiguation, not just a page-title match — confirmed live that a
  machine can have a genuine second Chrome window open to the exact same page title as Playwright's
  own browser. Playwright's bundled browser identifies itself with `"for Testing"` in its window
  title; require both the page's own title AND that substring before trusting a process match.
- Clicking that dialog's own confirm button (`"Open SentinelLauncher"`, no space before "Launcher",
  `ClassName MdTextButton`) needs `clickAt` (a real synthesized mouse click at screen coordinates),
  not a plain UIA `click` — a plain `click` visibly highlights the button (so it LOOKS like it
  worked) but never fires Chromium's real click handler for this specific external-protocol-confirm
  button, plausibly a deliberate anti-automation safeguard on Chromium's part. Even `clickAt`
  reporting success isn't proof — dump the tree after each attempt and keep retrying until the
  dialog text is actually confirmed gone, rather than trusting a "dispatched successfully" result.
- Finding the spawned BarTender/Sentinel process (`Innovatum.Sentinel.Plugin.BarTenderEdit.exe`,
  window title `"Template Editor"`) needs a **process snapshot taken BEFORE confirming the launch
  prompt** — timing-sensitive: snapshot too late and the new process may already exist in both the
  "before" and "after" pictures by the time you diff, so `diffNewProcesses` finds nothing and the
  search spins for its whole attempt budget with no error at all. Falls back to a plain name search
  of the current snapshot (matching `/bartend|sentinel/i`) so a leftover process from an earlier
  interrupted run doesn't permanently block this step.
- Window existing ≠ BarTender ready — gate on `IsEnabled` for the "Text" MenuItem (see below for why
  it must be typed as `MenuItem`, not matched by name alone) with a real `retrySeconds` poll INSIDE
  one `getProperty` call (`{ attempts: 1 }` on the JS retry wrapper) rather than stacking a JS-level
  retry loop on top — each `FlaUIAutomation.exe` invocation has its own ~8s process-startup overhead,
  and stacking retries multiplies that against the JS attempt count, easily blowing past a test's own
  timeout budget on a genuine failure while a single internal `retrySeconds` poll stays cheap (one
  process, one COM connection, a plain `Thread.Sleep` between internal attempts).

### Adding a Text object and binding its data source (Create New Template / Save As New / Replace flows)
Also distilled 2026-09-30 from the same source pair — the sequence every "add content to a fresh
BarTender template" flow shares:
- **"Text" (the object-creation command) must be targeted as a `MenuItem`, not matched by name
  alone** — this window has an unrelated, same-named docked toolbar GROUP also called "Text";
  `controlType: 'MenuItem'` is what disambiguates the two.
- The flyout item you actually want ("Normal," under "Basic Text Objects") **cannot be clicked by
  name at all** — confirmed via a live dump-tree taken while the flyout was visibly open on screen:
  it appears nowhere in the UI Automation tree, not as a top-level window, not as a descendant,
  across a full 2-minute polling window. This custom toolkit (Xtreme Toolkit Pro/XTP) apparently
  doesn't expose this popup's items to UI Automation at all — not a timing problem, a structural
  one. Fix: send a raw `Enter` keypress (global OS keyboard input, no element lookup) — "Normal" is
  the default/first item and already has keyboard focus right after the flyout opens.
  **General lesson**: if a dump-tree taken WHILE something is visibly open on screen still shows
  nothing, stop looking for a better selector — the control likely isn't exposed to automation at
  all, and a keyboard-input fallback (or a coordinate-based one, below) is the real fix.
- Placing the object is a **click-AND-DRAG, not a single click** — a plain click creates the object
  but positions it wrong. The drag's from/to points must be computed from the "Workspace" pane's own
  live `BoundingRectangle` (via `getProperty`), not a fixed pixel offset from its top-left corner —
  Workspace is a much larger scrollable MDIClient area than the visibly-centered label within it, and
  the label's actual on-screen position inside that pane depends on zoom/scroll state that varies
  per run. A small drag near the rectangle's own center reliably lands on the label, since BarTender
  opens a new template zoomed-to-fit and centered in this pane.
- **Centering uses BarTender's own native "Center Horizontally/Vertically On Template" Arrange
  commands, not pixel-offset math** — a measured/computed placement correction was tried first and
  stayed fragile (tied to that specific template's size/zoom, still visibly off on a later run); the
  native commands center the already-selected object exactly, with no math at all.
- **The placed object itself ("Sample Text") is NOT a real UI Automation element — it isn't
  queryable by name or found by dumping the canvas, because the canvas control itself
  (`AfxFrameOrView140u`) has ZERO child elements.** Every object BarTender draws on a template is
  just rendered pixels, never a real UIA node — every attempt to find/right-click/read-the-rect-of
  "Sample Text" by name is doomed regardless of retry budget, which is the actual reason this
  particular step kept silently hanging/failing before the real cause was found (not a click-target
  precision problem). Fix: right-click via real screen coordinates on "Workspace" itself (which DOES
  exist as a real element) — once the object has been centered via the native Arrange commands
  above, its own center coincides with Workspace's own center, so no extra coordinate offset is
  needed at that point.
- **Text Properties, and everything inside it (the Change Data Source Name Wizard), are NESTED
  windows** — descendants of "BarTender Designer," not separate top-level desktop windows — so
  `title` scoping never resolves them; use `elementName` scoped to the dialog's own name instead
  (same rule as playbook item 2 above, reconfirmed here independently).
- The bound sharename must be a real, DB-defined one (e.g. `I_Num`) — an arbitrary/randomized string
  does not work here the way a randomized template NAME does elsewhere in the same flow.

### Reading a `.btw` file's own sharename bindings directly (no BarTender needed)
Reverse-engineered 2026-09-30 while preparing for upcoming multi-sharename testing (multiple text
objects per template, each bound to a different sharename) — the user asked whether `.btw` files
could be examined directly, and it turned out yes, with real value: **this gives a way to verify
which sharenames are actually bound in a saved template by reading the file itself, instead of
relying solely on live FlaUI/UI checks** (which, per the click-precision gap just above, aren't
fully reliable yet for this exact purpose).

**File structure**: a `.btw` is NOT single-format — it's three parts concatenated: (1) a plain-text
header (readable as-is, includes an XML `<Metadata>` block — Author/Company/TemplateSize/Printer/
etc.), (2) an embedded PNG thumbnail image (find its end via the last `IEND` chunk marker — a file
can contain more than one `IEND`-looking byte sequence, so a robust search should scan for it
positionally rather than trusting the first hit), (3) a zlib-deflate-compressed block holding the
actual document object model, whose text is UTF-16LE. **Don't naively grab the first successful
zlib inflate in the file** — the embedded PNG's own IDAT chunks are ALSO zlib-compressed and can
produce a "successful" but meaningless inflate of pixel data if the scan starts before the PNG
actually ends; skip past the last `IEND` first, then start the zlib-header (`78 9C`/`78 DA`/`78
01`/`78 5E`) scan from there.

**Confirmed byte layout for a plain Text object's sharename binding** (reverse-engineered against
two already-known-correct answers in `A1SuperTemplate_v0.btw`, confirmed via the existing
"I_Num" documentation): the literal UTF-16LE string `"Data Source"` (11 chars) is immediately
followed by a **fixed 12-byte / 6-UTF16-code-unit binary preamble** (flags/type/size fields, not
text — includes what looks like a UTF-16 BOM but isn't one), then the actual sharename as a plain
**null-terminated UTF-16LE string**. The owning object's own internal auto-generated name (e.g.
`"Text 4"`, `"Text 13"`) appears as readable text earlier in the same region, useful as a label but
not load-bearing for the parse itself.

**Tool**: `ROBAR_Tests/scripts/inspect-btw.ps1` (`-path <file>`) implements this — lists every
`Data Source` binding found, labeled by its owning object's internal name. Confirmed working
against the whole existing template library in
`OneDrive - Innovatum, Inc\Desktop\Attachments and Upload Files\Templates\`:
- **`A1SuperTemplate_v0.btw`, `A1SuperTemplateUSERIAL_v0.btw`, `MTA1_BT2022.btw`**: two bindings
  each, `Text 4 -> I_Desc` and `Text 13 -> I_Num` — genuinely already-existing, ready-to-use
  multi-sharename examples for the upcoming testing, no new template needed to see the pattern.
- **`MTSummary2022_v0.btw`**: two bindings, `Text 4 -> S_TEMPLATE` and `Text 13 -> I_Num`.
- **`MTDX1_BT2022_v0.btw`, `MTLotTemp_v0.btw`, `PromptTest.btw`**: 0 bindings found — either these
  genuinely use no plain-Text sharename bindings, or (less likely, not yet ruled out) the
  zlib-stream-selection heuristic picked the wrong block for these specific files.
- **`MTLanguagesTemp_v0.btw`, `MTLHI01_v0.btw`**: partial resolution only — one plain Text binding
  resolved correctly (`I_Desc`), but Barcode objects and `prompt<Question={...}>`-style dynamic
  tokens (per the Dictionary Management section's own note on this syntax) don't fit the same
  fixed-12-byte-preamble assumption and come back unresolved (`?`). **Known gap, not yet fixed** —
  worth a closer look if a future test specifically needs to verify a barcode or prompt-field
  binding this same way, but plain Text objects (the case that matters for the described upcoming
  multi-sharename testing) resolve reliably.

### Get Data / Restore — see the Template Management section's own "Get Data is a nested BarTender
dialog" writeup for the full debugging trail (nested-window scoping, the two dead ends, the
final working sequence); not repeated here to avoid duplicating it. One fact from that same test
worth surfacing here since it's a general cross-module gotcha, not BarTender-specific: an
unapproved, never-submitted-to-workflow template already shows up as a selectable option in Campaign
Manager's own Create-Item Template dropdown by name — no approval is required for a template to
become usable there. Don't assume Template Management's own "Approved"/"Effective" gates (which DO
control printing eligibility) also gate simple selectability elsewhere in the app.

---

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

## Field Definitions Management

**Purpose:** Maintain per-Label-Type field captions and sharenames for fields associated with Items,
Lots, Containers, and/or Facilities, and control the Item Edit screen's own tab/field layout per
Label Type. Already referenced in passing from Campaign Manager's own section (renaming a field's
caption here reflects live on the Item Edit page for every item of that label type — the same
"shared caption definition" pattern MDM's own Schema field captions use, scoped by Label Type
instead of Schema) — this is that module's own dedicated section.

**Formal scripts reviewed:** all 5 scripts under `Field_Definitions_Management\` (the top-level,
current folder — a `6.0.5` subfolder holds an older superseded copy): `FD_Management-1.doc`
(test-plan index), `FD_BasicFunctions-1.1.doc`, `FD_CreateNewFieldDefinitions-1.2.doc`,
`FD_ItemScreenLayout-1.3.doc`, `FD_LocalizationResources1.4.doc`. Read fully 2026-09-30.

### Purpose confirmed exactly from the test-plan index
"The purpose of this test is to prove the system will allow authorized users to maintain captions
and sharenames for fields associated with Items, Lots, Containers, and/or Facilities" — confirming
Field Defs Management's scope spans (at least) four distinct entity types, not just Items the way
its Campaign Manager cross-reference alone might suggest.

### Security: three independent gates
- **`Web_Field_Definitions`** — module-visibility gate. Missing it, the module tile doesn't render
  on the Main Menu at all (same not-rendered, not-just-disabled pattern as elsewhere).
- **`FD_Maintain_FieldDefs`** — edit-ability gate. Present without `Web_Field_Definitions` doesn't
  matter (blocked by the first gate anyway); missing THIS one specifically leaves the module
  open/browsable but the pencil (edit) icon disabled.
- **`LT_<LabelType>`** (the same per-label-type process Label Type Management auto-provisions) —
  gates visibility of that SPECIFIC label type's own field definitions **everywhere in this
  module**: the main `Label Types` dropdown, BOTH dropdowns in the "Create New Field Definitions"
  dialog (as a create-target AND as a copy-source), and the "Item Screen Layout" page's own Label
  Type dropdown. A user missing `LT_LT2` simply never sees `LT2` as an option in any of these three
  surfaces — consistent, comprehensive filtering, not just a partial/one-surface gate.

### Layout and the Fields Definitions grid
`Label Types` dropdown, `Actions` dropdown, `+Add Filter` (standard shared filter widget),
`Advanced Options` dropdown, `Retrieve Data`, `Reset`. Grid columns: `Label Type`, `File/Form`,
`Sharename`, `Default Caption`, `Caption`. A single pencil icon per row (no separate view-only
"paper" icon here, unlike Label Type Management) — disabled without `FD_Maintain_FieldDefs`.

### Edit Record dialog — Sharename is genuinely editable here, not locked
Fields: `File/Form` (read-only display), `Column Name` (read-only display), `Field Type` (read-only
display), **`Caption` (editable textbox)**, **`Sharename` (editable textbox)**, `Sample Data`
(editable textbox), `Drop Down` checkbox, `Read Only` checkbox, `Dictionary Language` dropdown
(alphabetical list of dictionary languages, defaults to blank), `Validate` checkbox, `Translate`
checkbox, Submit/Cancel. **Renaming a field's Sharename through this dialog is a real, available
capability** — worth flagging given how load-bearing sharenames are everywhere else in the app
(BarTender template bindings, MDM schema fields, etc.); changing one here would presumably break
any template/binding that references the old name. Audit: `FieldDefs`/`X_FieldDefs` tables, keyed by
`LabelType` + `CurrentCaption`, with the usual `ChangeType` tracking (`'C'` for an edit).

### Actions dropdown: Create New Field Definitions
**A brand-new Label Type has NO field definitions of its own until explicitly created here** — this
is the actual mechanism. Dialog: `Create Field Definitions for` (target Label Type) + `Use Field
Definitions from` (an EXISTING label type to clone the entire field set from) + Create/Cancel.
Confirmation gate: `"Are you sure you want to create the new field definitions? This action cannot
be undone."` (Yes/No). Success: `"The new field definitions have been created successfully."`, and
the newly-populated Label Type auto-selects in the main `Label Types` dropdown afterward. **Cloning
copies the ENTIRE field-definition set** from the source label type as brand-new rows for the
target — confirmed via `FieldDefs`/`X_FieldDefs`, every copied field showing `ChangeType = 'A'`
(Add), not a shared/linked reference back to the source.

### Actions dropdown: Item Screen Layout (the mechanism behind "moving a field to Unassigned" cited elsewhere)
Per-Label-Type page (own `Label Type` dropdown, defaulting to `"(Default)"`) laying out which Item
Edit fields appear on which tab. Structure: an `Unassigned` tab (a holding area for fields not on
any real tab) plus however many named tabs the client has configured (`Basic`/`Other`/`Text`/`User`
out of the box, but genuinely client-configurable — "the tabs displayed can differ" per the script's
own caveat) plus a `(+)` tab for creating new ones. Grid columns: `Default Caption`, `Current
Caption`, `Sharename`.

- **Creating a new tab**: click the `(+)` tab, click away from it — a new tab appears immediately
  with an inline-editable name (pencil icon next to it) and no fields yet.
- **Assigning a field to a tab**: drag-and-drop the field FROM the `Unassigned` tab's own field list
  ONTO the target tab.
- **Reordering fields within a tab**, and **reordering tabs themselves** (drag one tab in front of
  another): both persist on Save. Confirmed via direct DB inspection: each `FieldDefs` row carries
  its own `TabPosition` (the owning tab's position among all tabs — lower number = earlier/more
  left) and `FormPosition` (the field's own position within that tab, 0-indexed) — dragging a tab
  or a field re-derives and persists both numbers for every affected row, confirmed via
  `X_FieldDefs` showing one change row per affected field.
- **Unassigning a field** (drag it from a real tab back onto `Unassigned`): the field's own
  `FieldDefs.TabName` becomes the literal string `"<Unassigned>"` (angle brackets included, not
  blank/null) — confirmed both live and via `X_FieldDefs`'s own change row.
- **A tab that loses its LAST assigned field is automatically deleted** — dragging a tab's only
  field back to Unassigned removes that tab entirely on Save, with no separate delete step needed.
  A genuinely empty tab (created via `(+)` but never populated) can ALSO be deleted directly via its
  own trash icon — two distinct removal paths depending on whether the tab ever held a field.

### `FD_LocalizationResources1.4.doc` — same outdated-setup-procedure caveat as other modules' equivalents
Confirms the standard `LocalizationResourceDef`/`ResourceType LIKE 'Innovatum.Pages.
FieldDefsManagement.MVC%'` localization-catalog pattern (field names/buttons/column headings all
have their own localization entries), but its own setup procedure (manually building an Excel sheet
of `ResourceType`/`ResourceKey`/`ResourceValue` rows, loading it into a temp table, then a raw
`INSERT INTO LocalizationResources` statement) is the **same category of outdated setup procedure
the user already flagged for MDM/Template Management's own localization scripts** (2026-09-29: "we
don't follow the procedure to import localizations anymore, we have a storedproc for that") — not
independently re-confirmed for this specific script, but treat it with the same caveat rather than
following its setup steps literally; get the current stored procedure name from the user first if
this kind of test is ever actually run.

---

## Lot Management

**Purpose:** Search, add, edit, delete, and Excel-import lot records via the generic "Dynamic
UI" framework (`Innovatum.Pages.DynamicUI.MVC`/`.WCF`, config-driven via
`DynamicUIHeader`/`DynamicUIDetail` tables, "Lots" definition). Two previously-unlinked
ValMaster requirement projects cover it: `20150420-003` (`LM.150420.*` — module-level behavior:
search, Actions dropdown, Add/Edit/Delete/Import, audit trail) and `20160210-001`
(`LM.160210.*` — the Lots grid itself: pencil/page/trash icons, row-level Actions dropdown).

**Formal scripts authored:** `LM_Edit-1.1` (general editing/search/add/delete/import) and
`LM_Security-1.2` (security-process gating), both built twice this engagement — v1 against the
pre-rewrite FRS, v2 (current) against a requirements rewrite that closed most of v1's flagged
gaps. See `.agents/dit-tracker.md` for defects found along the way.

### Security processes
`LE_View_Lots` (module access), `LE_Add_Lots` (Add), `LE_Chg_Lots` (Edit — also determines
whether double-clicking a grid row opens the editable 'Edit Record' window vs. a read-only
'View Record' window), `LE_Del_Lots` (Delete), `EI_Lots` (Excel Import). All five confirmed
current and correctly wired end-to-end (`DynamicUIHeaderDefaultRecords.cs`,
`DynamicUI_LotManagement_Upgrade.sql`, `ProcessesDefaultRecords.cs`, `SecurityDefaultRecords.cs`).

### Confirmed bug: no server-side re-check of Add/Edit/Delete/Import authorization
`LE_Add_Lots`/`LE_Chg_Lots`/`LE_Del_Lots`/`EI_Lots` are checked **only** at page `Load()`
(client-side visibility — grays out icons / hides menu items). `InsertRecord`/`UpdateRecord`/
`DeleteRecord`/`Import` in `DynamicUIService.cs`, and the corresponding `DynamicUIController.cs`
actions (`AddRecord`, `DeleteRecord`, `SubmitExcelImport`), have **no authorization check at
all**. Confirmed two ways to exercise this without any HTTP tooling: (1) the "Excel Import" menu
item is always rendered in the DOM, merely styled `display: none` when `CanExcelImport` is
false (`Views/DynamicUI/DynamicUI.cshtml` line 121) — clear the inline style via DevTools and
it's a fully wired, legitimate click. (2) `DeleteRecord`/`SubmitExcelImport` have no
`[HttpPost]` restriction and no anti-forgery token, so a plain GET pasted into the address bar
(`/DynamicUI/DeleteRecord?id=...&oper=del&sessionId=<pageID>`) executes server-side with zero
tooling — the `pageID` is visible in the loaded page's own hidden form fields. A requirement
(`LM.150420.F.1.12`) was added specifically to close this gap but the code was not changed to
match — see `dit-tracker.md`.

### DynamicUIDetail "Required" field seed mismatch: fresh install vs. upgrade
Fresh-install seed (`DynamicUIDetailDefaultRecords.cs`) marks `Lots.ItemNumber` as
`Required='Y'`, making the "missing required value" import validation
(`LM.150420.F.5.13`/`F.4.3`) reachable. The upgrade script
(`Robar/DB/UpgradeScripts/DynamicUI_LotManagement_Upgrade.sql`) ships every Lots field as
`Required='N'` — an existing installation upgraded via script will never see this validation
fire out of the box. Violates the project's own "seed data must mirror upgrade script" rule
(`CLAUDE.md`). The formal test scripts assume a fresh-install environment (per the QA manager's
call) — if executing against an upgraded environment, confirm a `DynamicUIDetail.Required` flag
is manually set first, or the corresponding scenario will not be reproducible as written.

### Other confirmed-correct details (useful for future scripts/execution)
- Delete confirmation dialog is jqGrid's default English locale (`grid.locale-en.js`): caption
  "Delete", message "Delete selected record(s)?", buttons "Delete"/"Cancel" — not overridden.
- Excel Export invalid-filename message is exactly "File Name is invalid"
  (`Localize_DynamicUI.cs`); blank-filename message is "File Name is required".
- Import "missing Required value" message format: "Row {N} is missing a value for the {Column
  Name} column which is specified as Required" — `N` counts the Excel header row as row 1, so
  the first data row reports as "Row 2", not "Row 1".
- Lots Excel Import Job Detail screen renders "100 %" with a space before the percent sign
  (`DynamicUIExcelImportJobDetail.cshtml`), not "100%".
- Pencil/page/trash icon enable state (`BindingExtenders.js toggleNavGridButtons()`): 0
  selected = all three disabled; 1 selected = all three enabled; 2+ selected = pencil/page
  disabled again, trash stays enabled (supports jqGrid's native bulk delete).
- A deep link carrying `FilterData` in the URL auto-loads the Lots grid
  (`AutoLoadGrid=true`), bypassing the "Retrieve Data" button — real behavior, not documented
  in any Active FRS as of the v2 requirements rewrite. Not scored as its own test step (no
  Active FRS backs it) but worth knowing when interpreting an unexpected auto-populated grid
  during execution.

---

## WebMenu-wide issues (not specific to one module)

- **Session inactivity timeout only resets on literal `mousemove` events**, not clicks or
  keypresses. Root-caused via source + live cookie manipulation:
  `RefreshTimeout()` only fires on `mousemove`; the `InnoSession_PageTimeout` cookie is unchanged
  by click/keydown but extended by exactly 600s on mousemove. In practice this means any
  automation session doing clicks-only (no mouse jiggling) will get logged out roughly every
  8-10 minutes regardless of how recently the user "interacted." Full repro doc:
  `.agents/bug-repro-session-timeout.md`.
- Native `<select>` dropdowns in this app frequently don't respond reliably to simulated
  `.click()` on rendered `<option>` elements — use keyboard (Down/Return) navigation, or a
  properly-dispatched `change` event on a value set directly, instead.
- iframe IDs (`tabs-N_frame`) are assigned by tab-open order, not by which tab is active — don't
  assume `tabs-1_frame` is always the module you expect; check `document.querySelectorAll('iframe')`
  ids directly.
- **jQuery UI Dialog's buttonpane (Submit/Cancel/etc.) is a SIBLING of the dialog's own content
  div, never a descendant** — confirmed via `outerHTML` dump (2026-09-29, Campaign Manager's
  Approve Item dialog, `#approveItemDialog`): that div's own HTML contains only the signature
  fieldset, no buttons at all. `.dialog()` wraps whatever content div you pass it inside a
  `.ui-dialog` container as `.ui-dialog-titlebar` + (your content div) + `.ui-dialog-buttonpane`,
  all as siblings. **A locator scoped to the content div's own id/selector can therefore never
  find its own Submit/Cancel buttons** — search unscoped at the page/frame level instead
  (`.ui-dialog-buttonpane button:has-text("Submit")`), or walk up to the closest `.ui-dialog`
  ancestor first. This is why `Create_Approved_Item.spec.ts`'s original pattern searches
  `.ui-dialog-buttonpane` unscoped rather than scoping under `#approveItemDialog` — that was
  correct by construction, not an oversight; re-scoping it under the content div (as a later
  "cleanup" did) breaks it. Applies to every `.ui-dialog`-based modal in the app, not just Approve
  Item.

- **The shared `Innovatum.FilterSet`/CriteriaFilter grid widget's Approved-scope dropdown and
  Latest/Effective-Only checkboxes are a SEPARATE, easy-to-miss layer of filtering, distinct from
  the Column/Operator/Value filter row(s)** — confirmed via source
  (`Innovatum.DataManagement.Web/Scripts/innovatum/FilterSet.js` is the canonical shared
  implementation; used across Template Management, Campaign Manager, MDM, Workflow Management,
  etc., not one module's own code). The approval-scope control is a `<select>`, NOT a checkbox/
  radio — a DOM query for `input[type=checkbox], input[type=radio]` looking for it will find
  nothing and miss it entirely (confirmed the hard way, 2026-09-30). Exact selectors differ per
  module's own markup (verify per module, don't assume one universal id):
  - **Template Management**: `#drpApprove` (Knockout-bound to an object array via
    `optionsText: 'text'`, no `optionsValue` — select by the rendered label text, e.g. `"Approved
    and Unapproved"` for the neutral/no-filter option, not a raw `value` attribute), plus
    `#chkLatestVersion`/`#chkEffectiveOnly` checkboxes.
  - **Campaign Manager** (main grid, `Index.aspx`): `#drpApproved`, a plain select with real
    option values `"both"` (neutral)/`"true"` (approved only)/`"false"` (unapproved only), plus
    `#chkLatest` (defaults CHECKED) and `#chkEffective` (defaults unchecked) checkboxes.
  - **Critical operational context**: the standing test account (MBUser1) is the SAME account the
    user uses for their own manual testing — its filter/scope state is NOT guaranteed clean
    between sessions. A real incident (2026-09-30): after creating and approving a brand-new
    Template Management template (`MBCombo48666`) via the full native BarTender/Sentinel flow with
    zero errors at any step, a grid re-query for it came back "No records to view" — and so did a
    sanity-check query for `A1SuperTemplate`, a template already confirmed to exist and to have
    been found successfully earlier in the very same session. The cause was never a real failure:
    `#drpApprove` had been left on "Unapproved Only" by a separate manual-testing session using the
    same account, silently excluding every approved record regardless of how correct the Column/
    Operator/Value row was. Considerable time was spent chasing this as a suspected real bug
    (stale filter rows, label-type security, a broken retrieve mechanism) before the user
    identified the actual cause directly. **Before trusting any "no records"/empty-grid result as
    meaningful, explicitly set the approval-scope control to its neutral/"all" value and both
    Latest/Effective checkboxes to a known state for the query's actual purpose — don't just
    manage the Column/Operator/Value filter row(s) and assume that's the whole picture.**

## Known testing-tooling limitations (not product issues — noted so they aren't re-litigated)

- The Claude-in-Chrome `find`/`read_page` accessibility-tree tools do not descend into this app's
  same-origin nested iframes, so `file_upload` (which needs an element ref from those tools)
  cannot target file inputs inside module content. Any testing that requires an actual file
  upload needs a different approach or manual verification.
- **Two confirmed bugs in Campaign Manager's grid "Retrieve Items" / "Do Action" path** (found
  2026-09-04 while automating Mass Item Approve; both affect every one of the 11 "Select Action"
  bulk actions, since all of them require this same grid-select step). Both are worked around in
  `ROBAR_Tests/tests/support/campaign-manager.js`, which is the reference implementation
  for driving this flow going forward:
  1. **The grid frame auto-replays the account's last-used search filter on load, silently
     racing any immediate interaction.** Landing on the Campaign Manager grid (e.g. via the
     item-edit page's "← Campaign Manager" breadcrumb) fires an automatic `GetData` request using
     whatever filter criteria that account last searched with — before the user (or automation)
     touches anything. If a new filter is set up and "Retrieve Items" is clicked while that
     automatic request is still in flight, the click silently no-ops (no new request fires) and
     the stale automatic response is left showing — which looks exactly like "Retrieve Items
     returned the wrong item" but is really "Retrieve Items never actually ran." Fix: wait for
     that automatic `GetData` to fully resolve before touching the filter UI at all.
  2. **`RetrieveItems()`'s `GetUserEnvRecordsPerPage` AJAX call is fire-and-forget and its
     `complete` callback stores the raw jqXHR object (not the parsed response) into the hidden
     `#RecordsPerPage` field**, corrupting it to the literal string `"[object Object]"`. Since
     that call isn't awaited before the grid re-renders, its completion can land at any point —
     including *after* a workaround has already patched `#RecordsPerPage` back to a valid number —
     silently re-corrupting it before "Do Action" is clicked. Symptom: Do Action fails server-side
     model binding with `"The value '[object Object]' is not valid for RecordsPerPage."` A
     JS-level property-setter override on the element did **not** reliably fix this either (the
     app's real, native form submission appears to read the underlying value independent of a
     JS-shadowed accessor). The fix that actually held up under repeated testing: explicitly wait
     for that specific AJAX call to fully resolve after every Retrieve Items click (not just the
     grid's own `GetData` response), THEN do one plain, final fix — never patch-and-hope while a
     call from that endpoint could still be in flight.
  3. **The grid auto-restores the account's last-used filter row on load, VALUE included.**
     Landing on the Campaign Manager grid already has a filter row present (from whatever the
     account last searched for, in the current session or a previous one) — blindly clicking
     "Add Filter" adds a SECOND row instead of replacing it, turning the query into an impossible
     "old item AND new item" that can never match, which looks exactly like "Retrieve Items
     returned nothing" or "returned the wrong item." Fix: check for an existing filter row first
     and reuse it (index 0) rather than always adding a new one.
  4. **Playwright's `trace: 'retain-on-failure'` is not just overhead against this app — it
     changes real behavior.** With tracing on, the grid's Retrieve Items flow reliably got stuck
     on "Loading..." forever (even across 5 retries with generous timeouts) for a test that
     otherwise passes in ~30s with tracing off. Root cause unconfirmed, but the CDP-level
     instrumentation appears to perturb this legacy jQuery app's own timing-sensitive JS enough to
     break it. Keep tracing off for this suite by default; re-enable per-run via `--trace=on` only
     when actively debugging a specific failure, not as a standing config.
- **ASP.NET AJAX `UpdatePanel` pages + this site's CSP nonce policy don't cooperate in headless
  Playwright Chromium** (found 2026-09-09 on Print by Lot's Lot Panel, see that module's own
  section above for the product-behavior context). The page's Microsoft Ajax client framework
  fails to bootstrap (`Sys is not defined` console errors) because CSP blocks whatever
  inline/dynamic script it needs, and every affected click also logs an explicit `Executing
  inline event handler violates...CSP` violation. Symptoms: a button click that should navigate
  to a new screen instead gets a real `200 OK` POST back but re-renders the *same* screen with no
  visible change; a checkbox that triggers a partial postback can vanish from the DOM by its `id`
  afterward even though other, unrelated field state on the same page reads back correctly and
  consistently. **Confirmed NOT a real product defect** — the identical action (advancing past
  the Lot Panel to complete a print) worked cleanly in a real Chrome browser. Treat any
  UpdatePanel-driven partial-postback interaction on this app as suspect in headless Playwright
  specifically; if a step only needs to reach a screen and read a specific field/attribute, the
  DOM read is still reliable even when an unrelated cosmetic side effect looks broken — but if a
  step needs to *complete* an action gated behind such a transition, either drive that one action
  via the interactive/real browser or ask the user to do it in their own browser and hand back an
  identifier (e.g. a lot number) to resume automation with. A synthetic
  `el.dispatchEvent(new MouseEvent('click', {bubbles:true, cancelable:true}))` via
  `frame.evaluate()` is a more robust alternative to Playwright's native `.click()` for an element
  whose layout shifts unpredictably right after a preceding postback-triggering action (native
  `.click({force:true})` failed with "Element is outside of the viewport" in exactly this
  situation; the dispatched event bypasses that actionability check entirely).
- **Playwright's `headless: true` can silently launch a Chromium build with no real OS window at
  all**, which breaks any test driving a native desktop app via UI Automation (FlaUI) — found
  2026-09-11 while building Template Management's BarTender-launching tests. Recent Playwright
  versions launch a separate, dedicated "headless shell" binary (a stripped browser build with no
  windowing support, under `ms-playwright/chromium_headless_shell-*`) for `headless: true` instead
  of running the full browser headlessly like older versions did — `ms-playwright/chromium-*` (the
  real, windowed build) only gets used in headed mode. Confirmed live: a FlaUI process-title lookup
  came back with zero matches every single time under `headless: true`, and the same test found the
  window immediately once `test.use({ headless: false })` was added. **Any test that drives a
  native desktop app via `scripts/flaui_bridge.js` must set `headless: false`** regardless of the
  project's default config — there is no way to make this work headless.
- **FlaUI's `click`/`clickAt` (`scripts/flaui_bridge.js` → `FlaUIAutomation.exe`) report success
  the instant they dispatch a synthetic input, with NO verification the target actually received
  or acted on it** — confirmed by reading `Program.cs` directly (`CmdClick`/`CmdClickAt` call
  `control.Click()` / `Mouse.Click()` and immediately `WriteJson({..., clicked: true})`, no
  read-back). In practice this makes some clicks (e.g. the "Open SentinelLauncher?" native Chrome
  prompt) genuinely flaky in a way that's invisible to error-based retry logic — a "successful"
  attempt sometimes does nothing at all, silently, and a naive retry-on-error loop never notices.
  **Always verify the actual effect** (dump-tree to confirm a dialog is gone, list-processes to
  confirm a process spawned/exited) rather than trusting a reported success — see
  `ROBAR_Tests/tests/support/bartender.ts`'s `confirmSentinelLaunchPrompt` and
  `closeTemplateEditor` for the corrected pattern (retry the click AND re-check the
  real state after each attempt, not just once at the end).
- **A desktop app closing after a `Close Tab`-style click can take several real seconds**, and
  since the click itself doesn't confirm anything (see above), a test that moves on immediately can
  race a window that's still visibly closing. Confirmed by observation (Mason watching the screen)
  during Template Management test development — fix is to poll `list-processes` for the specific
  pid to actually disappear before continuing, not just wait a fixed short timeout.
- **Exploring a new browser-only flow live via `mcp__playwright__*` tools, before writing any
  FlaUI-dependent Playwright test code, is dramatically faster than trial-and-error against a
  human's terminal.** Confirmed 2026-09-11 building Template Management tests: a session logged
  into the WebMenu directly via `browser_navigate`/`browser_snapshot`/`browser_click`, confirmed the
  exact row-action dropdown structure, dialog field ids, and bulk-action page layout in a couple of
  minutes — no native-window/session-isolation issues at all, since this is pure CDP browser
  automation, not FlaUI. Only genuinely BarTender/desktop-app-driving steps need a human to run
  them and report back logs; anything that's just browser DOM interaction can and should be
  explored this way first.
- **`mcp__playwright__browser_file_upload` refuses any path outside a small allowed-roots list**
  (the current session's working directory and its `.playwright-mcp` subfolder) — confirmed live
  2026-09-14 exploring Replace Template: a real network-share `.btw` path (the same one Playwright
  test code uploads successfully via `setInputFiles`, which has no such restriction) was rejected
  with "File access denied ... outside allowed roots." This is specific to the MCP tool's own file
  chooser sandbox, not a product or Playwright-test limitation — work around it during live
  exploration by copying a small representative file into the working directory first (and deleting
  it again afterward), then write the real test using `frame.setInputFiles()`/`fileInput
  .setInputFiles()` with the real path, which is unaffected.
- **A Security Management group-permission change's propagation to an already-running IIS worker
  process is inconsistent** — sometimes a change takes effect on the next page load with no
  restart needed, sometimes it doesn't show up until a ServiceHost restart + IIS reset happens.
  Don't assume either way; re-verify the actual current state in the Security Management UI (or a
  fresh script run) after any such change before trusting it took effect, especially right after
  asking the user to make a related SQL change that also triggers a restart for unrelated reasons.
