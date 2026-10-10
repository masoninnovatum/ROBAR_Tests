<!-- Split from robar-module-reference.md on 2026-10-09 (lossless, original order kept; later blocks are newer and win over earlier ones). Module file: printing -->

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

**Persistent-profile result (2026-10-07):** tried `launchPersistentContext` with Playwright's Chrome for Testing AND the installed Chrome (`channel: 'chrome'`): the "Open SentinelLauncher?" bubble has only "Open SentinelLauncher" and "Cancel" - there is NO "Always allow" checkbox in automation (probably because the origin is plain http / the browser is automation-controlled), so a persistent profile cannot remember the choice and the prompt still appears every run. The user decided to keep confirming it with FlaUI (`confirmSentinelLaunchPrompt`) and skip the profile idea. The `AutoLaunchProtocolsFromOrigins` Chrome policy (HKCU/HKLM `Software\Policies\Google\Chrome`) was proposed but not applied (needs the user's OK; may be ignored on an unmanaged PC). Also: Chrome only launches `sentinel:` after a USER ACTIVATION, so click Print with a real Playwright click (see Print by Lot).

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

### Multi Document Printing (Playwright spike 2026-10-05, Claude01; `Innovatum.Pages.MultiDocument.Printing.MVC`)
- **Different from Print by Order**: a Knockout MVC page (`InnoPages/MultiDocPrinting/MultiDocumentPrinting?ConfigName=MultiDocPrint`), NOT the legacy WebForms `PrintScreen.aspx`; gated by role `BP_MultiDocumentPrint`. Opening the tile in a HEADED run shows the native "Open SentinelLauncher?" prompt (confirm with `bartender.resolveBrowserPid` + `confirmSentinelLaunchPrompt`); headless leaves the iframe blank. The tile is `getByRole('button', { name: /multi doc/i })` (tile list also has Print Reconciliation, Single Piece Flow Printing, Service and Repair Print, Flex Printing, Server Printing, DX Printing, Print Prep Testing).
- **Entry panel**: Order Number / Lot Number / Item Number (`input[name="FlexLot_OrderNum|FlexLot_LotNum|FlexLot_ItemNumber"]`, Tab after item), Next, Reset. Next (a plain Playwright click works here) shows on ONE screen the **Lot Panel** (Override Lot Data checkbox; Lot, Order, Expires, Manufactured, Reassay date pickers, U1, Batch Qty, U3-U5; a brand-new lot is shown with defaults, Expires = Manufactured + 1 day for MI080301, and is not created until print) and the **Labeling grid**: ONE ROW PER PRINTER of the print entity (Zebra 220XiIII 203 dpi, Zebra 110Xi4 300 dpi, SATO CL6NX Plus, Microsoft XPS Document Writer, **Microsoft Print to PDF**) with columns Select (row checkbox), Action dropdown (View Preview / View Master / View Compare + `►` go button), Label Type (`Select a label type` / `Carton Label`), Template, LCN, Copies (`copiesField<n>`, default 1), Status, Printers. Each row prints its own label type to its own printer = "multi document". Choosing Carton Label fills Template `A1TemplateMT` + `LCN0000324` (tooltip "LCN: LCN0000324, IVer: 0, MDVer: , TName: A1TemplateMT, TVers: 0") and enables Print / Edit Prompt Data. Footer: "ROBAR Print Screen / <user> / 7.0.3.20198".
- **Test checkbox** (`#testPrintCheckbox`): turns the Print button into a red **Test Print** button (`getByRole('button', {name:/Test Print/})`; normal one is `#btnPrintID`, text "Print").
- **View Preview** renders the real label image in a dialog (shows the item, "Item Version: 0", and the typed lot); **View Master** and **View Compare** answer "No Label Master Found" when the item has no label master.
- **Printing mechanics**: Print -> `GetPrintId`, `GetPrintClickedId` (returns a long Token), `ProcessPrintRow` ({"PrintStatus":"waiting"}), `CreateTerminationRecord`, then the page polls `GetPrinterStatus` until PrintStatus `success` (requested->waiting, failed->error, printed/testprinted->success, anything else error). **A SECOND "Open SentinelLauncher?" prompt appears at Print** (the token is handed to the Sentinel client): without confirming it the row ends with a red X; with `confirmSentinelLaunchPrompt` after the click the row shows success for both Test Print and a real Print to Microsoft Print to PDF (hard rule: only that printer). The produced PDF's location was NOT found (nothing in Documents/Desktop/Downloads/Temp).
- **How to verify a print (works):** InnoView (tile "InnoView") > category "Print History" > **View Print History** (also "...With Failed", "...Reprints"): `Innovatum/innoview/Screens/ViewReport.aspx?ReportName=View Print History`; prompts UserID (select), Template, Item, Order, Lot, Print Entity, Workstation (select), Print Date Start/Finish; Submit/Export. Lists REAL prints only (Test Prints never appear) with User ID, Work Station (the machine running the browser, here MASON-LAPTOP), Time Zone, Full Name, Item Number, IVersion, Label Name (template), LVersion, Order Num, Lot, **Print Entity (ROBAR = the default entity, even though Claude01 holds `*`)**, Mfg/Exp/Rea dates, Lu1-5, Qty, Printer, Serial Num, Copies, Printid, Reprint, Batchqty, Print Date. Helper `tests/support/print-history.ts` `viewPrintHistory(page, {lot, item, order, user, ...})`; used by the Multi Document Printing spec (exactly one row per real print).
- **Print History Inquiry** (DynamicUI `PrintHistory`, gate process `PrintHist_Login`, forced filter `SP_PrintHistoryForcedFilter`, view `v_PrintHistory`; filter columns PrintEntity, OrderNum, Lot, ItemNumber, LabelType, UserID, ExpDate, MfgDate, BatchQty, Copies, SerialNum, Printer, PrintDate, PrintStatus, PrintTime, ... LCN, iVersion, PrintID, FileName) returned **HTTP 500 "Runtime Error" on `DynamicUI/GridSessionGetPage`** for Claude01 even with no filter (Retrieve stays disabled, spinner forever); **the same 500 for a second account (MB fixture MBPWLogin01 in a group with only Login_WebMenu + PrintHist_Login)**, and after Claude01 got the `*` Print Entity, so it is server/DB side (not the account, not the missing entity); not checked on VAL703. Use the InnoView report above instead (see DIT tracker).
- Gotcha: `openDynamicUi()` calls `login()`; after a login use `reopenDynamicUi`.
- **Override Lot Data (Playwright-confirmed 2026-10-06, `Multi_Document_Printing_Override_Lot.spec.ts`, headed, 3/3 + 1 earlier green, 1.4 min):** checkbox `#overrideLotCheckBox` (process `Override_Lot_At_Print`), Save `.save-button` / Cancel `.cancel-button` appear only while it is ticked. The date inputs (`input.mdp-input-date`: Expires, Manufactured, Reassay) are ALWAYS `readonly` (jQuery UI datepicker driven) - the real switch is `disabled`: for item MI080301 Expires stays disabled even with the override (calculated), **Manufactured is already enabled BEFORE the override** (permission `BP_AllowMfgChangeAtPrint` via `hasPermissionToChangeMgfDate`), Reassay becomes enabled after ticking; Lot/Order stay read-only. Set a date from a script with `jQuery(el).datepicker('setDate', new Date(v)); jQuery(el).trigger('change')`. Validation: Manufactured after Expires -> dialog "Please select an Expiration Date that is greater than or equal to the Manufactured Date". A valid Save recalculates Expires (= Manufactured + 1 day), unticks the checkbox and closes the buttons; Cancel throws a pending edit away. The real print writes the overridden dates to the print history (Mfg 1/1/2026, Exp 1/2/2026, Rea 12/31/2030). Lots used: `MBMDPV<stamp>` (cannot be deleted).
- **View Master / View Compare WITH a label master (Playwright-confirmed 2026-10-06, `Multi_Document_Printing_Label_Master.spec.ts`, headed, 3 green, 1.3 min; fixture helper `tests/support/label-master-item.ts` creates item `MBMDPM3213026` / LCN0000555 on A1SuperTemplate + Carton Label via Campaign Manager approve, Label Control Assign Control Number and Bulk Actions > Recreate Master, stores it in `test-data/label-master-item.json` and reuses it):** both Action items open a NEW BROWSER TAB, not a dialog. View Master = `InnoPages/MultiDocPrinting/GetItemLabelMasterPdf?itemNumber=..&labelType=..&versionNumber=0&labelName=<template>&templateVersion=0&masterDataVersion=` (the saved master PDF; empty page text). View Compare = `InnoPages/MultiDocPrinting/FileComparer?ImageUrl=<http://server/Innovatum/PrintedImages/<yyyymm>/PID_<32 hex>.JPG>&itemLabelMasterUrl=<the master url>&AutoAlign=Y&ViewMode=Horizontal`, title "File Comparer" (the live label is rendered to a JPG first, then compared with the master). Without a master both show the "No Label Master Found" dialog instead. NOTE: the existing `Multi_Document_Printing.spec.ts` item MI080301 must stay WITHOUT a master (it asserts "No Label Master Found") - never run Recreate Master on it.
- **Template prompts / Edit Prompt Data (Playwright-confirmed 2026-10-06, `Multi_Document_Printing_Prompts.spec.ts`, headed, 3/3, 1.5 min, Test Prints only so no lot / history):** templates with prompts found on TST703 by Template Management > Template Name contains "prompt": `SIMPLEPROMPTS` (Carton Label, APPROVED, one prompt "What is your hair color?" - the one used), `MBPrompt01` and `TMRPromptTest` (Carton Label, unapproved), `HV_PromptTemp` (HV Label Type), `DXPromptTest` (DXLabels, approved), `Prompt_Language_Test` (Miscellaneous), `Prompt_Language_Test_2` (OT1). Fixture item `MBMDPP4277583` (LCN0000556, SIMPLEPROMPTS) built by `support/label-master-item.ts` with `{template:'SIMPLEPROMPTS', store:'prompts-item.json', master:false}`. Behaviour: with no answer the **Edit Prompt Data** button is disabled with tooltip "No Prompt Data Specified"; clicking Print / Test Print opens a "Print Time Prompts" dialog (Label Type: Carton Label + the question + `input`, `#btnSavePrompts`, `#btnPromptCancel`); **Save stays disabled while the answer is empty** and only reacts to key events (use `pressSequentially`, `fill()` is not enough); Cancel asks "Unsaved changes will be lost. Would you like to Continue?" (Continue / Cancel) and prints nothing; after Save the print proceeds (Sentinel prompt, status success); afterwards Edit Prompt Data is enabled, re-opens the dialog with the stored answer, a changed answer is kept, and the next print does NOT ask again (answers are stored per row for the page session).

