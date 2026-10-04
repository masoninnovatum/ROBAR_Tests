# Exploratory Session Log — Master Data Management (MDM)

**Charter:** Read-only review of the 39 formal MDM test scripts (network share,
`\\diskstation\backedup\#Unlocked_Test_Cases\MDM\7.0.3\`), then exploratory testing against the
live application, following the same approach used for Campaign Manager and Workflow Management.

**Environment:** `http://vmsrvtst703/innovatum/WebMenu/` → Master Data, build 7.0.3.20102,
account `MBUser1` (Mason Baxter). A second account, `MBUser2` (Fred Johnson, MBSomeSecurity
group), was used for negative-permission testing per this session's explicit grant to modify
security for any `MBUser*` account.

**Constraint honored:** No GlobalSettings values were changed. One security process
(`MD_Create_Records`) was temporarily disabled on the MBSomeSecurity group for a
negative-permission test, then restored to its original (checked) state before the session ended.

**Status: complete** for all realistically browser-testable areas. Two confirmed bugs found (one
of them a cross-module systemic issue also present in Workflow Management), plus one confirmed
UX/documentation discrepancy.

## Formal Script Review — Scope Summary

39 scripts covering 24 test-case areas were converted and read (delegated across 4 parallel
research passes to manage volume — see the module reference doc for the condensed per-area
summary). Confirmed out of scope for this session, matching the pattern established in Workflow
Management — all require infrastructure this session doesn't have:

- Excel Import (Security/Importing/COM/Localization, 4 scripts) — needs real `.xlsx` file
  crafting and upload; blocked by the same file-input tooling limitation noted in the Workflow
  Management session.
- COM (Communications Manager linkage) and Excel Import — COM — need a live/configured
  trading-partner endpoint.
- Workflow Lock and Auto Approve — GlobalSetting toggle requires RDP + IISRESET +
  ROBAR_ServiceHost restart.
- Localization & Reporting — needs DB-level LocalizationResources import via SQL Server Import
  and Export Wizard, then RDP + IISRESET.
- Data Edit 4.3 (GUDID trigger simulation) — needs direct SQL access to seed
  `masterdatacolumntriggers`.
- Data Retrieval 1.2 (database-driven field) — needs a configured external SQL connection.

Everything else was in scope and covered live this session.

## Results by Feature

| Feature | Result | Notes |
|---|---|---|
| Data Retrieval / Filtering | ✅ Working | Schema dropdown, Column/Operator/Value filter, For Items (Any/Approved/Unapproved), Latest Version Only, Effective Only, Advanced Options (Available/Selected Fields dual-list, Limit Results) — all match docs exactly. |
| New Record | ⚠️ Working, but see Finding 1 | Create New Master Data dialog (Item Number + Description) works correctly; defaults confirmed (Version 0, Effective Begin = today, Effective End = 12/31/2099). |
| Data Edit / Validation | ✅ Working | Live inline validation (red label + undo-arrow on unsaved change), Min/Max Length messages, required-field messages all match docs. Save blocked with "Some fields contain invalid values..." popup when any field is invalid. |
| Approve | ✅ Working | E-signature dialog, Approved By populated correctly, record locks read-only after approval. |
| History (View History) | ✅ Working | Master Data Change History grid: Change Date/User/Field/Value Before/Value After, matches docs exactly. |
| Mass Approve | ✅ Working | Job Detail: Status Completed, 100%, per-item Approved By/Date populated. |
| Assign GTIN | ✅ Working | Field to Update / Packaging Code / Company Prefix, overwrite-confirmation warning fires correctly, generates a real 14-digit GTIN. |
| Mass Retire – Unretire | ✅ Working | Retire pre-selected for all-active selections; mixed active/inactive selection correctly triggers the mixed-selection warning. |
| Quick Edit | ✅ Working | Requires fields to be in Advanced Options' Selected Fields first (correct, matches docs). Dirty-state UX and persistence confirmed. |
| Data Schemas | ✅ Working | Create New Schema dialog, tab/field structure, all field-config controls present and functional; Save correctly blocked until Description is filled. |
| Security — module/action gating | ✅ Working (one gap) | Schema Level Security warning confirmed live for MBUser2. New Record correctly disabled when MD_Create_Records is revoked — but see Finding 3 for a tooltip gap. |
| Export to Excel | ❌ Confirmed bug | Same failure pattern as Workflow Management — see Finding 2. |

## Finding 1 (confirmed bug): "Labeler Duns Number" default value fails its own validity check on every new record

**Symptom:** Creating a new record under the RobarMasterData schema (via Actions → New Record)
always shows the Labeler Duns Number field pre-populated with `1234567890`, immediately flagged
in red: *"This dropdown value is no longer a valid selection. The schema definition may have
changed."* — on a record that was just created seconds earlier, before any schema change could
plausibly have occurred.

**Confirmed not a false alarm:** Opening the dropdown shows `1234567890` genuinely present and
highlighted as the current selection among the valid options ((Select), Innovatum, Masons Company
2, 1234567890). Re-selecting the exact same value from the dropdown does not clear the error.
Attempting to Save with it in this state is fully blocked by the standard "Some fields contain
invalid values..." popup. Selecting a genuinely different option (Innovatum) clears the error
immediately and allows Save to succeed.

**Reproducibility:** 100% — reproduced on all 4 new records created this session
(MBEXPLORE001–004).

**Impact:** Every user creating a new RobarMasterData record hits a confusing, blocking
false-positive error on a field they didn't touch, with a message that inaccurately suggests the
schema itself changed. The practical workaround (pick a different Duns Number) is not obvious
from the error text.

**Recommendation:** Check the schema's configured default value for this dropdown field against
the option list the UI actually renders — they've likely drifted (e.g., a stale default value ID
that no longer matches the current option's underlying value even though the display text is
identical).

