---
name: project-harini-uat-feature-removal-pass
description: "Follow-up pass removing Harini-requested \"not applicable\" features and a few more redundant steps from the 20 consolidated UATs, plus a restructured summary spreadsheet"
metadata:
  node_type: memory
  type: project
  originSessionId: 62bc9438-590a-4bf7-9392-a9339ba21c3a
  modified: 2026-09-26T16:15:51.489Z
---

After [[project_harini_uat_batch_trim_pass]] (removing steps redundant with already-checked scripts), the user relayed a batch of Harini's per-UAT notes (2026-09-26) asking to remove specific features her team won't use or that are covered elsewhere. Applied one UAT at a time, each time rebuilding the `.doc` via `build_consolidated.ps1` and updating `UAT_Removed_Items.xlsx`.

**Removals applied (11 of 20 UATs touched):**
- `UAT_BP_PrintingSecurityAndVersionControl.doc`: Label Type Exclusion Maintenance (whole section) — not applicable.
- `UAT_BP_ComplianceAndReviewTools.doc`: Print-Time Redline Comparison (whole section) — not applicable.
- `UAT_CM_QueryingEditingAndDataMovement.doc`: Job Inquiry side-check + Label Type Security block — redundant (missed in the earlier trim pass, an orphaned prerequisite `s)` from that pass was also cleaned up here); Item Translation (whole section) + per-label-type field caption tooltip — not applicable.
- `UAT_CM_MDMIntegrationPDFAndWorkflow.doc`: Print Entity functionality (bundled with an item/master-data shelf-life precedence test that was only reachable through the print-entity flow — removed as one block per user's explicit choice) — not applicable; Send to Workflow (whole section, tested separately in the WM UAT) — not applicable.
- `UAT_MDM_MasterDataManagement.doc`: Trading Partner/Communications Manager integration section — confirmed genuinely redundant with 5 already-checked COM module scripts via a dedicated agent script-comparison (not just name-matching); Summary Label printing + Auto Approve — not applicable.
- `UAT_TM_TemplateManagement.doc`: non-.btw template file-type testing (the "external PDF must match" requirement) — not applicable, customer only uses .btw. Reworded Template 2's creation to drop file-type specifics; confirmed it stays valid for the file-locking/comments), only creates it before but Template 2 remains "unapproved and effective" without needing workflow approval (same as Template 1 was at creation), so the Retire/Unretire tests on it still work unmodified.
- `UAT_WM_WorkflowManagement.doc`: Change Controls testing (Add Attachments at Change Control level) — not applicable.
- `UAT_IV_PrintHistoryReports.doc`: InnoView Help feature — not applicable.
- `UAT_LC_SecurityAttachmentsLinkingAndVersions.doc` / `UAT_LC_ProductionAvailabilityComparisonAndReporting.doc`: additional redundant steps caught this same session (disabled-row-action checks vs. checked script `LC_BasicFunctions`).

**Standing pattern established this pass:** every removal is applied by editing the JSON source (steps array splice + purpose/conclusion/prerequisite text trims, relettering prerequisites when whole lettered items are removed), verifying step-boundary continuity (no orphaned dependency) before rebuilding, then rebuilding via `build_consolidated.ps1`, copying into `Consolidated_UATs\`, and logging to `removed_items.json` → `UAT_Removed_Items.xlsx` with a `Reason` field distinguishing "already validated by checked script X" vs. "Removed at Harini's request - feature no longer applicable."

**Judgment calls surfaced to the user rather than guessed:** MDM's Trading-Partner-vs-COM-module overlap (investigated via a dedicated agent reading actual script content, not just names, before removing — confirmed genuine duplication); CM_MDMIntegrationPDFAndWorkflow's entangled Print-Entity/shelf-life block (user chose to remove the whole block rather than try to preserve shelf-life coverage); whether autocreate/autorelease LabelControl guidance should also apply to the LC UAT's own dedicated section (user said no, leave it for now).

**Final deliverable restructure (2026-09-26):** `UAT_Summary.xlsx` was rebuilt from the original "UAT Name / Number of Steps / Features Tested" (granular per-step) format to a new 5-column format: **UAT_Name, Original Number of Steps, New Number of Steps, Features Tested, Features/Testing Removed** — the last two columns are feature-level summaries (not exhaustive step lists), with removals labeled "Redundant" or "Not Applicable". Source data: `original_and_removed.json` (hand-curated original step counts + removal summaries) + a fresh `extract_features_tested.ps1` pull of each UAT's current purpose feature-list. Build script: `build_summary_v2.ps1`. Both backed up in `_uat_build_sources\`. The old granular `UAT_Removed_Items.xlsx` (one row per removed step, 113 rows) is kept in the folder as the detailed companion, not deleted.

**Final step counts after this pass** (20 UATs, 9 unchanged): AM 30→29, BP_Printing 55→46, BP_Compliance 33→16, CM_Query 101→77, CM_MDM 83→47, LC_Security 69→67, LC_Production 79→77, MDM 120→102, TM 45→43, WM 30→29, IV 15→14. Unchanged: LM_Link 59, DUI 30, ESE 19, LOT 49, PHI 18, SM 14, VLM 19, WMI 41, MDP 43.
