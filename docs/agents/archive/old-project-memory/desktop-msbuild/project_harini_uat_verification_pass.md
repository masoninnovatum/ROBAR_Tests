---
name: project-harini-uat-verification-pass
description: "Full code/formal-script/flow verification of all 19 consolidated Harini UATs after the reformat work, with fixes applied"
metadata:
  node_type: memory
  type: project
  originSessionId: 62bc9438-590a-4bf7-9392-a9339ba21c3a
  modified: 2026-09-28T14:32:39.742Z
---

After the prerequisites reformat + step-text bolding work, the user asked to verify all 19 UATs against the actual C# codebase, the formal test scripts they credit, and internal navigational flow (given all the step removals this session) — confirming nothing broke and nothing is inaccurate. Ran 8 parallel Explore agents (one per JSON source grouping, matching earlier batching) each doing all three checks; findings triaged and fixed directly, then rebuilt/redelivered.

**Genuine bugs found and fixed:**
- **LC_SecurityAttachmentsLinkingAndVersions**: Item 5's prerequisite said "not yet linked to a Label Control Number" while LCN 22/Template A's prerequisites said Item 5 IS linked to LCN 22 — direct contradiction, pre-dated this session. Fixed by dropping the false clause.
- **LC_ProductionAvailabilityComparisonAndReporting**: the "User 1 has LC_View_LabelControl" baseline fact I'd added when removing Manage Production Availability got silently dropped during the later full-reformat pass (the reformat agent's proposal didn't carry it forward). Fixed by merging it into User 1's "all security user" line.
- **BP_PrintingSecurityAndVersionControl**: (a) orphaned LT1/LT2/LT3/Order LTOrder prerequisites left over from the earlier Label Type Exclusion Maintenance removal — deleted, never used in any remaining step. (b) "Order U" used in 5 steps but never defined in prerequisites — added. (c) User B's prerequisite was self-contradictory (main clause said "all enabled except 6 processes," parenthetical said "only 2 processes enabled total") — resolved by describing only User B's *starting* state (except Override_Lot_At_Print and BP_Reprint_Label) and noting step 11 is the step that adds the other 4 exclusions during the test (this was the correct reading — step 11's own expected result depends on it).
- **CM_QueryingEditingAndDataMovement**: (a) steps 1-2 needed approved LT-A items never defined in prerequisites — added. (b) step 43 jumped from an admin/Codes-Management action straight into a Campaign Manager query with no "Return to Campaign Manager" bridge (every other module-switch in the doc has one) — added. (c) dangling "unless a step directs otherwise" on the CM_MDM_Integration setting (never actually toggled in this UAT) — removed.
- **CM_MDMIntegrationPDFAndWorkflow renamed to CM_MDMIntegrationAndPDF**: the "AndWorkflow" in the name was stale/misleading after Send to Workflow was removed earlier this session — no workflow content remains anywhere in the doc. Renamed the UAT, the delivered file, and all tracker references (`UAT_Summary.xlsx`, `UAT_Removed_Items.xlsx`, `original_and_removed.json`, `removed_items.json`).
- **ESE_EmailSummaryEngine**: all four SMTP GlobalSettings (SMTPUsername/Password/Servername/Port) had the wrong SettingOwner — was "Innovatum.Robar.EmailSummaryEngine" (that's the *service* name, not the setting owner), should be "Innovatum" per `GlobalSettingsDefaultRecords.cs:195-198`. Fixed.
- **SM_ReprintSigningSecurity**: the quoted error message had a trailing period inside the quotes that isn't in the actual format string (`Localize_MultiDocPrinting.cs:121`). Fixed in both the step and the conclusion.
- **LOT_LotManagementAndDataOverride**: both the LotDataOverride and X_LotDataOverride table column lists were missing `LastTouch`, confirmed via the actual table schema (`LotDataOverrideTable.cs`) and the standard X-table column pattern (`ChangeType...ChangeSignature` + all base columns). Fixed both.
- **TM_TemplateManagement**: (a) `TemplateExtensions`' SettingOwner was wrong ("Innovatum.Pages.TemplateManagement.MVC.Views.Management" is actually the *localization resource* owner, not the GlobalSetting owner — real owner is "Innovatum" per `TemplateManagementService.cs:83`). (b) the prerequisite said TemplateExtensions merely "includes .btw" but step 5's rejection message only quotes ".btw." — the shipped default actually includes .ai/.indd/.docx too, so the message would list all of them unless TemplateExtensions is set to *exactly* .btw for this environment. Reworded the prerequisite to say it's set to .btw only for this customer's test environment, explaining why the message differs from the shipped default.
- **MDP_MultiDocumentPrinting**: `PrintServerTimeout`'s SettingOwner was left as "unknown — verify" from the reformat pass; actually resolvable — "Innovatum.Robar.LabelMasters" per `GlobalSettingsDefaultRecords.cs:387`. Filled in.

**Intentional scope reductions, NOT bugs (flagged by agents, correctly left as-is):**
- TM_TemplateManagement no longer covers TM_SubmitToWorkflow-1.8's non-.btw/external-PDF sub-case (~15% of that script) — this was the user's explicit "remove non-.btw testing" request from earlier this session, working as intended.
- WM_WorkflowManagement no longer covers WM_AddAttachments-15.1's Change-Control-level attachment sub-case — this was the user's explicit "remove Change Controls testing" request, working as intended.

**Unresolved, flagged for the user (not independently verifiable from this codebase):**
- IV_PrintHistoryReports: a step claims the View Print History report includes "Print Entity" and "Serial Num" columns; the agent couldn't confirm this against INNOV-3.1's actual column list (the InnoView product's own source isn't in this repo). Worth checking against the live report before treating as authoritative.
- WM_WorkflowManagement's `AttachEditIncrementSeqNum` SettingOwner is genuinely ambiguous in the codebase itself (default-records table says one owner, `UploadAttachmentsService.cs` reads it via a different owner string) — left as "SettingOwner unknown — verify" since that's accurate, not a UAT error.

All fixes rebuilt via `build_consolidated.ps1` and redelivered to `Consolidated_UATs\`. All 19 UATs are now verification-complete as of 2026-09-28.
