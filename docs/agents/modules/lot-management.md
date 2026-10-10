<!-- Split from robar-module-reference.md on 2026-10-09 (lossless, original order kept; later blocks are newer and win over earlier ones). Module file: lot-management -->

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

### Playwright-confirmed 2026-10-06 (`tests/Lot-Management/`, headless, Claude01 + MB fixtures)
- **`Lot_Management.spec.ts` (3/3, 7.7 min)**: tile "Lot Management" -> `InnoPages/DynamicUI/DynamicUI?Heading=Lot_Management&Definition=Lots`. Columns Actions, ID, OrderNum, LotNum, ItemNumber, PrintEntity, Expires, Manufactured, Reassay, U1-U5, LastTouch; filter columns the same names (use `retrieve(page, f, 'LotNum', 'Contains'|'Exactly Matches'|'Is Blank', value)`; an empty filter row retrieves nothing); jqGrid nav icons add / edit / view / del (`#add_grdJqGrid` ...) EXIST ONLY AFTER a Retrieve and Edit/View/Delete enable only with ONE selected row; Actions menu: Excel Import, Excel Export, Audit, Save Search, Load Search, Adjust Page Size. Add dialog: PrintEntity defaults to `ROBAR`, dates default to today; Edit: ItemNumber, PrintEntity and LastTouch read-only; View = read-only window; Audit opens `DynamicUI/DynamicUIAudit?pageID=` (Lot Management Audit with its own filter row); Delete confirm = "Delete selected record(s)?" Delete/Cancel. **No field is required on TST703**: a blank record (blank order/lot/item) is accepted once, an identical second one and a duplicate order/lot/item/entity are refused with "Record already exists", and an unknown item number is accepted (see the DIT tracker).
- **`Lot_Management_Security.spec.ts` (3/3, 7.4 min)**: with ONLY `LE_View_Lots` (Add / Edit / Delete icons disabled, double-click = View Record, Excel Import hidden) the server still accepted `POST /InnoPages/DynamicUI/AddRecord` oper=edit and oper=add (`{"Success":true}`) and `GET /InnoPages/DynamicUI/DeleteRecord?id=<row>&oper=del&sessionId=<grid session id>` (HTTP 500 page, lot deleted). The MB user needs a Print Entity (`ROBAR`, set with `support/print-entity.ts setUserPrintEntities`) to see any lot. pageID comes from the GridSessionStart request body; the grid session id is the (quoted GUID) response of GridSessionStart. The spec asserts today's behavior (all three succeed) and will fail when server-side checks are added.
- **`Lot_Management_Excel.spec.ts` / `_Print_Entity_Off.spec.ts` (3/3 each)**: Excel Import template headers OrderNum, LotNum, ItemNumber, PrintEntity, Expires, Manufactured, Reassay, U1-U5; import only creates; with PrintEntityRequired=N a PrintEntity other than ROBAR gives "Row 2 has an invalid value specifed for the PrintEntity column" (product typo). Export dialog ids `#fileName`, `#limitResults`/`#unlimitedResults`, `#submitBtn`, `#downloadLnk`.
- **`Lot_Management_Save_Load_Search.spec.ts` (3/3, 2.3 min)**: Actions > Save Search: radios `#radExisting` (Overwrite + `#drpExistingSets`, disabled while the user has no saved search) / `#radNew`, `#txtFilterSaveName`, `#txtFilterSaveDescription`, `#chkPublic` (ticked by default), Save button; blank = "Name and Description are required"; duplicate name with Save As New = "A filter with this name already exists"; Overwrite KEEPS the old description. Actions > Load Search: grid `#grdSavedFilters` (Name/Owner/Description), `#filterLoadBtn`; Load restores only the criteria row - click Retrieve Data afterwards. No delete in the UI (one search `MBPWSS1` stays on TST703).
- **`Lot_Management_Process_Icons.spec.ts` (3/3)**: each process switches on only its own control: `LE_View_Lots` = View icon + Excel Export; `+LE_Add_Lots` = Add icon; `+LE_Chg_Lots` = Edit icon AND double-click opens "Edit Record" (otherwise "View Record"); `+LE_Del_Lots` = Delete icon; `+EI_Lots` = "Excel Import" menu item visible.

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

