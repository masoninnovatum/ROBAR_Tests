<!-- Split from robar-module-reference.md on 2026-10-09 (lossless, original order kept; later blocks are newer and win over earlier ones). Module file: campaign-manager -->

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

### Campaign Manager Job Inquiry vs ValMaster (modules "Job Inquiry" / "Print History Inquiry", FRS.RBR.CM.107.*, FRS-15.1.*, SER2015...) — 2026-10-09 (`Job_Inquiry_Requirements.spec.ts`, headless, read-only)
- **Deviation CM.107.8:** no visible link from the Campaign Manager page to Job Inquiry (page only reachable by URL `/innovatum/CampaignManager/JobInquiry`; known since 2026-09-29, now tied to the requirement "User will be allowed to access the Job Inquiry page from the Campaign Manager page"). **CM.107.1** "Do Action" grayed out until an action is chosen: the button exists and is disabled initially (OK).
- **CM.107.10 wording:** the criteria list is Display ID, Description, Submitting User, Status, **Date Inserted** (req: Date Started), Date Completed, **% Complete** (req: Percent Complete), Action ID, **Item Number** (req: Single Item) - same nine criteria, different captions.
- **Print History Inquiry (FRS-15.1.x)** is written for the legacy screen (radio buttons, "Select Action" + "Do Action", Reset All, See Image / See Detail / Exact Reprint / Regenerate actions); the Dynamic UI page returns HTTP 500 on TST703 so none of it could be verified; not testable until the DB check is done.

