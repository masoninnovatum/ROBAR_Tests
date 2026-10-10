<!-- Split from robar-module-reference.md on 2026-10-09 (lossless, original order kept; later blocks are newer and win over earlier ones). Module file: 00-overview-and-todos -->

# ROBAR Module Reference

Consolidated knowledge about how individual ROBAR/Innovatum Suite 7 modules actually behave,
built from formal QA test scripts (network share `\\diskstation\backedup\#Unlocked_Test_Cases\`)
and live exploratory testing against `http://vmsrvtst703/innovatum/WebMenu/`. This is a *behavior*
reference, not a code reference — it captures what the UI does, what fields are required, what
security processes gate what, and which behaviors have been confirmed as bugs vs. confirmed as
correct-but-surprising.

**Maintenance convention:** whenever formal test scripts for a ROBAR module are provided for
review, or a live exploratory testing session against a module is completed, add or update that
module's section here with what was learned — field lists, required-field gotchas, security
process names, confirmed bugs, and anything a future session would otherwise have to rediscover
by re-reading the scripts or re-testing live. See `CLAUDE.md` for the standing instruction that
established this.

Session logs with full step-by-step detail and screenshots-in-spirit live alongside this file as
`.agents/exploratory-session-log-*.md` — this document is the distilled, load-bearing summary;
those are the raw record.

**Cross-project note (2026-09-29):** this file is deliberately project-independent — it lives here
regardless of which specific ROBAR build/checkout a given Claude Code project points at (a new
project gets created for each new build, e.g. `703_20198` today, a future build's own project
later). **Any Claude session doing ROBAR/Innovatum Suite 7 work, in any project, should read this
file (and its companion `.agents/formal-scripts-reviewed.md`, tracking which formal test scripts
have actually been read end-to-end) before starting module-specific work**, and add to both as
part of any exploratory/live-testing or formal-script-reading session — not to a project-scoped
memory file, which is invisible to every other project. If you're a session in a new project and
don't already know this file exists, it's worth asking the user or checking whether an `.agents/`
folder like this one is present in a sibling/parent checkout.

---

## Open To-Dos for Live/Exploratory Testing

Items below are **unresolved disagreements between two documentary sources** (a formal script's own
text/recorded Actual Result vs. a prior code-inspection pass) that could only be settled by actually
driving the live application and observing true current behavior. Whenever a future session does
exploratory or locator-focused testing (Playwright test-writing, MCP browser exploration, or manual
UAT execution) that happens to touch one of these areas, check the item live, then **update the
relevant module section below with the confirmed true behavior and remove the item from this list**
(or narrow it, if only partially resolved). Don't go looking for these proactively on their own — a
dedicated verification-only session is generally lower value than answering them as a side effect of
other work already touching that screen.

- **Campaign Manager — Send to Workflow's `unappMDMChecked` default state.** Is "Use Unapproved MDM
  Item" checked by default? `CM_SendToWorkflow-1.11.docx`'s own text (including a step recording a
  direct `LocalizationResourceDef` query) says **checked/`True`**; a 2026-09-24 code-inspection pass
  recorded it as **unchecked/`false`**. See Campaign Manager section, "Double-confirmation pass"
  subsection, for full detail. Check this the next time a Send to Workflow test/exploration touches
  the job submission page's MDM checkboxes.
- **Campaign Manager — Excel Import's exact error-message catalog.** `CM_ExcelImport-1.7.doc`'s own
  recorded Actual Results show `"Data not formatted correctly."` (plus a more specific
  `"...ApprovedBy must be blank."` variant) and `"Excel file has improper format..."` as genuinely
  observed; a 2026-09-24 code-inspection pass claimed these strings "do not exist" and recorded
  different text instead. Also unresolved from the same script: whether the Import from XLS job
  submission page has a visible Cancel button (the script's own recorded evidence is internally
  inconsistent on this), and whether the "no records" message says "Excel file" (singular) or "Excel
  Files" (plural, per this script's own text). Check next time an Excel Import test/exploration in
  Campaign Manager exercises validation-error paths.
- **Campaign Manager — Mass Item Update's numeric validation message wording.** Does it include the
  article "a" (`"Value can only be a positive number."`, per this script's own recorded Actual
  Result) or not (`"Value can only be positive number."`, per the 2026-09-24 code-inspection note,
  which matches this script's own Expected-column text instead of its Actual)? Check next time a
  Mass Item Update test/exploration hits a non-numeric-value validation case.
- **Campaign Manager — Load External Filter's operator label, specifically for the BASE
  (non-MDM-integration) variant.** `CM_Load_External_Filter-1.21.doc`'s own operator list reads
  `"Not in External Column"` (lowercase "in") consistently throughout; the 2026-09-24 code-inspection
  note attributed `"Not In External File"` to this exact script instead (reserving `"Not in External
  Column"` for the separate `CM_MDM_Load_External_Filter-1.22` MDM-integration variant). Check next
  time a Load External Filter test/exploration in Campaign Manager runs with `CM_MDM_Integration`
  GlobalSetting confirmed OFF, to see which label the base widget actually shows.
- **MDM — Data Retrieval 1.2's "may be testable here without a separate server" correction** (older,
  from 2026-09-29, MDM section) — flagged as re-attempted-live-needed, not yet done. Check next time
  an MDM Data Retrieval test/exploration comes up.
