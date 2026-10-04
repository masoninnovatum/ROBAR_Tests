# Exploratory Session Log — Label Control

**Charter:** Read-only review of the 15 formal Label Control test scripts (network share,
`\\diskstation\backedup\#Unlocked_Test_Cases\Label_Control\7.0.3\`, covering 14 test-case areas per
`LC_TestPlan`), then exploratory testing against the live application, following the same approach
used for Campaign Manager, Workflow Management, Master Data Management, and Browser Printing.

**Environment:** `http://vmsrvtst703/innovatum/WebMenu/` → Label Control, build 7.0.3.20102,
account `MBUser1` (Mason Baxter).

**Constraint honored:** No GlobalSettings values were changed. No Print Configs were touched this
session (none were relevant to Label Control). No security process changes were made — all testing
was performed as MBUser1 without needing to provision negative-permission scenarios via MBUser2.

**Status: substantial coverage.** An initial pass flagged 5 of 9 Bulk Actions as completely
non-functional; a same-day retest (after the user enabled missing security process grants for
MBUser1) confirmed all 5 actually work correctly — see Finding 1 and the Retest Addendum below.

## Formal Script Review — Scope Summary

15 scripts covering 14 test-case areas were converted and read (`LC_TestPlan` read directly;
`LC_BasicFunctions`, `LC_UpdateVersions`, `LC_MassUpdateVersions`, `LC_LabelTypeSecurity`,
`LC_AssignControlNumbers`, `LC_Attachments`, `LC_LinkAttachments`, `LC_LinktoLabelMaster`,
`LC_ManageProductionAvailability`, `LC_RedlineCompare`, `LC_CompareWithPrior`,
`LC_ChangeDocumentReport`, `LC_RecreateMaster+ExportMaster` delegated across 3 parallel research
passes). Notable correction made to one research pass's assumption: Campaign Manager is a browser
web module accessible via the Web Menu (confirmed directly in this engagement's Campaign Manager
session), not a separate thick client — so `LC_MassUpdateVersions-1.2`'s dependency on Campaign
Manager is not an infrastructure blocker.

**Confirmed out of scope this session (GlobalSettings/RDP-dependent):**
- `LabelControl_MasterDataMustExist` GlobalSetting toggle (needed for full `LC_MassUpdateVersions`
  coverage) — requires RDP + ROBAR_ServiceHost restart.
- `LC_RecreateMaster+ExportMaster` section 4 (`LC_MDM_Integration` GlobalSetting + IISRESET).

*(Originally `LC_RedlineCompare`/`LC_CompareWithPrior`'s full PDF-generation flow was also assumed
out of scope, pending GlobalSettings for a PDF-compare service — this assumption turned out to be
wrong. See the Retest Addendum: both work correctly in this environment as-is.)*

**Confirmed in scope and exercised this session:** Basic retrieval/filtering, row-level Update
Versions, row-level Attachments (Link Management), Mass Update Versions (core validation + submit
flow), Assign Control Number, Manage Production Availability, Link Attachments, Link to Label
Master, and — critically — **all 9 Bulk Actions were exercised at the menu-click level**, which is
what surfaced this session's main finding (see Finding 1).

## Results by Feature

| Feature | Result | Notes |
|---|---|---|
| Basic retrieval / filtering (LCN Status, Attachments, Label Masters, Advanced Options field picker) | ✅ Working | Matches formal script expectations. |
| Row Actions — Update Versions | ✅ Working | Dialog shows Item/Template Version + Master Data Version dropdowns; correctly disables Master Data Version when no MDM link exists. |
| Row Actions — Attachments | ✅ Working | Opens the shared Link Management module pre-filtered by LCN, with 5 association modes (By LCN/Item/Item Version/Template/Template Version). |
| Bulk Actions — Assign Control Number | ✅ Working | Full e-signature flow, correct "Starting Control Number" preview, Job Detail matches formal script structure exactly. |
| Bulk Actions — Mass Update Versions | ✅ Working | All validation messages ("Description required", "Reason is required.") match; per-record/per-field granular success/failure reporting confirmed (e.g. "Successfully updated: Item and Master Data version. Could not update Template version, no latest approved found."). |
| Bulk Actions — Manage Production Availability | ✅ Working | Correctly blocks releasing an LCN whose Item/Template/Master Data is unapproved or ineffective, with the exact expected error text. |
| Bulk Actions — Link Attachments | ✅ Working | Same Link Management module as row-level Attachments. |
| Bulk Actions — Link to Label Master | ✅ Working | Correctly reports "Could not link to master. Matching or latest label master record not found." when no exact-match master data exists and "Use Latest If No Exact Match" isn't checked. |
| Bulk Actions — Redline Compare, Compare With Prior, Change Report, Recreate Master, Export Master | ✅ Working (see retest) | Initially appeared completely non-functional; **retest after enabling the required security processes confirmed all 5 work correctly**. See Finding 1 (updated) and the Retest Addendum below. |
| Label type security (live observation) | ℹ️ Informational | MBUser1 does not have unrestricted label-type visibility in this environment — see Finding 2. |

## Finding 1 (UPDATED — retested, root cause corrected): 5 of 9 Bulk Actions initially appeared non-functional due to missing security process grants, not a code defect

**Original symptom (first pass of this session):** Selecting a record and choosing **Redline
Compare**, **Compare With Prior**, **Change Report**, **Recreate Master**, or **Export Master**
from the Bulk Actions dropdown produced zero observable effect — no page navigation, no dialog, no
error message, no browser console error, and no HTTP requests. This reproduced consistently across
repeated attempts for all 5 actions, and directly invoking each action's underlying
`jobSubmissionRedirect(...)` function via the browser console bypassed the problem and produced the
exact behavior the formal scripts describe (e.g., Recreate Master correctly surfaced "One or more
LCN(s) submitted to the job is associated with unapproved Item Version, Template Version or Master
Data Version." with a working Details link). This led to an initial write-up theorizing a broken,
CSP-blocked inline-script click handler as the root cause.

**Correction after retest:** the user identified that MBUser1 was missing the security processes
these 5 actions require (`LC_RedlineCompare`/`LC_RedlineCompare_Link`, `LC_RecreateMaster`,
`LC_ExportMaster`, and the Change Report/Compare-With-Prior equivalents) and enabled them. **All 5
actions were retested and now work correctly via a normal mouse click, with no code changes on
either side.** This means the original CSP/inline-script theory was incorrect — the actual cause
was a missing-permission state, not a wiring defect. See the Retest Addendum below for full
results.

**Genuine UX gap worth keeping on record:** the formal scripts (e.g. `LC_RedlineCompare` step 1.4)
describe the expected behavior for an unauthorized user as the Bulk Action rendering **visibly
disabled** with a tooltip reading *"Not authorized for this action."* What was actually observed
in this session, before the security processes were enabled, did **not** match that: the menu item
looked identical to an enabled one (no greyed-out styling, no tooltip on hover) and simply did
nothing when clicked, with zero feedback of any kind. Whether this is the same missing-tooltip
pattern already documented for Master Data Management (Finding 3 in that module's session log) or
a distinct issue specific to these 5 Label Control actions was not root-caused further this
session, since re-testing it properly would require reverting MBUser1's security grants. Worth a
follow-up sweep — see Recommended Follow-Up.

## Retest Addendum (2026-08-26, same day): all 5 previously-blocked Bulk Actions confirmed working

After the user enabled the missing security processes for MBUser1, each of the 5 actions was
retested individually via a normal mouse click (no direct function invocation this time):

| Action | Retest Result | Notes |
|---|---|---|
| Change Report | ✅ Working | Radio options (CDR Only/Grouped Master Only/Grouped Master with CDR) rendered correctly. Submitted against LCN0000336 (no label master) → Job Detail: `CompletedWithErrors`, message `"No masters exist for select..."` — correct business-rule rejection. |
| Recreate Master | ✅ Working | Submitted against the same unapproved-item LCN → inline warning `"One or more LCN(s) submitted to the job is associated with unapproved Item Version, Template Version or Master Data Version."` with working `Details` link — identical to the direct-invocation result from the first pass, now reachable via plain click. |
| Export Master | ✅ Working | Submitted against the same record → `"Not all records are associated with Label Master. Label Master Key column is blank."` — identical to the first pass's direct-invocation result, now reachable via plain click. |
| Redline Compare | ✅ Working | Selected 2 records (LCN0000235, LCN0000329), neither with a Label Master → correctly showed the **"Create Temporary Master"** dialog exactly as `LC_RedlineCompare` step 2.10 describes ("One or both of the selected records are not associated with Label Master... Would you like to create a temporary label master now?... Note: A temporary label master will only be used to perform the Redline Compare and will not be saved to the database."). Selecting **Yes** generated a real, rendered PDF redline comparison with LCN/Item Number/Item Ver/Label Type/Master Data Ver/Template/Template Ver shown for both records side by side (LCN0000235 on the left, matching the "smaller LCN displayed on the left" rule), a working PDF viewer with page thumbnails, and `Save to ROBAR`/`Download Redline`/`Exit` controls present in the DOM. **Minor discrepancy noted:** the formal script says `Save to ROBAR` should be *disabled* when neither selected record has a Label Master — in this retest it was **not** disabled (`disabled: false`), though it was not clicked to confirm what happens on submit. |
| Compare With Prior | ✅ Working | Same 2 records, `Allow use of Temporary Master` checked → full Job Submission → Job Detail flow (not an inline dialog like Redline Compare). Per-record results: LCN0000329 completed successfully (`"Prior LCN: LCN0000328"`), LCN0000235 correctly errored (`"Could not complete comparison. Prior LCN record not found."`) since it has no prior LCN to compare against. |

**Conclusion:** the underlying features are fully functional and match the formal scripts closely
(one minor `Save to ROBAR` disabled-state discrepancy noted above, worth a quick follow-up). The
5 Bulk Actions are **not** a code defect — this session's original "confirmed bug" finding is
retracted and replaced with the missing-security-process explanation above.

## Finding 2 (informational): MBUser1 does not have unrestricted label-type security in this environment

On first opening Label Control Management with no filters, the page displayed a persistent banner:
**"Some search results are not displayed due to label type security."** This is a live, real-time
signal that MBUser1's security profile in this environment is scoped to a subset of label types,
not the unrestricted "AllSecurity"-style profile assumed by several formal scripts' `U01` user
variable. This didn't block any of this session's testing (records with an assigned LCN were
still retrievable and actionable), but it's worth flagging for future sessions: any negative
result on a label-type-scoped feature test should be double-checked against this constraint before
being treated as a bug, and `LC_LabelTypeSecurity`'s specific scenarios were not independently
re-verified against MBUser1's actual current label-type grants this session.

## Coverage Summary

- Basic retrieval/filtering, row-level Update Versions and Attachments: covered, all correct
- Assign Control Number, Mass Update Versions, Manage Production Availability, Link Attachments,
  Link to Label Master: covered, all correct, validation messages match formal scripts precisely
- Redline Compare, Compare With Prior, Change Report, Recreate Master, Export Master: covered at
  the UI-click level — **initially appeared non-functional, retested and confirmed fully working**
  after the required security processes were enabled (Finding 1 / Retest Addendum). One minor
  discrepancy noted (Redline Compare's `Save to ROBAR` button not disabled when it should be per
  the formal script) — not yet independently confirmed as a real defect.
- `LC_LabelTypeSecurity` scenarios specifically, `LC_MassUpdateVersions` sections 2–3 (GlobalSetting
  and duplicate-combination scenarios), and the full multi-step MDM-integration section of
  `LC_RecreateMaster+ExportMaster` (section 4): **not independently re-verified** —
  GlobalSettings/RDP-dependent or time-boxed
- Excel/file-upload-dependent aspects of Attachments (actual file upload/linking of a real
  attachment record): **not tested** — no attachments existed to link in this environment and no
  file-upload tooling was exercised this session

## Recommended Follow-Up

1. **Consider filing a UX defect** for the missing-permission behavior on these 5 Bulk Actions: a
   user without the required security process currently sees the menu item rendered as if enabled,
   with zero feedback on click, instead of the disabled-with-tooltip pattern (`"Not authorized for
   this action"`) the formal scripts describe. Confirming this precisely would require retesting
   with a user deliberately missing just one of these processes.
2. Quickly confirm whether Redline Compare's `Save to ROBAR` button being enabled (not disabled)
   when neither compared record has a Label Master is a genuine discrepancy from
   `LC_RedlineCompare` step 2.13, or whether the formal script's expectation is stale/inaccurate.
3. Re-verify `LC_LabelTypeSecurity`'s specific pass/fail scenarios against MBUser1's actual current
   label-type grants, or with a user provisioned to match the formal script's `U01` assumption.
4. `LC_RedlineCompare`/`LC_CompareWithPrior` full PDF-generation flow is confirmed working in this
   environment after all — the GlobalSettings-dependency concern noted earlier in this log turned
   out not to be a blocker (or was already configured). No further infrastructure follow-up needed
   here.
