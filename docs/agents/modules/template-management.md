<!-- Split from robar-module-reference.md on 2026-10-09 (lossless, original order kept; later blocks are newer and win over earlier ones). Module file: template-management -->

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

