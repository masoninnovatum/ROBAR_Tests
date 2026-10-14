---
name: project-harini-uat-batch-trim-pass
description: "Second trim pass over the 20 consolidated Harini UATs, removing steps redundant with already-checked (executed) formal scripts"
metadata:
  node_type: memory
  type: project
  originSessionId: 62bc9438-590a-4bf7-9392-a9339ba21c3a
  modified: 2026-09-26T14:49:27.214Z
---

After the 20 consolidated UATs were delivered (see [[project_harini_uat_batch]]), the user asked (2026-09-26) to cross-reference the spreadsheet's checkbox column (scripts already independently executed/passed by QA) against each UAT's steps, and remove any step testing the same functionality as an already-checked script, to shorten execution time further. A separate removed-items tracking file was requested.

**Why:** Harini's team had already manually run some formal scripts before/independent of the consolidation project; testing that functionality again in a consolidated UAT wastes the one tester's limited time.

**Method used:** Fresh Excel COM pull of the spreadsheet's checkbox column (independent of the red/yellow exclusion colors used in the original consolidation — checked ≠ excluded, it's a separate "already executed" signal). Cross-referenced checked script names against each UAT's own "Scripts covered" credit list — found zero exact-name overlaps, meaning the real overlap has to be found by comparing checked-script *functionality* against UAT *steps*, not by script name matching. Dispatched 8 parallel Explore agents (one per module group) to open each checked script's actual content from `\\diskstation\backedup\#Unlocked_Test_Cases\<Module>\...` and compare against the UAT's JSON step data, flagging only steps that were (a) a clean functional duplicate and (b) not load-bearing for later steps.

**Result — 15 steps removed across 5 of the 20 UATs** (937 steps remaining, down from 952):
- `UAT_AM_AttachmentManagementAndUpload.doc`: step 30 (Update Active Status) — redundant with checked `AM_UpdateActiveStatus`.
- `UAT_CM_QueryingEditingAndDataMovement.doc`: step 59 (Job Inquiry side-check) — redundant with `CM_JobInquriy-1.9`; steps 93–99 (label-type security block) — redundant with `CM_LabelTypeSecurity-1.34`.
- `UAT_MDM_MasterDataManagement.doc`: step 21 (Excel Import negative-permission) — redundant with `MDM_ExcelImport_Security22.1`; step 46 (audit-trail review after Quick Edit) — redundant with `MDM_History6.1`.
- `UAT_LC_SecurityAttachmentsLinkingAndVersions.doc`: steps 5 and 22 (Attachments/Update Versions disabled-for-restricted-user checks) — redundant with `LC_BasicFunctions`.
- `UAT_LC_ProductionAvailabilityComparisonAndReporting.doc`: steps 1–2 (bulk-actions list + Manage Production Availability disabled check) — redundant with `LC_BasicFunctions`.

Purpose/conclusion text was trimmed to match wherever a removed step was the *sole* basis for a stated claim (e.g. AM's "Update Active Status" feature line, CM's "Label Type Security" feature line, LC_Security's "required LM_View_LinkManagement" claim, LC_Production's "enforced its security process" claim for Manage Production Availability). Where a security claim was still backed by another remaining step (e.g. LC's `LC_Update_Versions` gate, also tested via Mass Update Versions and a credential-submission error message), the conclusion text was left as-is.

**Explicitly NOT removed — checked but no genuine functional overlap found:** Browser Printing (both UATs), Dynamic UI/Email Summary Engine, Multidocument Printing, InnoView, Template Management, Workflow Management, Print History Inquiry, Security Management, View Label Master, Web Menu Improvements, `CM_MDMIntegrationPDFAndWorkflow`, `LM_LinkManagement`. In each case the checked script tested a different discrete action/mechanism, a different module/UI for the same rule, or only the surface/entry screen — not the same thing our UAT steps validate.

**Judgment call surfaced to user, decision recorded:** Lot Management's `LOT_LotManagementAndDataOverride` steps 39–44 (5 security-gate checks) are functionally redundant with checked scripts `LM_Security2.1_BB` / `LM_Security2.2_BB` — but those are the outdated "_BB" scripts the user earlier said not to use as a source (see [[project_harini_uat_batch]]). **User decision: keep them** — don't trust an outdated script's pass as covering today's behavior. No steps removed from this UAT in this pass.

**Deliverables:** `UAT_Removed_Items.xlsx` (new, in `Consolidated_UATs\`) — one row per removed step: UAT name, original step #, removed instruction/expected text, and which checked script justified the removal. `UAT_Summary.xlsx` was regenerated with the new step counts/content. The 5 affected `.doc` files were rebuilt via the existing `build_consolidated.ps1` pipeline and overwrite the prior versions in `Consolidated_UATs\`. Sources backed up: `removed_items.json` and `build_removed_items_excel.ps1` added to `_uat_build_sources\`.

**Reusable process note:** the fresh Excel pull script (`pull_spreadsheet.ps1`, reads column A/B/C plus column-B interior color) and the cross-check approach (parallel per-module Explore agents opening actual checked-script content rather than trusting script names) worked well and could be reused if Harini checks off more scripts later and wants another trim pass.
