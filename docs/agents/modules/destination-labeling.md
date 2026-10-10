<!-- Split from robar-module-reference.md on 2026-10-09 (lossless, original order kept; later blocks are newer and win over earlier ones). Module file: destination-labeling -->

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

## Destination Labeling - requirements-first, Playwright-confirmed 2026-10-08 (TST703; `tests/Destination-Labeling/Destination_Labeling.spec.ts`, `_Security.spec.ts` headless, `_Scan.spec.ts` HEADED; 3/3 each)

- **Source of truth:** ValMaster requirements (module "Destination Labeling", Customer Specific blank; 215 rows) saved in `.agents/valmaster-destination-labeling.md` (+ the separate ValMaster module "Destination Labeling - Barcode Parse Stored Procedure", 16 rows, read live). Deviations are recorded as test annotations `deviation <req id>` (not failures) and in the DIT tracker.
- **Page:** `InnoPages/DestLabeling/DestLabeling?ConfigName=DestLabeling`, tile "Destination Labeling" (process **`BP_DestinationLabeling`**; the requirement F.1.1 says `BP_DestLabeling`). Ids: `#orderNumberInput`, `#orderStatusText` (disabled), `#submitOrderNumberButton` (Next), `#createOrderButton`, `#requireVerification` (checked by default on TST703), after an order: `#destSelect` ("Please select a Destination" + the ACTIVE destinations: Germany, Spain, France, Italy; choosing one shows "Languages: DE"), `#barcodeEntry`, `#changeCopiesCheckbox` (Print Multiple Copies), `#autoPrintLabel` (checked), `#autoPrintDoc`, `#btnReset`, `#btnScanHistory`, `#btnCurrentScan`; Print All / Reset All / Details only for an order with worklist rows.
- **Order mechanics (matches):** unknown order -> "No worklist elements found for the entered order number. OrderNumber: <n>" + Continue (F.2.4); Create Order with a blank number -> `ccyymmdd-NNNN` (F.5.9), number locked afterwards (F.2.1), Reset returns to the empty panel with Next / Create Order (F.31.1). Orders (PICKHEADER rows) cannot be deleted from the UI: the specs create one auto-numbered order per run plus the fixed `MBDLORDER1`.
- **Security (matches F.1.1 / F.5.2 / F.19.1 / F.23.1):** without `BP_DestinationLabeling` no tile; with it the page opens but Create Order (`BP_Dest_CreateOrder`) and Require Verification (`BP_Dest_RequireVerification`) are NOT displayed; Print Multiple Copies (`BP_Dest_PrintMultipleCopies`) appears once an order + destination are chosen. Print All (`BP_Dest_PrintAll`) / Reset All (`BP_Dest_EditWorklist`) not testable (no worklist rows).
- **Scanning needs the Sentinel client (HEADED):** headless the scan ends with "Timeout waiting for response from Sentinel. Waited 10 seconds."; the native prompt is confirmed with FlaUI like the print screens. Raw GS1 without separators ("0100012345600012" + "10LOT1") is parsed; the parenthesized human-readable form "(01)...(10)..." and free text give "Unable to recognize GS1 data identifier. The accepted GS1 data identifiers are GTIN(01), Expiration(17), Lot(10), and SerialNumber(21)". A GTIN only -> Barcode Scan dialog: Fields Found (GTIN 00012345600012), Fields Required (LotNumber with the value box `#manualEntry0`), Reset, and the Current Scan button appears; entering the lot completes the scan -> "No print rows found for given barcode" + Continue (no printable item exists for the test GTIN).
- **Deviations from the requirements (live):** F.5.5 / F.1.4 (existing order -> unlocalized "Localizable Exception thrown with ResourceType: Innovatum.InnoUserException.Err_DestLabeling and ResourceKey: Order_Already_Exists"); F.10.9 (message omits Manufactured(11)); F.10.7 (the dialog's extra Barcode Scan field `#secondBarcodeEntry` is hidden); F.10.11 (the Barcode Scan dialog stays open under the "No print rows" message). F.22.10 (Print All continues after an error) contradicts the old DL_PrintAll script (halts): the requirement wins, not testable yet.
- **Not covered (needs data / settings from the user):** worklist grid, Ordered / Packed / Status, Print All, Show Done, -1, Reset All, Order Status text, background colors (IdleScreenColor etc.), Scans Remaining, Shipping Info, Details dialog, Session History content, print history (`DEST_` print ids), printing hierarchy (Codes DLP_Label / DLP_Doc, Printer Control), auto print, serialization, verification codes, DestLabeling sharenames, Global Settings error messages (F.7.10-12, F.23.14, F.26.4), licensing. See the data requests in `settings-change-requests.md`.