- **MDM — the `masterdatacolumntriggers` field-cascade mechanism** (2026-09-29, MDM section,
  `MDM_Data_Edit4.3.doc`) — documented from the script's text only, still not executed live (needs
  SQL seed access to set up a trigger row). Check if a future session gets SQL access for this kind
  of setup.
- **Label Control — `LC_ExportToExcel.docx`** (2026-09-30) — exists in `Label_Control\7.0.4\` but
  not `7.0.3\`, so never read at all. Check whether this environment's Label Control screen even has
  an Export to Excel action before assuming it applies here; read the script if it does.
- **AlphaNumeric Counter / DataMatrix feature — dedicated testing planned, not yet started**
  (flagged 2026-09-30 after the `Counter_DictPhrase_FieldName` incident above, now resolved) — the
  user wants focused testing of Counters functionality specifically at some point; no formal
  scripts for this have been identified/read yet. Check `Innovatum.PrintServer.Lib`'s
  `doDataMatrix`/`AlphaNumCounter` code (see Print by Lot section) and look for a dedicated
  `Counters`/`DataMatrix`/`AlphaNumeric` formal-script folder on the share drive when this comes up.
- **Label Control — Link to Label Master's third "could not link" message variant: RESOLVED
  2026-10-02.** `"Could not link to master. Matching label master record not found."` (no "or
  latest") is real: live-confirmed for a v1 record when only v0 has a Label Master and Use Latest is
  unchecked (see Bulk Actions row 5).
- **Campaign Manager — Item Edit's RTF Editor button, paused mid-exploration (2026-09-30).**
  Explicitly deprioritized by the user ("save it for later... it isn't something widely used by
  customers") after the native launch and window/control mechanics were already confirmed live, but
  before a working permanent test was finished. See the Campaign Manager section's own "RTF Editor
  — paused, resume later" write-up for everything already learned (control map, the real Save/
  Cancel semantics, the unsaved-changes dialog, variable spawn timing, the orphaned-native-window
  risk) so picking this back up doesn't re-discover any of it from scratch.

---


## REVIEW OF THE TO-DO LIST ABOVE - 2026-10-10 (status per item; the original text is kept unchanged)
| # | Item | Status | Evidence |
|---|---|---|---|
| 1 | Send to Workflow `unappMDMChecked` default | **NARROWED**: on TST703 the Send to Workflow job page has NO "Use Unapproved MDM Item" checkbox at all (only Send Individual Emails, Vote for Entire Group, Notify Immediately, Notify Only, all unchecked); it presumably appears only with `CM_MDM_Integration` on / MDM-linked items - recheck when that setting is on | live read 2026-10-10 (read-only spike) |
| 2 | Excel Import error-message catalog (CM_ExcelImport-1.7) | **STILL OPEN** (the Campaign Manager Import Master flow was not driven through its validation-error paths) | - |
| 3 | Mass Item Update numeric-value message ("a positive number") | **STILL OPEN** (a spike could not select the numeric update field; needs the exact `#UpdateField0` option values - open the job page and read them first) | attempted 2026-10-10 |
| 4 | Load External Filter operator label (base variant) | **RESOLVED**: the base Campaign Manager filter operator list is `Begins With, Contains, Does Not Contain, Does Not Match, Exactly Matches, Greater Than, In, In External Column, Is Blank, Is Not Blank, Less Than, Not In, Not In External File` - i.e. "In External Column" / "Not In External File"; the 2026-09-24 code-inspection note was right, the script text ("Not in External Column") is wrong for the base variant | live read 2026-10-10 |
| 5 | MDM Data Retrieval 1.2 "testable without a separate server" | **RESOLVED**: Data Retrieval filters live-confirmed 2026-10-04 (`Data_Retrieval_Filters.spec.ts`, 3/3) | master-data-management.md |
| 6 | MDM `masterdatacolumntriggers` field-cascade | **STILL OPEN** (needs SQL access to seed a trigger row) | - |
| 7 | `LC_ExportToExcel.docx` (7.0.4 only) | **RESOLVED for 7.0.3**: Label Control has exactly 10 bulk actions (none is Export to Excel), so the script does not apply here | label-control.md "Bulk Actions (10)" |
| 8 | AlphaNumeric Counter / DataMatrix dedicated testing | **STILL OPEN** (the `KeyNotFoundException` bug was fixed 2026-09-30; focused Counters testing the user wanted has not started) | printing.md |
| 9 | Link to Label Master third message variant | **RESOLVED** 2026-10-02 (already marked) | - |
| 10 | Item Edit RTF Editor | **PAUSED by the user** (deprioritized); resume only on request | campaign-manager.md |