## Finding 2 (confirmed bug, cross-module): Export to Excel silently fails — same pattern as Workflow Management

**Symptom:** Master Data → select a record → Bulk Actions → Export to Excel → Continue produces
no visible error and no downloaded file, identical to the Workflow Management finding from the
prior session.

Confirmed via network trace:
- `GET /InnovatumMDM/QueryInterface/ExportToExcel?...` → **503** (Service Unavailable)
- `GET /InnovatumMDM/QueryInterface/CheckForExcelExportFileComplete` → 200, body: `"true"`

This is the exact same failure shape documented for Workflow Management
(`/InnoPages/WorkflowManagement/ExportToExcel` → 503, `CheckForExcelExportFileComplete` → `true`
regardless). Different URL namespace, identical endpoint-pair naming and identical failure
behavior — strongly suggesting a shared underlying grid-export component used by both InnoPages
modules, rather than two independently-broken features.

**Impact:** Same as documented for Workflow Management — a user gets zero feedback that the
export failed and no path to realizing anything went wrong.

**Recommendation:** Since this is very likely one shared component, a single fix should resolve
both instances. File as one defect referencing both reproduction sites (Workflow Management
Export to Excel, and this MDM Export to Excel) rather than two separate tickets, unless the
underlying code is confirmed to be genuinely separate per-module.

## Finding 3 (UX/documentation gap): Disabled "New Record" shows no tooltip explaining why

**Setup:** Temporarily disabled `MD_Create_Records` for the MBSomeSecurity group (MBUser2's
group) via Security Management, then logged in as MBUser2 and opened Master Data → Actions.

**Result:** "New Record" correctly renders disabled (`ui-state-disabled`,
`aria-disabled="true"`) — the authorization check itself works. However, per the formal
`MDM_Security3.1` script, hovering a disabled action should show a tooltip reading *"User not
authorized for this task. MD_Create_Records"*. Inspecting the DOM directly confirmed no `title`
attribute exists anywhere on the element or its ancestors — there is no possible way a tooltip
can render here regardless of hover duration, since native browser tooltips are driven entirely
by the `title` attribute.

**Impact:** A user without this permission sees the action greyed out with no explanation at all
of why, or which security process would need to be granted — same silent-failure character as
Findings 1 and 2, just at the UI-affordance level rather than a job-submission level.

**Scope of this finding:** Only confirmed for New Record / `MD_Create_Records` specifically — did
not have time to independently verify whether other disabled actions (Approve, Retire, Edit) in
this build have working tooltips or share the same gap. Worth a quick sweep before filing, to
scope whether this is one missed control or a broader pattern.

**Security process restored:** `MD_Create_Records` was re-enabled for MBSomeSecurity before
ending the session — this was a test configuration change, not a permanent one.

## Coverage Summary

- Core record lifecycle (retrieve, create, edit, approve, history): fully covered, all correct
  except Finding 1
- Bulk actions (Mass Approve, Assign GTIN, Mass Retire-Unretire, Quick Edit): fully covered, all
  correct
- Data Schemas (schema/field/tab creation): fully covered, all correct
- Security (module access, schema-level filtering, action-level gating): covered — one gap found
  (Finding 3)
- Export to Excel: covered — confirmed bug, shared with Workflow Management
- Excel Import, COM/Trading Partner, Workflow Lock, Auto Approve, Localization: not tested —
  infrastructure this session doesn't have, consistent with the pre-testing scope assessment

## Recommended Follow-Up

1. Investigate the RobarMasterData schema's Labeler Duns Number field configuration — the default
   value's underlying ID likely no longer matches its option in the rendered dropdown.
2. File the Export to Excel finding referencing both reproduction sites (Workflow Management and
   Master Data Management) — very likely one shared component bug, not two.
3. Do a quick sweep of other disabled MDM actions' tooltips (Approve, Retire, Edit, Excel Import,
   etc.) to determine whether the missing-tooltip pattern in Finding 3 is isolated to New Record
   or systemic across the module's disabled-action UI.
4. Complete Excel Import, COM, Workflow Lock, Auto Approve, and Localization testing in a session
   with RDP/DB/file-upload access, or manually.
