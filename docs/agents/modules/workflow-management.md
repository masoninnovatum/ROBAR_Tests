<!-- Split from robar-module-reference.md on 2026-10-09 (lossless, original order kept; later blocks are newer and win over earlier ones). Module file: workflow-management -->

## Workflow Management

**Purpose:** The counterpart to Campaign Manager's "Send to Workflow" — retrieve, vote on, and
administer workflows (item-level, template-level, or standalone non-item/non-template ones
created directly here).

**Formal scripts reviewed:** all 28 scripts under `Workflow_Management\7.0.3\` (see
`.agents/exploratory-session-log-workflow-management.md` for the full per-script breakdown).

### Retrieve/Filter Workflows
- `Find Workflows for User` dropdown (default "Any User") + `Retrieve Workflows`.
- Advanced Options: `User is Included` / `User Can Vote` radios (different semantics — Included =
  user is somewhere in the workflow steps; Can Vote = it's currently their turn), `+Add Filter`,
  All/Open Only/Closed Only dropdown, `Latest Item Version Only`, `Effective Item Only`,
  `Limit Results`, `Field Definitions` dropdown (per-label-type custom field captions, e.g.
  `Code2` → "Change Control" by default).
- Column dropdown for filters has **66 fields**: 54 `Item -` prefixed, 4 `Template -` prefixed
  (Label Type, Template Description, Template Name, Template Version), 8 `WF -` prefixed (Date
  Initiated, Last Status, Last User, Workflow Change Control, Workflow Comments, Workflow
  Description, Workflow Id, Workflow Status).
- `Filter by Change Control` dropdown — separate quick-filter, instantly re-filters the grid; a
  `View Change Control` link opens a 4-tab Detail dialog (Workflow Image/Comments & History/
  Steps/Attachments) scoped to the CC. CC-level attachments are visible across every workflow
  sharing that CC number.
- Grid selection: `Select All` (all pages) vs `Select Page` (current page only) are genuinely
  different and reset on navigation.
- Filters persist per-user across sessions (`UserEnvironment` table, `PageId='WorkflowManagement'`).

### Actions dropdown (page-level, not row-selection-dependent)
- **Create New Workflow** — Job Description, Workflow Comments, and Preset are all required
  (Submit Job stays disabled with live "Required" validation). Optional attachments with
  duplicate-filename detection (`"Upload Failed: Cannot upload duplicate file."`). Gated by
  `WM_Create_New_Workflow`.
- **Preset Management** — full CRUD, gated by `WM_Create_Workflow_Preset`:
  - Create: Preset Name + Description, validated (`"Please specify a preset name."`,
    `"Preset already exists. Please specify a new value."`)
  - Add Step / Edit Step panel fields: User dropdown, Department, `Vote for Entire Group`
    checkbox, `Vote Counts As Veto` dropdown (default None), Approval Group (auto-increments per
    new step), Hours to Respond (default 72), `Notify Immediately`, `Notify Only`, Create Step /
    Update / Delete Step. Validates `"User must be selected"`.
  - Save As clones all current steps into a new preset (same name validation as Create).
  - Active checkbox (unchecking ≠ deleting — inactive presets stay selectable but greyed in the
    dropdown) vs. Delete (confirmation-gated, fully removed from the active list).
  - Full audit trail: `WFHEADERPRESETS`/`WFSTEPPRESETS` (current) mirrored into
    `X_WFHEADERPRESETS`/`X_WFSTEPPRESETS` (history, `ChangeType` A/C/D = Added/Changed/Deleted).

### Bulk Actions dropdown (on selected grid rows) — 4 actions, each independently security-gated
1. **View and Vote** (`WM_ViewAndVote`) — Job Submission grid has header + row-level
   Approve/Reject/`Vote For Dept`/Veto checkboxes, each gated by its own security process
   (`WM_ViewAndVoteCheckAll` for header, `WM_ViewAndVoteCheckBox` for row-level). Detail dialog:
   Workflow Image/Comments & History/Steps/Attachments tabs, vote panel (Comment + Reason,
   default "General"), Previous/Next (auto-advances on Approve/Reject, "This is the last item in
   list" on the final one). Rejecting without a comment is blocked by default
   (`"Comments are required for rejected workflows."`) unless the user holds
   `WM_ViewAndVoteSkipComment`. `WFRejectHasVetoPower` GlobalSetting (default N): when Y, a single
   reject vote instantly rejects the whole workflow. Attachment deletion is double-gated: security
   process (`WM_DeleteWFAttachments`, `_Anyuser` variant for others' uploads) **and** workflow
   status (disabled once Approved/Rejected).
2. **Edit Workflows** (`WorkflowEdit_Option`) — bulk step editor. Actions dropdown inside it:
   `Delete User`, `Replace User`, `Add User` (submenu: Add at Beginning / Add at End / Add to
   Group — each with Append vs Insert). Only affects **open** steps without votes already cast;
   warns when some selected workflows are past that point. Confirmed job-result messages: "User X
   has been added/removed", "User X replaced user Y". Per-step click opens Edit Step (same fields
   as Preset Management's), Update/Delete with cancelable confirmation dialogs. Users are
   color-coded green (voted all)/yellow (partial %, shown)/red (not voted).
3. **Report** (Workflow Summary Report, `WF_Generate_Report`) — generates PDF(s) to a network
   subdirectory under `WFReportPathName` GlobalSetting, either merged
   (`WorkflowReport_Merged_<date>.pdf`) or per-workflow. Attachments auto-append to the bottom
   based on File Purpose being listed in the `AppendWFSummary` Codes entry. **Confirmed working**
   — verified the actual PDF exists on disk after submission.
4. **Export to Excel** — ❌ **Confirmed bug**, see below. Only gated by base module access
   (`Web_WorkflowManagement`), no extra security process.

### Add Attachments
Two independent security processes: `WM_AddAttachment_Open` / `WM_AddAttachment_Closed`.
Attaching to a **closed** workflow triggers `"Adding an attachment to a completed workflow can
replace production files. Would you like to proceed?"`. Attachments can also live at the Change
Control level, visible to every workflow sharing that CC.