### Add Lot Reason Required (PrintConfig-driven, `ConfigName=LotNumber`/`MultiDocPrint`/etc., `ParamName=AddLotReasonRequired`)
When `Y`, entering a brand-new lot number on Print by Lot (or the equivalent field on other
print flows) triggers: `"You are about to add a new lot record, please select a Reason Code in
order to proceed."` — Reason Code dropdown (required, `"This field is required."` if skipped) +
optional Comment. Confirmed working exactly as documented; toggled live via **Print Config
Management** (no IISRESET needed for this particular setting, unlike several others in this
module).


### Print by Lot, PrintEntityRequired = N (Playwright-confirmed 2026-10-07, `Browser-Printing/Print_By_Lot.spec.ts`, HEADED, 3/3, 1.9 min)
- **Flow** (`PrintScreen.aspx?ConfigName=LotNumber`): only `Lot Number` first (NO Print Entity dropdown while the setting is N) -> Next -> unknown lot = "No lot found." + Item Number / Shop Order Number fields -> Next -> Lot Panel (Override Lot Data checkbox `deLot_chbLotOverride`; new lot, Manufactured editable, Expires = Manufactured + 1 day, Lot/Order/Expires/Reassay disabled; "Allow Label Control Selection" checkbox) -> Next (a Sentinel prompt for GetPrinters) -> label screen: label type radio (Carton Label), Label Control dropdown (`LCN:LCN0000324 - IVersion:0 - MDVersion:N/A - TName:A1TemplateMT - TVersion:0`), Batch Qty, Copy 1, Printers dropdown (defaults to the last used), `chbReprint`, `chbTestPrint`, action dropdown (View Master / View Preview / View Compare) + View, `btnDoPrint`, Reset, the PrintID (`PID_...`) shown at the bottom. Ids: `ctl00_printContentHolder_posPrintOptions_*`, `..._deLot_*`, `..._customControl_txtLotNumber|txtItemNumber|txtOrder`, Next `ctl00_btnNext` (nativeClick works for Next).
- **THE PRINT BUTTON NEEDS A REAL CLICK.** `nativeClick`/`frame.evaluate(el.click())` on `btnDoPrint` is a script-dispatched click without user activation: Chrome silently blocks the `sentinel:` protocol launch (no "Open SentinelLauncher?" prompt, no launcher), the server waits about 15 s and the page shows "Timeout waiting for Sentinel." with PrintStatus **Failed**. A normal Playwright `.click()` on the button launches Sentinel (prompt at about +2 s, confirm with FlaUI), the launcher logs `PrintClickedID / Status: Printed` and the page shows a dialog "...Printed PID_<id>.prn to Microsoft Print to PDF" + Ok. (This was the cause of the status staying `FileCreated` / `Failed` in the first runs; applies to every legacy PrintScreen module.) The launcher log is `C:\Innovatum\SentinelClient\SentinelLauncher\Logs\AppLog_<yyyymmdd>.log` (PRINTPRNQUEUE = a print job; "The operation has timed out" after 100 s = the launcher never got a job).
- The real print is in InnoView > View Print History (Print Entity `ROBAR`, PDF printer, 1 copy); the "With Failed" report also lists `FileCreated` / `Failed` rows.
- **[SUPERSEDED 2026-10-09: Test Print completes with the headed real-click flow, see the Test Print block near the end of this file]** **Test Print (checkbox `chbTestPrint`) did NOT complete under automation** (launcher started, PRINTPRNQUEUE, no job for 100 s, page shows no result) - not understood yet; MDP Test Print works.

