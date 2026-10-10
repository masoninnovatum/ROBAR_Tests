<!-- Split from robar-module-reference.md on 2026-10-09 (lossless, original order kept; later blocks are newer and win over earlier ones). Module file: field-definitions-management -->

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

### Playwright-confirmed 2026-10-04/05 (`tests/Field-Defs-Management/`: `Field_Definitions`, `Item_Screen_Layout`, `Security_Gating`, all 3/3)
Run as Claude01 + the MB fixtures; **only the MB label type `MBLT1` is touched and every edit is reverted**; "Create New Field Definitions" is opened and cancelled only (it clones a whole field set, cannot be undone, and there is no way to delete field definitions).
- **Page** `InnoPages/FieldDefsManagement/Management` (NOT DynamicUI; same jqGrid look and the same `dvFilters` criteria widget): Label Type `#ddlLabelTypes` ("(Default)" + only label types that HAVE field definitions: 21 on TST703; MBLT1, Carton Label ...), Actions `#drpMainActions` → `#actNewFd` (Create New Field Definitions), `#actItemScreen` (Item Screen Layout); criteria columns Caption (`CurrentCaption`), Column Name (`FieldName`), Default Caption, File/Form (`FileForm`, a fixed-value dropdown), Sharename (`ReplacementString`), Tab Name; Advanced Options dual list `#availableLimitColumns` / `#selectedLimitColumns` (default selected: Label Type, File/Form, Caption, Default Caption, Sharename; extra: Column Name, Field Type, Tab Name, Sample Data, Drop Down, Read Only, Drop Down Language, Validate, Translate, Decimals, Fixed Length, Column), `#txtResultLimit`, `#btnRetrieveData`, `#btnReset`. MBLT1 has 84 definitions (files/forms: containers, lots, facilities, items...), default page size 10.
- **Gotchas:** **Limit Results is PERSISTED per user** (a leftover 25 silently capped later retrieves — set it explicitly); the criteria row is persisted too: a leftover BLANK row makes Retrieve return nothing (and crashed the tab once); remove rows with the row's "Remove" link. In a **Contains** filter the underscore is a SQL-LIKE single-character WILDCARD (not escaped): `C_` also matches `F_City` and `F_Misc1`. Operator option VALUES are indexes — select by label (shared `tests/support/dynamic-ui.ts` helper handles it).
- **Edit Record** (jqGrid form dialog, `#sData`/`#cData`): editable `#CurrentCaption` (Caption), `#ReplacementString` (Sharename — genuinely editable), `#SampleData`, `#IsDropDown`, `#Validate`; disabled `#ReadOnly`, `#Translate`, `#DropDownLanguage` (until Drop Down is ticked, then a long dictionary-language list); File/Form, Column Name, Field Type and Tab Name are shown read-only. Edit + restore of caption/sample data persisted in the grid.
- **Create New Field Definitions** (`#newFieldDefsDialog`): `#ddlNonFdsLabelTypes` = label types WITHOUT definitions (42 on TST703, includes MBINDD, MBCustom, MBDOCX — never also in the main dropdown), `#ddlOrigLabelTypes` = copy sources (the 21 that have them), `#btnSubmitNewFds` / `#btnCancelNewFds`.
- **Item Screen Layout** (`ItemScreenLayout?labelType=<LT>`, knockout-sortable): tabs `ul.sortable-tabs li.tab-li` (`#tab-li-N`, heading `a#tabs-N-heading`): Unassigned (non-editable, index 0), Basic, Other, User + the `(+)` tab `#tabs-addTab-heading`; rows are `.row-template` (inner id `row_<fieldName>`, handle `.tabgrippy`, three cells Default Caption / Current Caption / Sharename); `#saveBtn` (disabled until a change), `#cancelBtn`. **Moving a field = real mouse drag of its row handle ONTO the target tab's heading** (down, move in steps, up); the source tab must be the active one. Save persists (verified after reopening), Cancel discards. MBLT1: Unassigned 17 / Basic 12 / Other 13 / User 8.
- **Security (live, MB user; `Security_Gating.spec.ts`):** no `Web_Field_Definitions` → no tile (even with `FD_Maintain_FieldDefs` and an LT_); tile only → the Label Type dropdown holds just "(Default)"; each `LT_<LabelType>` adds that label type (here `LT_MBLT1` → MBLT1; Carton Label stays hidden) and the same filter applies to the Create-New copy-source list; the grid's Edit icon stays disabled until `FD_Maintain_FieldDefs`. Actions (Create New / Item Screen Layout) are listed for any tile user.

### Field Definitions Management vs ValMaster (FDM.190606.*, `valmaster-field-definitions-management.md`) — re-check 2026-10-09 (`Field_Definitions_Requirements.spec.ts`, headless, 1 clean run; nothing created or changed)
- **OK:** F.1.4 no rows before Retrieve Data; F.1.5 the criteria row has an `AndOr` select (And / Or); F.1.7 "No records to view"; F.1.8 - F.1.10 pager "Page [input] of 9", record counter 10 / 20 / 30 with default 10, "View 1 - 10 of 84" (no word "records", hyphen not en dash - cosmetic); F.2.4 Dictionary Language list = 56 entries starting blank then AddL1, AddL2, Arabic ... in alphabetical order, blank default; F.3.3 / F.3.5 the Create dialog's Create button shows the confirmation and **No closes both dialogs** (nothing created); criteria / Advanced Options / Edit dialog / Item Screen Layout / LT_ gating were already confirmed by the older specs.
- **Deviation F.2.3 (wording):** an MB user without `FD_Maintain_FieldDefs` double-clicking a record gets "User not authorized for this task 'FD_Maintain_FieldDefs'" + OK (requirement: "User not authorized for this task.FD_Maintain_FieldDefs", no quotes, a period). Note the other modules' message form "User not authorized for this task. EI_Codes_Upd" (period + space) - inconsistent across modules.

