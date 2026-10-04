# Retest — Item Data Compare & Item Translation (informed by formal test scripts)

**Trigger:** the user provided the company's formal test scripts —
`CM_ItemDataCompare-1.24.doc` and `CM_ItemTranslation-1.14.doc` (converted via Word COM
automation to extract text, since neither LibreOffice/pandoc nor a working Python were available
in this environment) — after the original exploratory session flagged both actions as bugs.
Reading them revealed both "bugs" were very likely testing mistakes: Item Data Compare's Job
Submission screen has a required `File Name` field we never filled in, and Item Translation is a
multi-step dictionary-search workflow we never actually drove.

**Environment:** same as before — `http://vmsrvtst703/innovatum/WebMenu/`, build 7.0.3.20099,
account MBUser1, via Claude in Chrome. Session cookies had persisted from the earlier session, so
no re-login was needed.

**Constraint honored:** the user paused this session before any GlobalSettings changes and
explicitly said not to update global settings (they require a ServiceHost restart / IIS reset).
The prerequisite settings both scripts list (`ExcelRowLimit=4`, `CM_ITDictLimit=1000`,
`CM_MDM_Integration=N`) were **not verified** — the Global Settings Management tab was opened and
closed without reading or changing anything, per that instruction.

## Setup

Created two fresh items via the same `create-robar-item` pattern as before: **TESTCM004** and
**TESTCM005**, both Carton Label / A1SuperTemplate / unapproved — clean state for both retests.

## Retest 1: Item Data Compare

Selected TESTCM004 + TESTCM005, action "Item Data Compare" → Do Action. This time the Job
Submission screen was filled out completely and correctly, matching the formal script's
described fields exactly:
- Job Description: `TESTCM Item Data Compare retest`
- File Name: `TESTCM_IDC_Retest`
- "Include Items without changes" checked (since these are fresh items with no version history)

**Result: still fails.** Job reached `Status: Error`, 100% complete, identical message:
`"External table is not in the expected format."` — the exact same error as the original session,
now with the required field present.

**Conclusion: Finding 1 is a confirmed, real bug**, not a testing mistake. Ruling out the missing
File Name field as the cause makes this a stronger finding than the original — whatever underlying
file/OLEDB operation the job performs fails regardless of correct input. (Note: the
`ExcelRowLimit` GlobalSetting prerequisite was not verified per the constraint above — if that
setting is misconfigured on this server, it could be a contributing factor, but that's an
unconfirmed hypothesis, not something this retest could check.)

## Retest 2: Item Translation

Selected TESTCM004 + TESTCM005, action "Item Translation" → Do Action. This time the actual
multi-step workflow was followed:
1. An error dialog (`"Service Error: The provided Dictionary criteria was invalid."`) appeared
   immediately on page load, before any search — this fires automatically because the dictionary
   grid attempts to load with blank filter criteria. Not itself a bug; the screen expects you to
   search before it has data. (Arguably still worth a UX note: an unprompted error on page load,
   before the user has done anything, reads as broken on first glance.)
2. Used the filter (Column: Phrase, Operator: Contains, Value: "a"), checked "Include Unapproved",
   clicked "Get Translations" — the Dictionary Translations table populated correctly with 73
   real records.
3. Clicked the "Achtung" translation row, checked both TESTCM004 and TESTCM005 in the Items
   table, left "Description 2" as the target field, clicked "Populate Phrase".
4. **"Achtung" appeared in red in the Description 2 column for both items** — exactly the
   behavior the formal script describes.
5. Clicked Submit → e-signature dialog (Job Description, UserName, Password, Reason Code,
   Comment) → filled and submitted.

**Result: Status Completed, 100%**, both items listed correctly in the job detail.

**Conclusion: Finding 2 was entirely our own testing mistake.** The feature works correctly.
We had simply never discovered the dictionary-search step in the original session, so the
Populate Phrase control never had anything to populate with.

## Updated Status

| Original Finding | New Status |
|---|---|
| Finding 1 — Item Data Compare OLEDB error | **Confirmed real bug** (upgraded — ruled out our own mistake as the cause) |
| Finding 2 — Item Translation silent no-op | **Retracted — was a testing mistake**, not a defect |

## Timing

- Retest session wall-clock: **12:08:19 → 12:18:32 (10 minutes 13 seconds)**, covering: reading
  both formal scripts (Word COM extraction), correcting the prior findings doc, creating 2 fresh
  test items, and fully retesting both actions including one full e-signature submission.
- Not a like-for-like comparison to the original session's total time — that session covered item
  creation ×3, an approval, and all 11 bulk actions (a much broader scope) interleaved with
  significant one-time friction (in-app Browser pane failures, permission-prompt troubleshooting,
  a browser-surface switch). This retest had none of that friction and a narrower, precisely
  targeted scope, so the ~10 minute figure isn't a fair per-action multiplier against the
  original run — see the direct answer given in chat for the qualitative comparison.