### Linked Documents
Gated by `LM_View_LinkManagement`. Opens Link Management in a new tab, pre-filtered by LCN (if
the item has one) or by Item Number + Version + Label Type otherwise; template-level workflows
filter by Template Name + Version + Label Type.

### Redline (requires Sentinel desktop client — not testable via pure browser automation)
Create/Edit Redline buttons launch a desktop editor via the Sentinel chain. Real file-locking
between concurrent editors (Cancel/Continue, or Cancel/Take Control if the user holds
`FP_View and Vote Redline_Edit_Override_Lock`). Auto-toggles Create↔Edit based on whether an
active redline attachment exists (File Purpose = "View and Vote Redline").

### Change Control
CC number is just a configured item field (`Code2` by default, caption controlled via Field
Definitions Management). `ChangeControlRequirement`, `ChangeControlShareName`,
`IsChangeControlApplicableField` GlobalSettings control whether/how it's auto-populated by the
Workflow Service backend — changing these requires an IISRESET + service restarts.

### Features requiring infrastructure this environment doesn't have (out of scope for browser-only testing)
- **Workflow Status Report / Simple Status Report / Limited variants** — driven by
  `InnoTasc.WorkflowStatusReport.exe` run manually on the server via RDP, verified via real email
  inboxes.
- **Workflow Service** — backend Change Control sync; testing requires GlobalSettings changes +
  IISRESET.
- **PreApprove User** (`WMPreApproveUser` GlobalSetting) — grid-filtering-by-configured-user;
  requires GlobalSettings change + IISRESET. Confirmed **off** (blank) in this environment.
- **Localization Resources** — requires importing translated strings via direct SQL and switching
  site language.