- **Empty Printers dropdown on a print screen (VAL703, 2026-10-07):** the Print by Lot label screen showed an EMPTY `drpPrinters` (the Sentinel client's GetPrinters launcher ran but no printers appeared, waited 60 s) because **Printer Control had no `*` record** (user created it: Printer Control Maintenance, DynamicUI `Definition=PrinterControl`, single row `* * * * N None`); after that the list showed Zebra 220XiIII Plus, Zebra 110Xi4, Microsoft XPS Document Writer, Microsoft Print to PDF. Other causes the user named: PrintConfig `LhsPrintingEnabled` enabled (it should ALWAYS be disabled) and `ClientPrintMethod` = ActiveX (neither applied this time). Items with several label types (e.g. VAL703 `MI042801`: Carton Label + MBLabelType1) show label-type radios first; the Label Control / printer block appears after one is chosen (`PrintByLot.toLabelScreen(..., labelType)`).

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

**Playwright-confirmed 2026-10-05 (`tests/Print-Entity/User_Print_Entity_Management.spec.ts`, MB fixture users MBUser11/MBUser12, cleaned up at the end; source `Innovatum.Pages.PrintEntity.MVC`):**
- Tile "User Print Entity Management" -> `InnoPages/PrintEntity/UserManagement?LinkedFromWebmenu=1`; standard CriteriaFilter grid (columns/filter names `UserId, FullName, SecurityGroup, Enabled, Facility, PrintEntity`; `In` is comma separated). Print Entity column: blank = none assigned, `*` = All. 93 users on TST703. **A stale blank second filter row persisted per user makes Retrieve do nothing ("Filter Required")** -- click `#btnReset` first. Row checkboxes `jqg_grdJqGrid_<UserId>`; Bulk Actions `#drpActions` has ONE item, "User Print Entity Update"; with nothing ticked -> dialog "Please select record(s)" (Continue).
- Update page `UserPrintEntityUpdate?userIdSession=<guid>` ("Records Selected:N", Filter `#drpAssignedUsers` Any (Print Entity) / With Assigned Users / With Unassigned Users -- **the dropdown is remembered between visits, set it explicitly and Retrieve**, otherwise the grid is filtered and the update starts empty), entity rows `*` (All), ROBAR (Default value), England, Mars (inactive), MLAUser1, Vendors, 1240 (Germany, inactive), `#btnUpdate` (disabled until a box changes: `data-bind disable: isLoading() || !isDirty()`). The row's textContent starts with a hidden numeric key cell ("1ROBARDefault valueYes") -- match rows by regex `^\s*\d*\s*NAME`. Update -> text "Update successful." (the form stays visible in the spike runs); the grid then shows the assigned entity names.
- Tri-state proven: ROBAR assigned to both selected users = on, England on ONE of the two = `indeterminate`; "With Unassigned Users" lists the entities not held by every selected user (ROBAR drops out, England stays). `*` checked -> every named entity becomes unchecked + DISABLED; unchecking `*` re-enables them. Leaving with unsaved edits (click the "User Print Entity Management" link) -> "Changes will not be saved. Would you like to proceed?" Yes/No (No stays with the change, Yes goes back). Removing everything = tick all assigned boxes off (a mixed box needs check then uncheck).
- **Why it matters**: `SP_PrintHistoryForcedFilter` (the Print History Inquiry forced filter): `PrintEntityRequired=N` -> only `[PrintStatus] = 'Printed'`; `Y` and the user has NO `UserPrintEntity` rows -> filter `1 = 2` (no rows, NOT an error); `*` -> `PrintStatus = 'Printed'`; otherwise `PrintStatus='Printed' AND PrintEntity IN (<user's entities>)`. So **TEST prints (PrintStatus TestPrinted) never appear in Print History**. A new test user (Claude01) starts with no entities: Print by Order / Multi Document Printing only offer the entity dropdown values the user holds, Lot Management shows nothing. Claude01 was given `*` (same as MBUser1) on 2026-10-05 at the user's request. Claude01 still gets HTTP 500 from Print History Inquiry afterwards (see DIT tracker) so that 500 is not caused by the missing entity.

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

**CORRECTION 2026-10-07 (UAT_6356 re-run on VAL703, EditMode change made effective with a ServiceHost restart + IIS reset): the EditMode resource DOES have an effect.** The earlier TST703 conclusion ("no independent effect in any of the 16 combinations") was made while the SQL change was NOT effective (the localization value is cached until a restart; the first VAL703 run showed the same: EditMode = Disabled had no effect until the services were restarted). With the change really in effect: (a) `BP_AllowMfgChangeAtPrint` (steps 1-4) or `BP_AllowMfgSetAtPrint` on a never-printed lot (steps 5-8) = Enabled for every EditMode value, as documented; (b) printed lot / no process, Override box NOT ticked = Disabled (steps 9, 10, 13, 14); (c) Override box ticked + **EditMode = Disabled** = Disabled (steps 11, 15), but Override ticked + **EditMode = Enabled = ENABLED** (steps 12, 16; Manufactured, Expires and Reassay all editable, calendar opens) - the UAT doc expects Disabled there, so those two steps do not match the doc as written. In every case the calendar icon tracked the field (`opacity: 1` + opens vs `opacity: 0.5` + does not open), i.e. the DIT #6356 symptom itself is fixed.


### VAL703 environment + UAT_6356 re-execution notes (2026-10-07; env `http://vmsrvval703/`, `.env` = MBUser1)
- **VAL703 fixtures:** test user `MBUser2` (Fred Johnson, group `MBSome2`, shared test password) was DISABLED ("User account is disabled." on the login page); re-enabled in Security Management > Users > edit > "Active User?" (the edit dialog shows only Active / AD checkboxes - password / reset fields are hidden - and the account then logged in without a forced password change). `MBSome2` baseline = 366 of 380 processes, incl. `BP_AllowMfgChangeAtPrint`, `BP_AllowMfgSetAtPrint`, `Override_Lot_At_Print` (restored after every run). The per-user process view equals the group's. `MI080301` does NOT exist on VAL703 ("No item found."). Items that work in Print by Lot there: `MI042801` (approved, active LCN LCN0000019, TWO label types: Carton Label + MBLabelType1 - pick a radio first); `CMVAL703ITM1`/`MAVAL703A`/`ExampleItem`/`Item 1` reach the Lot Panel but have NO active LCN ("No active label control record found for this Item/Label Type."); `MBUAT6356E_...` has master data "not approved and effective"; `CM2WorkflowTest31`/`MIBIGIMPORT*` = "No approved effective item found". VAL703 had no print history at all before 2026-10-07; `A1SuperTemplate` is not offered for new items there (the Template dropdown stayed empty).
- **Printing on VAL703 needed the Printer Control `*` record** (see the empty-Printers-dropdown note under Print by Lot). First hit of `InnoAPI/SentinelPrinting` after idle takes 4-7 s (app-pool warm-up) - not an outage.
- **`LocalizationResourceDef` changes (e.g. `...Lot.Lot_Manafactured` / `EditMode`) only take effect after a ServiceHost restart + IIS reset** - before that the old value stays in force (cost two wrong conclusions: TST703's "EditMode has no effect" and the first VAL703 round). After SQL: restart, wait about a minute, then test; always re-verify the effect in the UI.
- **Security processes DO take effect on the next fresh login** (no cache across logins): UAT_6356 used a brand-new browser context + `loginAs(MBUser2)` for every step; `Security_Management` toggles via `sec.toggleProcess` (only MB groups) and the saved state is re-read after reopening the page. `sec.openSecurity` logs in by itself (never call `login()` first - double login hangs).
- **Lot Panel DOM (legacy Print by Lot):** Manufactured `#ctl00_printContentHolder_deLot_txtLotManufactured` (always `readonly`; the real state is `disabled`), its calendar `img.ui-datepicker-trigger` (sibling; `opacity: 1` + opens `#ui-datepicker-div` vs `opacity: 0.5` + does not open), Override checkbox `#ctl00_printContentHolder_deLot_chbLotOverride` (label text just "Override"; the element is the top hit-target but is NOT visible in screenshots - it overlaps the "Expires" column heading, so DOM state is the only proof). `BP_AllowMfgChangeAtPrint` / a new-lot `BP_AllowMfgSetAtPrint` = Enabled; override ticked + EditMode Enabled = Enabled (even without any Mfg process); override ticked + EditMode Disabled = Disabled; printed lot + SetAtPrint only + override unticked = Disabled.
- **Word doc filling (UAT_6356.doc):** Table 5 = steps (rows 2-17, col 3 Result with exactly one 380 pt picture each, col 4 Pass/Fail), Table 6 conclusion; scripts in the session scratchpad (`dump-doc.ps1`, `inspect-shapes.ps1`, `crop-shots.ps1`, `fill-uat6356.ps1`): replace shapes in reverse order, sub-range text replace (`doc.Range(cell.Start+idx, cell.End-1).Text`) keeps formatting; the real file is on a share - the write needed the user's explicit approval.

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

## AddLotReasonRequired = Y on the print screens - Playwright-confirmed 2026-10-08 (`tests/Browser-Printing/Add_Lot_Reason_Required.spec.ts`, headless, 3/3, 2.1 min)

- Print Config `AddLotReasonRequired` = Y (user set it for MultiDocPrint, LotNumber, Print1, OrderNumberMultiple, LotNumberMultiple; no restart). A brand-new order (Print by order, Print by order multi) or lot (Print by lot, Print by lot multi) -> Next -> dialog **"Reason Code": "You are about to add a new lot record, please select a Reason Code in order to proceed."** with `#reasonSel` (options "(Select Reason)", "12345678765432345678976453249", "On Demand" = the AddLotReasonRequired codes), optional `#commentTxt`, buttons Reset / Submit and a Close X. Submit without a reason -> "This field is required." (dialog stays); Close dismisses it. A reason + Submit continues to the usual Item / Order step, then the Lot Panel.
- **The lot record is created as soon as the Lot Panel appears** (Lot Management shows lot / order / item / Print Entity ROBAR with placeholder dates 01/01/1900), BEFORE anything is printed; abandoning the screen leaves it behind (the spec deletes its lot; a first exploration run left two MBRL* lots that were cleaned up).
- **Print by order lot** (config OrderLot) shows NO dialog (its AddLotReasonRequired is not Y): "No Lot found for this order/lot/item combination. Please fix or continue." Multi Document Printing's own dialog was not re-checked here (earlier MDP specs covered its new-lot path).


## Batch quantity / Multiplier / Extra quantity in printing - requirements and config (2026-10-09, NOT yet tested live)
> **SUPERSEDED (draft banner, 2026-10-09):** this block was written BEFORE the tests; the live results are in the VERIFIED blocks further down this file ("Batch Quantity x Multiplier + Extra ...", "Print by Order / Print by Lot vs ValMaster"). Requirement ids and config names here are still valid.

- **ValMaster requirements (module "WEB - Print Request" unless noted):** FRS-8.1.1.5 (configuration controls Batch Qty, produced field L_U2, Item QTY Multiplier Identical / Serialized, Item Extra Quantity, "second print automatically a reprint", eSig for reprint); FRS-8.1.7.1 (the total batch quantity is communicated in a user-specified field); **FRS-8.1.7.3 total printed quantity for a label type = (Batch qty) x (Multiplier, Serial or Identical) + (extra), placed in the serialized copies if the label is serialized, otherwise in identical copies**; FRS-8.1.9.1 (a setting controls whether all subsequent prints are reprints or batch-quantity controlled); **FRS-8.1.9.2 the Reprint check box is defaulted and forced on when the system decides it is a reprint: a second print when the "all subsequent prints" setting is on, or, if quantity based, when printed qty + qty about to be printed exceeds the batch qty for the item / label type (multipliers and extras included; reprint records in history are ignored in the count)**. Multi Document Printing: MDP.180418.F.14.1 (non-serialized Copies in the Labeling grid = Batch Quantity x Multiplier + Extra of the Item and Lot record), F.14.2 (no values -> Copies = 1), F.4.12 (editing the Lot Batch Quantity via Override Lot Data updates Copies / Serial values), F.9.11 (serial copies take Batch Quantity, Multiplier and Extra into account), F.7.1 ("R" next to the checkbox for reprint rows: second print or reprint by batch qty). **Label Control Number Printing LCP.170105.F.10.1: a template with S_Ser or S_USerial sets Copy to 1 and ignores batch qty / multipliers / extra in ALL printing modules** (conflicts with MDP F.9.11 for serial copies). Other requirements seen (module not identified): extra field value with a "P" / "p" suffix (e.g. 5P) = percent of (Batch qty x multiplier), always rounded up; changing the batch quantity in the Override Lot Data grid recalculates Batch Qty and Copy as the new batch x multiplier + extra; the allowed copies use ItemExtraQuantityField and ItemQuantityMultiplierField; the ROBAR Items API accepts I_multiplier / I_extraqty. Label Verification: QtyToVerify = Batch Quantity x Multiplier (separate module).
- **TST703 Print Config (read-only look, Print Config Management = DynamicUI `Definition=PrintConfig`, columns ConfigName, PrintFunction, PrintLayout, ParamName, ParamValue):** Print1, LotNumber, OrderNumberMultiple and LotNumberMultiple all have `LotBatchQuantityField = u2` (the LOT's U2 field), `ItemQuantityMultiplierField = Qty2` (an ITEM field), `ItemExtraQuantityField = u5` (an ITEM field), and empty `ItemQuantityMultiplierField_Identical` / `_Serialized` params; MultiDocPrint has only `GetStartingSerial = N` in its first rows (ReprintBasedOnBatchQty was not on the first page of rows: look it up before flipping anything).
- **Test idea:** set the lot's U2 (Lot Management) = batch quantity, use an item whose Qty2 (multiplier) and U5 (extra, plain number or "nP") are set, then watch the Copy / Batch Qty fields on Print by Order / Print by Lot and the Copies column in Multi Document Printing; print to PDF to cross the reprint threshold and watch the Reprint box / "R" marker. Needs an item with those fields (Campaign Manager or an existing item) and, for the Y / N comparison, a Print Config flip of `ReprintBasedOnBatchQty` by the user.

### Batch Quantity x Multiplier + Extra, and the batch-quantity reprint rule — VERIFIED LIVE 2026-10-09 (TST703, Print by Order / Print by Lot, Print to PDF)
- Specs: `tests/Browser-Printing/Batch_Quantity_Copies.spec.ts` (NO print; 1 clean run so far) and `Batch_Quantity_Reprint.spec.ts` (6 copies per run; 1 full clean run + 1 resumed run; `RESUME_STAMP=<n>` continues an interrupted run on its order). Fixtures: items MBBQA8457561 (Qty2 3, u5 2) and MBBQB8543396 (Qty2 2, u5 "10P"), both on A1SuperTemplate / Carton Label with an LCN (test-data/batchqty-item-a.json / -b.json).
- **Copy field on the label screen = Batch Qty (the lot's U2, set via Override on the lot panel) x Qty2 + u5.** Item A: blank batch -> 2, batch 5 -> 17, batch 10 -> 32; Item B (u5 "10P" = 10 % of batch x multiplier, rounded UP): batch 10 -> 22, batch 7 -> 16 (14 + ceil(1.4)); same on Print by Lot (batch 10 -> 32). Matches FRS-8.1.7.3. Batch Qty `deLot_txtLotU2` is disabled until the Override checkbox `deLot_chbLotOverride` is ticked.
- **Reprint rule (Print1 / ReprintBasedOnBatchQty = Y, the default):** item A, batch 1 = 5 allowed. Print 3 -> next visit (same order/lot) Reprint unchecked, default Copy 5; print 2 (total 5) -> next visit: **Reprint ticked AND disabled** (forced), Print without Reprint Options -> "Please select a reprint reason."; with reason (Damaged Labels / Incorrect Data Entry) + password + comment the reprint prints. An existing lot goes straight from Next to the label screen (no lot panel; pick the label-type radio); Copy defaults to the full 5 every time (it does NOT show the remaining quantity).
- **Server rule (Lot.IsReprint, Innovatum.Printing.Lib/Legacy/ROBAR/Lot.cs:760-817):** reprint when printed total (non-reprint history copies) >= batch x multiplier + extra; the UI is supposed to compare printed + copies about to print, but the code comment says that is "currently not supported". **Deviation vs FRS-8.1.9.2** (forced when printed qty + qty about to print EXCEEDS the batch qty): with 3 already printed, Copy 3 (3+3=6 > 5) does NOT tick Reprint, nor does the default Copy 5 (3+5=8) -> logged as annotation `deviation FRS-8.1.9.2`, DIT tracker row added.
- Not tested: ReprintBasedOnBatchQty = N (user would flip), Multi Document Printing Copies / "R" marker, serialized templates (LCP.170105.F.10.1 vs MDP.180418.F.9.11), Override Lot Data batch change recalculation.
- **ReprintBasedOnBatchQty = N (user flipped Print1, LotNumber and MultiDocPrint 2026-10-09), `Batch_Quantity_Reprint_Off.spec.ts`, 1 clean run (1 copy printed per run):** item A, batch 1 (allowed 5): first visit Copy 5, Reprint off; print 1 copy; next visit on Print by Order AND on Print by Lot (same lot): **Reprint ticked + disabled, Reprint Options shown** (with Y it stays an original until 5 are printed). The default Copy is still 5 (the setting does not change the Copy formula). Matches FRS-8.1.9.1 / `isReprint = totalCount > 0`. Spec expects N: it fails/annotates if the value is flipped back to Y. Multi Document Printing with N not exercised yet.
- **Multi Document Printing + batch quantity — VERIFIED LIVE 2026-10-09 (`Multi_Document_Printing_Batch_Quantity.spec.ts`, 1 clean run, ONE copy printed; MultiDocPrint ReprintBasedOnBatchQty = N):** entry panel needs the Print Entity (first `<select>`, no id) chosen. Lot Panel: `#overrideLotCheckBox` (id only) enables the five U inputs (no name/id; lot, order, then U1..U5 = nth(2..6) of `input[type=text]:not([name]):not([id^=dp])`, Batch Qty = U2) and shows Save / Cancel. The Copies box `input[name=txtCopies]` per printer row stays disabled until a Label Type is picked; item A: blank batch 2; Save batch 10 -> 32; 1 -> 5; cleared -> 2 (F.14.1 / F.4.12 recalculation OK); item MI080301 (no Qty2 / u5) -> 1 (F.14.2 OK). After one printed copy the same lot shows the PDF row with an **"R" in the first cell, checkbox ticked (not disabled)**, Copies 5 (F.7.1 OK, as the setting is N). No deviations. Not yet tested here: ReprintBasedOnBatchQty = Y in MDP (default is N for MultiDocPrint).
- **Serialized templates + batch quantity — VERIFIED LIVE 2026-10-09 (`Batch_Quantity_Serialized.spec.ts`, 1 clean run, NO print):** items MBBQU5000105 on template `Userial_na` (S_USerial) and MBBQR5071799 on `SingleSer_na` (S_Ser), Qty2 3 / u5 2 (test-data/batchqty-item-userial.json / -ser.json; other serial templates in the Carton Label list: MTUSERIAL0803, MT071701Userial, SerTempna, SerMP1..9_na, HV_Serial). **Print by Order: Copy = 1 whatever the batch (blank or 10)** -> LCP.170105.F.10.1 OK there. **Multi Document Printing: blank batch 2, Override + Save batch 10 -> Copies 32 (batch x multiplier + extra) for both serial templates** -> follows MDP.180418.F.9.11 but NOT LCP.170105.F.10.1 ("ALL printing modules"); the two requirements conflict (annotation `deviation LCP.170105.F.10.1 vs MDP.180418.F.9.11`, DIT tracker row). Print by Lot not run for serial items (same PrintScreen code as Print by Order).
- **Override Lot Data recalculation:** covered by the MDP (F.4.12) and Print by Order (Override ticked) checks above — Copies / Copy follow the new Batch Qty immediately after Save / Next.
- **Run counts / flake (2026-10-09):** `Batch_Quantity_Copies` 3 passes, `Batch_Quantity_Serialized` 3, `Multi_Document_Printing_Batch_Quantity` 3, `Batch_Quantity_Reprint_Off` 2, `Batch_Quantity_Reprint` 2 (full + resumed). With `--repeat-each=2` the SECOND run in the same Playwright session failed every time (3 batches) with the page text **"Timeout waiting for Sentinel."** (or the Open SentinelLauncher? prompt check never closing): the Sentinel tray client seems to stop answering shortly after the previous run. Run each printing spec once per session / with a pause, not back to back. The in-spec lot cleanup also failed after such a failure (the page was no longer on Lot Management); leftover unprinted `MBBQ*` lots were deleted by hand with a throw-away cleanup spec (Contains filter per prefix, delete icon `#del_grdJqGrid`, confirm `Delete`).

### Print by Order / Print by Lot vs ValMaster "WEB - Print Request" (124 requirements, `valmaster-print-request.md`) — checks of 2026-10-09
- **Multi-item number (FRS-8.1.3.12 / 8.1.3.13) — OK** (`Print_Request_Multi_Item_Errors.spec.ts`, 1 run, no print): lots added in Lot Management (order O: lot L1 item A + lot L2 item B; lot L1 again under order O2 with item B) -> Print by Order with O and Print by Lot with L1 both stop at the entry panel with **"Multiple Lots found for this Order Number or Lot Number."** (the text says lots, not items). The same lot number under two orders is accepted by Lot Management.
- **Test Print (WP20130208001F103.x) — OK** (`Print_Request_Test_Print.spec.ts`, 1 run, 3 copies: 2 test + 1 real): `chbTestPrint` visible (TestPrintShow Y on TST703); ticking it turns `btnDoPrint` into "Test Print" (class `testprint`, red background); Test Print stays enabled and prints again (F103.1.1); after two test prints only, the next visit has Reprint UNCHECKED (F103.1.2, even with ReprintBasedOnBatchQty = N); unticking gives "Print" again; after the real print the Print button is locked until Reset (FRS-8.1.10.3). **Earlier note "Test Print did not complete under automation" no longer holds**: with the headed real-click flow (`support/print-request.ts` / `PrintByLot.print()`) Test Print completes ("Printed PID_....prn to Microsoft Print to PDF"). The "Test Printed" status could not be checked (Print History Inquiry HTTP 500; InnoView lists real prints only).
- **Default printer (FRS-8.1.10.2) — OK**: after a print to Microsoft Print to PDF the next visit for the same lot preselects "Microsoft Print to PDF" (a never-printed label shows the first printer of the list).
- **Print-screen security (`Print_Request_Security.spec.ts`, 1 run, no print; MB group MBPWLoginGrp, user MBPWLogin01; base processes `Login_WebMenu, Print_Label, BP_PrintByLot_Option, LT_<label type>`):** without `LT_Carton Label` the label screen says "No printable label types for this workstation due to label type exclusions." (the label type needs its own LT_ process, `LabeltypeSelection.cs`); label screen of an existing printed lot: base = Copies disabled, Test checkbox disabled, Print disabled; **+ `BP_Change_Print_Quantity` = Copies enabled (FRS-8.1.7.5 OK)**; **+ `BP_Test_Print` = Test checkbox enabled (F103.2.4 OK)**; **+ `BP_Reprint_Label` + `BP_Reprint_CanSign` = Reprint ticked + disabled, Reprint Options shown, Print enabled**. For a first-visit print screen the Lot Panel comes before the label screen. 
- **Serialized item on Print by Order (S_USerial template):** the label screen adds a **Serial Number Management** panel (`serialNum` + Add One, spreadsheet Upload, `startNum` + `count` + Add Series, Serialization Detail, Done, Delete); Copy = 1. FRS-8.1.7.6 ("Quantity Produced, Identical Copies and Serialized Copies are shown at print time") is only partly visible: the screen shows the lot's Batch Qty and ONE Copy box.
- **Needs a Print Config flip (user), see settings-change-requests.md:** `AllowManualDateEntry` = Y + `ManualEntryDateFormat` (WEB20141203F1.0.1-1.0.5), `WarnWhenPrintedLabelsExceedsValue` small (WEB20141205F1.0.2 / 1.0.4 / WB20141205F1.0.3), `GetStartingSerial` = Y with an S_Ser item (FRS-8.1.6.3-8.1.6.5, Specify_Starting_Serial_Num), `TestPrintRequiredForLot` / `TestPrintRequiredForSession` Y (F103.2.2 / 2.3).


### UPDATE 2026-10-09 to the Browser Printing "Not yet tested" list (above)
Still untested: Misc Printing, Serial Management's Add One / Add Series / duplicate-detection mechanics, Single Serial Printing. Changed since that list was written: (1) the Print by Order label screen of an S_USerial item shows the **Serial Number Management** panel (`serialNum` + Add One, spreadsheet Upload, `startNum` + `count` + Add Series, Serialization Detail, Done, Delete) - seen, not yet driven; (2) Test Print is NOT blocked by the IISRESET dependency mentioned there: it works headed (see the Test Print block near the end of this file); (3) serialized fixture items exist (`Userial_na`, `SingleSer_na`: items MBBQU5000105, MBBQR5071799).