## Requirements re-check (ValMaster first) - Lot Management, 2026-10-08 (`Lot-Management/Lot_Management_Requirements.spec.ts`; Y-state `Lot_Management_Edit_Entity_Lock.spec.ts` waits for PrintEntityRequired = Y)

Requirement set: `.agents/valmaster-lot-management.md` (76 rows: modules "Lot Management" and "Print Entity - Lot Management", Customer Specific blank). Deviations are test annotations `deviation <req id>`.
- **Met by the live system (checked 2026-10-08):** LM.160210.F.1.6 icon states (none: pencil / page / trash disabled; one row: all enabled; several rows: pencil + page disabled, trash enabled), F.1.7 row Actions (View Print History, View Lot Data Override, View Serial Numbers, View Locked LCNs), F.1.3 page Actions list, LM.150420.F.4.2 Add defaults Expires / Manufactured / Reassay to today, F.4.4 "Record already exists", F.1.10 / F.1.11 export file-name messages, F.3.1 delete confirmation "Delete selected record(s)?", F.5.3 "Row N already exists" (no update via import), F.5.5 duplicate rows in the sheet ("Row 3 is a duplicate row based on the primary key: ItemNumber, LotNum, OrderNum, PrintEntity"), F.5.8 text dates "2027-12-31" / "31-Dec-2027" import as 12/31/2027, F.5.11 no Validate button before a file is chosen, F.5.15 Sheet dropdown disabled with one worksheet and enabled with several (options sorted).
- **Deviations / open:** LM.150420.F.1.12 (no server-side authorization for Add / Edit / Delete / Import - the page-level checks are client side only); PE.161004.F.7.1 (with PrintEntityRequired = N the Add dialog still shows a Print Entity dropdown with ROBAR as its only option and the Edit dialog shows it disabled - the requirement says it is not displayed); PE.F.7.13 (a user with NO Print Entity can still use the Add icon; the dialog's dropdown is empty); PE.F.7.10-F.7.12 (a user whose only entity is inactive gets a DISABLED Add icon instead of a blank grayed-out dropdown and a disabled Submit); PE.F.7.9 (single entity: the Add dialog shows a one-option, editable dropdown; the Edit-dialog lock is checked by the Y-state spec when the setting is Y); PE.F.8.2 / F.8.3 (import messages are the generic "Row N has an invalid value specifed for the PrintEntity column" instead of "Print Entity is not linked to UserID: XXXXX." / "ROBAR is a required value for this column"); LM.150420.F.4.3 (required fields come from DynamicUIDetail: none are required on TST703 because the upgrade script ships every Lots field Required = N while the fresh-install seed marks ItemNumber Required).
- **Not checked yet:** F.5.12 Reset after a failed validation (no Reset button was found), F.5.13 required-field message, F.5.16 / F.6.1 / U.6 x_Lots audit rows (needs DB access or the Audit page content), F.5.17 TableImporterJobs table, PE.F.7.2-F.7.5 TRS table / FieldDefs rows, PE.F.7.7 / F.7.8 are covered by `Lot_Management_Print_Entity.spec.ts` (Y), PE.F.7.14 L_PrintEntity on labels.
- **Spec lesson:** reading a Global Setting (`readGlobalSetting`) in the MIDDLE of a DynamicUI spec leaves a hidden stale Lot Management tab (the next `#btnRetrieveData` is "hidden"): read settings first, right after login.



### CORRECTION 2026-10-09 - printed lots CAN be deleted in Lot Management
Several earlier notes and spec comments said "lots cannot be deleted" / "printed lots cannot be deleted". Live: the Lot Management delete icon (confirm "Delete selected record(s)?") removed unprinted lots AND lots that had been printed to PDF (own MB test lots MBBQM... / MBBQN482670L, 1 copy printed each); the Print History rows are not touched by that delete (not checked in the UI because Print History Inquiry returns HTTP 500). What stays undeletable: orders / items / dictionary phrases / codes / users (no delete in those modules). Treat lots as deletable test data, but remember the delete has no server-side authorization (see "Confirmed bug" above).