### Playwright-confirmed 2026-10-05 (`tests/Workflow-Management/`, helpers `tests/support/workflow.ts`; as Claude01)
Specs: `Preset_Management` (3/3), `Workflow_Lifecycle` (create/find/vote), `Item_Workflow`, `Template_Workflow` (headed), `Export_to_Excel` (3/3). Every spec creates a throw-away preset `MBPW...` with ONE step for the test user and deletes it again (presets CAN be deleted); workflows, closed items and templates cannot be deleted, so each run leaves closed workflows behind.
- **Page map (all in the one Workflow Management tab/iframe):** `Management` (grid `#gridResults`; Find Workflows for User `#drpUser` incl. "Any User"; `#btGetWorkflows` Retrieve, `#btCancel` Reset; Advanced Options toggle `#btAdvanced` hides `#drpApproved` (All / Open Only / Closed Only), `#chkOpenForVotingOnly`, `#rdIncluded/#rdCanVote`, `#chkLatest`, `#chkEffective`, `#txtLimit`, `#drpFieldDefs`, the **`Filters[0].*`** criteria widget (NOT `dvFilters`; 66 columns, WF ones `wfwWorkflowId`, `wfwDescription`, `wfwHeader_Status`, `wfwLast_User`, `wfwComments`, `wfeChangeControl`...), CC filter `#drpCCIds`; Select All / Select Page), `PresetManagement`, `SendToWorkflowJobSubmission?jobId=` (Create New Workflow), `WFJobDetail`, `WFViewAndVote/JobSubmission`, `WFViewAndVote/JobDetail`. Grid columns: Workflow ID (`YYYYMMDD-NNNN`), CC Number, Workflow Desc, Status, Last User, Last Status Changed, Detail. Default order is ASCENDING by Workflow ID (oldest first, 800+ rows on TST703): **Reset, then click the `#gridResults_WorkflowID` header until descending** to see new workflows on page 1. Bulk Actions `#drpActions`: Edit Workflows `#actWfEdit`, View And Vote `#actViewAndVote`, Report `#actWfReport`, Export to Excel `#actWfExportToExcel` (needs ticked rows). Main Actions: Create New Workflow `#actCreateWorflow`, Preset Management `#actCreateWFPreset`.
- **Persisted state + crash gotchas:** the last search (user, status, criteria row) is persisted per user and re-applied on load ("Filters are being applied"); the Advanced Options panel starts collapsed so `#drpApproved` is hidden until `#btAdvanced` is clicked. Driving the `Filters[0].Column` select crashed the tab repeatedly in headless runs — avoided by Reset + newest-first sorting. **`cm.openCampaignManager()` calls `login()`; a second login on an already logged-in session crashes the page ("Page crashed" on `.userID`)** — open the tile with `openMenuItem` instead.
- **Preset Management** (`#ddlSelectPreset`, "Create New" → dialog `#txtCreateNewName/#txtCreateNewDescription`): blank name → "Please specify a preset name."; duplicate (incl. Save As) → "Preset already exists. Please specify a new value."; created preset is auto-selected, Active on, no steps; **Add Step** (link in `#steps-container`) opens `#dvMainEdit` (legend "Add Step"; `#drpUser` options "Name (Full Name)", `#txtDepartment`, `#chkVoteForGroup`, `#drpVoteVeto` None/Approve/Reject/Both, `#txtApprovalGroup` auto-increments 1,2..., `#txtHoursToRespond` default 72, `#chkNotifyImmediately`, `#chkNotifyOnly`); no user → error dialog "User must be selected"; click a step to Edit (legend "Edit Step", Update/Delete Step — **no confirmation dialogs** for update or delete step); `Save As` clones steps; **description and Active are saved only by the "Submit Changes" button (`button.button-class-long`), which is disabled until the form is dirty (blur the field), and switching presets discards unsubmitted edits**; an inactive preset stays in the dropdown with class `is-inactive` (and is not offered in Create New Workflow); Delete preset → "Are you sure you want to delete the preset?" Delete/Cancel.
- **Create New Workflow** (same page as CM/TM "Send to Workflow"): `#btnFormSubmit` stays disabled until Job Description + Workflow Comments + a Preset (blur the comment); the chosen preset's steps appear inline (editable); Submit → `WFJobDetail` ("Display ID" `2026100500NN`, Status Submitted → Completed, **"Workflow Id: YYYYMMDD-NNNN"**, % shows "100 %" or "100%"). New workflow status Open; Detail dialog tabs Workflow Image / Comments & History (the creation comment) / Steps (User, Group, Department, Action, Date Voted) / Attachments.
- **View And Vote** (`InnoPages/WFViewAndVote/JobSubmission`): vote grid rows with Approve / Reject / Vote For Dept / Veto checkboxes (Vote For Dept + Veto disabled for a single-user step), header tick-alls, Totals row; **`Update` opens a signature dialog** (`#jobDescription #UserID #Password #Reason #Comment`; reasons General / QA Review / Rework / Smudged; Submit/Cancel) → `WFViewAndVote/JobDetail` (Status Completed, per-workflow Step Status "Completed"). Approve + reject of different workflows in ONE job works. Statuses afterwards: **Approved** / **Rejected** (Last User = voter), both leave "Open Only" and appear under "Closed Only". The "Comments are required for rejected workflows" rule is **skipped for a user holding `WM_ViewAndVoteSkipComment`** (the admin test user rejected with an empty comment).
- **ITEM workflows** (CM Send to Workflow, bulk action `WorkFlowSendTo`; `#txtDescription`, `#txtComments`, `#drpPreset`, `#btnSubmit`; job in `CampaignManager/JobDetail`): WM description is generated — `Item: <n>, Version: <v>; Label Type: <lt>; Label: <template>, Version: <v>`. **While open the item is LOCKED**: Item Edit shows the approval status "Item being routed in workflow – cannot be modified.", Save disabled, Description read-only, Approve Item tooltip "User not authorized for this task 'CM_MassApprove'". **Approve → the item is approved and Approved By is the WORKFLOW ID (`20261005-0018 - 10/5/2026`), not a user; Reject → the item is released: Unapproved and editable again.**
- **TEMPLATE workflows** (TM bulk "Submit to Workflow"; one job can include several templates): WM description `Label: <template>; Label Type:Carton Label; Version:0`; after Approve the template's Approved By = the workflow id (+ time) and it is approved; Reject leaves it unapproved (1/1/1900). 
- **EDIT WORKFLOWS (bulk step editor; `Edit_Workflows.spec.ts`, 3/3)**: tick workflows > Bulk Actions `#actWfEdit` > page `InnoPages/WorkflowManagement/Edit` ("N Workflows Selected"). Grid `#grdWorkflows` groups workflows with IDENTICAL step lists into ONE row with a Count; step buttons `.grid-approvalgroup a` (red = no votes, yellow partial, green voted). Actions `#drpActions`: `#lnkDeleteUser`, `#lnkReplaceUser`, and **Add User = hover submenu** (hover the "Add User" text, then `#lnkAddToBeginning` / `#lnkAddToEnd` / `#lnkAddToGroup`; leaving the menu open and re-clicking `#drpActions` toggles it away). Add form = `#dvMainEdit` (`#drpUser`, `#btCreateStep`; blank user -> dialog "User must be selected." OK); Replace = `#drpUserToReplace` + `#drpUserToReplaceWith` + `#btReplaceUser`; Delete = `#drpUserToDelete` + `#btDeleteUser`. Every action is a JOB (`Edit Workflows Job Details`, Display ID, "Number of Workflows: N", per-workflow messages "User mbuser3 has been added." / "User mbuser5 replaced user mbuser3." / "User mbuser4 has been removed."; user ids shown lowercase) with NO confirmation dialog. The user dropdowns list only users who can vote (e.g. `MBPWLogin01` is absent; MBUser3/4/5 work). History tab logs each addition as user SysGen: "Workflow step for mbuser3 created by Claude01."; Steps tab rows read "<user> <group> <dept> Open". Step order proven: add End -> [Claude01, mbuser3]; add Beginning -> [mbuser4, Claude01, mbuser3]; replace; delete. A workflow whose current step belongs to another user cannot be voted by the test user (View And Vote's signature dialog never opens), so delete the extra steps before closing. NOT yet tested: Add to Group, workflows with votes already cast, security gating (`WorkflowEdit_Option`).
- **SECURITY GATING (`Security_Gating.spec.ts`, MB fixtures MBPWLoginGrp/MBPWLogin01; process list verified from the controllers)**: `Web_WorkflowManagement` = module + Export to Excel (no separate Export process); with ONLY Login_WebMenu + Web_WorkflowManagement the page opens, the "Find Workflows for User" dropdown is pre-set to the user's own name and greyed out, and **Create New Workflow (`WM_Create_New_Workflow`) and Preset Management (`WM_Create_Workflow_Preset`) are greyed**: the `li` gets `data-bind="menuDisable: true, processName: '<process>'"` and `title="User not authorized for this task <process>."` (enabled: `menuDisable: false`, no title; the binding adds `ui-state-disabled`). Bulk Actions: View And Vote = `WM_ViewAndVote`, Edit Workflows = `WorkflowEdit_Option`, Report = `WF_Generate_Report` (greyed with the same tooltip form). `WF_View_Non_Member_Workflow` gates seeing others' workflows. **On the View And Vote page ALL FOUR vote checkboxes (Approve/Reject/Vote For Dept/Veto) are DISABLED unless the user also holds `WM_ViewAndVoteCheckBox`** (`WM_ViewAndVoteCheckAll` = the header tick-all boxes). A user can only be a step user in a preset if they can vote (MBPWLogin01 only appears in the Edit Workflows user list once WM_ViewAndVote is granted). **"Comments are required for rejected workflows." is a CLIENT-SIDE rule** (`RejectRequiresComment = !User.IsInRole("WM_ViewAndVoteSkipComment")`): it fires only when a row's Detail dialog is opened with Reject ticked and an empty vote comment (message dialog with Continue; unticks the Detail dialog's own Reject box, not the grid's). **Rejecting from the grid with the Reject checkbox + signature dialog and NO comment goes through for a user WITHOUT the skip-comment process** (Status Completed), so the rule is easy to bypass (see DIT tracker). With `WM_ViewAndVoteSkipComment` the Detail dialog shows no message. S3 (all six WM processes) = every menu item enabled.
- **ATTACHMENTS (`Attachments.spec.ts`)**: row Detail dialog > Attachments tab (`#attachmentsList`: User, Date/time, file-name link, Download, Delete -- all `<input type=button value=...>`, so read input values; ids `viewFileBtn<n>`, `downloadFileBtn<n>`, `deleteFileBtn<n>`; a new workflow has none) > `#btnUpload` "Add Attachments" (enabled by `WM_AddAttachment_Open` for an open workflow, `WM_AddAttachment_Closed` for a closed one) navigates the tab to `GetUploadWorkflowAttachmentsData?workflowId=<id>`: Workflow Id `#txtWorkflowId` (read-only), description `#txtWFDescription`, `+ Add Attachments` `#lnkAddAttachments` adds a file input (`input[type=file]`, `multiple`), trash icon removes it, `#btnSubmit` disabled until a file is chosen. Submit -> `SubmitWorkflowAttachments` page "success" + dialog **"Files attached successfully."** (OK). Same file name already attached (or twice in one submit) -> dialog **"Upload failed: Cannot upload duplicate file."**. CLOSED workflow: Submit first shows the warning "Adding an attachment to a completed workflow can replace production files. Would you like to proceed?" with Continue/Cancel (Cancel adds nothing). Download = `DownLoadFile` (browser download event, same bytes). Delete = confirm "Are you sure you want to delete <file>?" Yes/No (Yes removes the row; gated by `WM_DeleteWFAttachments`, `_Anyuser` for others' files, and workflow status). The tab is reachable for closed workflows too (attachment added to a closed workflow is listed).
- **ATTACHMENT SECURITY (`Attachments_Security.spec.ts`, headless, MB fixtures; run 1 green, matches `WorkflowManagementService.cs` ~516)**: `#btnUpload` (Add Attachments) is enabled only with `WM_AddAttachment_Open` on an OPEN workflow or `WM_AddAttachment_Closed` on a closed one (never the other way round). A file's Delete button is enabled only if ALL hold: workflow status Open, the file was attached more than 10 s after the workflow was created, the user has `WM_DeleteWFAttachments`, and the file is the user's own unless the user also has `WM_DeleteWFAttachments_Anyuser`. Closed workflows: no Delete ever (both delete processes held). Without any attachment process the tab is read-only. Vote prerequisites for a second user: WM_ViewAndVote + WM_ViewAndVoteCheckBox.
- **LINKED DOCUMENTS SECURITY (`Linked_Documents_Security.spec.ts`, headless, MB fixtures; run 1 green)**: a template workflow can be created WITHOUT BarTender by Template Management > Bulk Actions > Submit to Workflow on an existing unapproved MBGDMD fixture template (the vote rejects it again; the template stays unapproved). Without `LM_View_LinkManagement` the Detail dialog's `#btnLinkManagement` exists but is DISABLED; with it the button opens the LinkManagement tab, filter values `[<template>, "0", "Carton Label"]`.
- **REPORT (`Report.spec.ts`, 3/3)**: Bulk Actions > Report (`#actWfReport`) opens the dialog "Workflow Summary Report": `#txtSubdir` Subdirectory (blank + Submit -> red "Required" in `#txtSubdirVal`), `#chkMergedReport` "Merge selected workflows into a single report?" (CHECKED by default; unchecked = "a separate pdf report for each individual workflow"), Cancel / Submit. Submit POSTs to the InnoTasc service (`<InnoTascRoot>/WFReportSummary/CreatePDFs`, form fields workflowIds[], location, merge, changeControl) and a dialog says "Your report has been created: \\VMSRVTST703\Network\SignatureReport\<subdirectory>" (OK). The share is readable from the test PC: merged -> ONE `WorkflowReport_Merged_<yyyymmdd>.pdf` (~3 KB for two workflows), not merged -> `<workflowId>.pdf` per workflow (valid `%PDF-`). Folders are left behind on the share.
- **LINKED DOCUMENTS (`Linked_Documents.spec.ts`)**: only ITEM and LABEL (template) workflows show the `#btnLinkManagement` "Linked Documents" button (Workflow Image tab of the Detail dialog; enabled by `LM_View_LinkManagement`; standalone workflows have no button). It calls `window.top.doMenuIconClick` to open a new menu tab "LinkManagement" = `InnoPages/LinkAttachmentManagement/LinkManagement?workflowId=<id>` whose criteria rows are pre-filled (Exactly Matches, And): item workflow -> ItemNumber, ItemVersion, LabelType; template workflow -> TemplateName, TemplateVersion, LabelType (an item with an LCN would be filtered by LCN instead). Returning to the Workflow Management tab reloads it (the Detail dialog is gone).
- **FILTERS (`Filters.spec.ts`, 3/3)**: radios `#rdCanVote` (default) = workflows where the selected user has an UNVOTED step; `#rdIncluded` = every workflow the user is part of (80 vs 12 for Claude01); a workflow the user already voted but that still waits for another user DROPS OUT of Can Vote and stays in Included. `#chkOpenForVotingOnly` ("Show item open for voting") narrows Included down to the Can Vote set. `#drpApproved` = All / Open Only / Closed Only (open + closed = all). `#txtLimit` caps the retrieved rows ("View 1 - 3 of 3"). Select Page ticks the page's 10 rows, Select All ticks every retrieved row ("Checked Rows: N" in the pager). `#drpFieldDefs` lists "Default" + every label type; `#drpCCIds` stays hidden (class `hide`) until retrieved workflows have change control numbers (none here). Persisted state: always set user, radio, open-for-voting, status and limit explicitly after Reset.
- **MULTI-STEP PRESETS / VOTING RULES (`Multi_Step_Presets.spec.ts`, helpers `addPresetStep` / `createPresetWithSteps` / `VoteKind` in `support/workflow.ts`, `setGroupProcesses` in `support/security.ts`)**: step form `#txtApprovalGroup` (steps with the same number are one approval group), `#chkVoteForGroup` ("Vote for Entire Group"), `#drpVoteVeto`. Observed with WFRejectHasVetoPower = N: (1) a later-group user CAN vote before earlier groups voted (sequence only drives notification e-mails); (2) the workflow stays Open until every step has voted, then Approved; (3) "Vote for Entire Group": a plain approval counts only for the voter; the voter must also tick **Vote For Dept** (box 3 of [Approve, Reject, Vote For Dept, Veto]) for the vote to count for the whole group -> Approved at once; (4) a single reject does not close the workflow; **one reject (group 1) + one approve (group 2) ends Approved: with veto power off the header status is the LAST vote (`WFViewAndVoteService.cs` ~1331)** -- not defined in ValMaster (see DIT tracker); (5) a single reject inside ONE parallel group behaves the same way (Open, then the other voter's approval makes it Approved: last vote wins); (6) **Veto CONFIRMED**: a step with Vote Counts As Veto = Reject, whose user rejects with the Veto box ticked, closes the workflow as **Rejected at once** while the other group member has not voted (S6 in the spec; the closed workflow is still listed in the voter's own list but cannot be voted again). Vote page box order and enable rules: Vote For Dept enabled only for a Vote-for-Group step, Veto only for a veto step; all need `WM_ViewAndVoteCheckBox`.
- **ValMaster / formal scripts cross-check (2026-10-05)**: requirement rows (sheet 3214043046537092, Description column) -- WFRejectHasVetoPower "optionally give reject votes veto power, so that a single reject vote will reject the entire workflow"; WM_ViewAndVoteSkipComment: only users with it may leave the comment blank "when rejecting a workflow through the View and Vote bulk action", others get the popup "Comments are required for rejected workflows" (OK deselects Reject) when they try to go to the next workflow or close the vote dialog (so the formal script WM_View_and_Vote-3.3 tests it INSIDE the Detail dialog); WM_ViewAndVoteCheckBox / CheckAll gate the row / header checkboxes. Formal scripts are under `\\diskstation\backedup\#Unlocked_Test_Cases\Workflow_Management\7.0.3\` (28 docs; extract text with Word COM on a COPY, read-only).
- **WM grid paging**: page size select `select.ui-pg-selbox` (10/20/30); changing it can reset the sort (re-sort Workflow ID descending); a row's textContent has no spaces between cells (`innerText` does) and a CC number cell can precede the description, so match descriptions with unanchored regexes and read the id from `td[aria-describedby="gridResults_WorkflowID"]`.
- **EDIT WORKFLOWS > ADD TO GROUP (`Edit_Workflows_Add_To_Group.spec.ts`, run 1 green)**: Add User > "Add to Group" (`#lnkAddToGroup`) opens the same Add form with `#txtApprovalGroup` ENABLED (empty) plus two radios (click their labels `label[for="rdAddToGroup"]` = "Add Step inside of Approval Group, does not create a new group if the selected group already exists" / `label[for="rdInsertGroup"]` = "Create a new approval group, shifting other approval groups upward if necessary"). Proven on preset [test user g1, MBUser3 g2]: Add to Group MBUser4 at 1 -> steps tab [Claude01 g1, mbuser4 g1, MBUser3 g2] (no new group); Insert Group MBUser5 at 1 -> [mbuser5 g1, Claude01 g2, mbuser4 g2, MBUser3 g3]. The Steps tab shows an added user in lower case with a blank Department ("mbuser4 1 Open") unlike preset-created steps ("Claude01 1 QA Open").
- **EDIT WORKFLOWS ON VOTED STEPS (`Edit_Workflows_Voted_Steps.spec.ts`, 3/3)**: a voted and an unvoted workflow with the same step list are ONE group (Count 2); the voted step shows yellow with "(50%)" partial voting. `#divTopWarning` says "Voting is complete on some of the selected workflows. Only open workflows can be changed."; the replace/delete form adds "Only the steps without votes will be changed." Replace test user -> MBUser4 on both: job (each workflow "Completed") W2: "User mbuser4 replaced user claude01." and W1 (voted): **"User claude01 has already voted or does not exist."** (nothing changed). After that the workflows differ, so the Edit page lists them as two groups. **Deleting the last OPEN step leaves the workflow Open forever (header not re-evaluated, nothing votable)**; adding a step (Add User at End) makes it votable again -- `closeWorkflow()` in `support/workflow.ts` does that (adds a step for the test user when every step is voted, then rejects every enabled vote row). Workflows with another user's open step cannot be closed by the test user (several `PW ...` test workflows stay open on TST703; harmless).
- **Playwright gotchas learned**: `actionTimeout` defaults to unlimited -- a wrong selector hung a run for the whole test timeout (set `test.use({ actionTimeout: 20_000 })`); `hasText` filters match textContent (no spaces between grid cells), so a `\sOpen\s` regex never matches -- use `/Open/`; a template can only be in one open workflow, so Template_Workflow rejects leftover open `MBWFTpl`/`MBGDMD` workflows first.
- **Export to Excel**: works (200 + valid `WorkflowExport.xlsx` listing the ticked workflows) — the older 503 note below does NOT reproduce.

### Confirmed bug: Export to Excel silently fails (NOT reproducible 2026-10-05, see the block above and the DIT tracker)
Clicking Bulk Actions → Export to Excel produces no visible error and no downloaded file — the UI
just returns to idle. Root cause via network trace: `GET ExportToExcel` returns **HTTP 503**
(reproduced 2-for-2 on clean UI-triggered attempts), but the client's polling endpoint
`CheckForExcelExportFileComplete` returns **`true`** regardless, so the client believes the export
succeeded and stops polling — a silent, undetectable failure from the user's perspective. Calling
`ExportToExcel` directly via `fetch()` outside the normal flow returned 200 OK moments later,
suggesting a session-state race between `SaveSelectedWorkflowsToSession` committing and
`ExportToExcel` reading that state, rather than the endpoint being permanently broken.

### Relevant GlobalSettings (as observed 2026-08-25, view-only — do not change without explicit approval)

| Setting | Value | Owner |
|---|---|---|
| `WFInquiryShowCC` | Y | Innovatum.CampaignManager.Plugin.ViewAndVote.WCF |
| `WFInquiryShowId` | Y | Innovatum.CampaignManager.Plugin.ViewAndVote.WCF |
| `WFItemChangeControlField` | Code2 | Innovatum.CampaignManager.Plugin.ViewAndVote.WCF |
| `WFRejectHasVetoPower` | N | Innovatum.CampaignManager.Plugin.ViewAndVote.WCF |
| `LimitWFEmails` | N | InnoTasc.WFReportSummary.WCF |
| `WMPreApproveUser` | *(blank — feature off)* | Innovatum.Pages.WorkflowManagement.WCF |
| `WFReportPathName` | `\\<ROBARServerName>\Network\SignatureReport\` | InnoTasc.WFReportSummary.WCF |

---

### UAT_6614 / DIT #6614 (Preset Management, empty description) — executed 2026-10-09 on TST703
`tests/DIT-6614/Execute_UAT_6614.spec.ts` (headed, desktop screenshots; the Playwright window sat on the RIGHT monitor of the 3840-wide desktop, crop 1932,10,1410x760). Flow: Save As from MBPreset1 with empty `#txtSaveAsDescription` -> new preset auto-selected (description '') -> uncheck Active + Submit Changes -> select ROBAR Only then the inactive preset -> no new `pageerror`, Active off, steps shown; preset deleted afterwards. **TST703 already serves the fixed `presetManagementModel.js`** (`descriptionTooltip` null-guarded: `description() && description().length >= 50`), so the UAT passes there; the old failure could not be observed. Release-folder UAT: `UAT_6614.doc` (built from UAT_6512 layout, footer replaced).

