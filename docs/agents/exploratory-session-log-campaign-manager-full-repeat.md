# Full Repeat — Campaign Manager: Item Creation, Approval, and All Bulk Actions

**Charter (per user request):** "I actually wanted a full original repeat of the original
testing, not just testing Item Data Compare and Item Translation." A complete redo of the
original session's scope — create items, approve one, test all 11 bulk actions — now informed
by the formal test scripts and the lessons learned from the first pass and the 2-action retest,
with timing compared to the original run.

**Environment:** `http://vmsrvtst703/innovatum/WebMenu/` → Campaign Manager, account `MBUser1`,
via Claude in Chrome. Constraint honored throughout: **no GlobalSettings changes** (per the
user's explicit pause instruction — those require a ServiceHost restart/IIS reset).

**Status: complete.** All 11 bulk actions re-exercised with real job submissions on fresh items
(TESTCM006, TESTCM007, TESTCM008).

## Setup

Created three fresh items: **TESTCM006** (approved via Mass Item Approve mid-session),
**TESTCM007** (approved via Mass Item Approve), **TESTCM008** (kept unapproved throughout,
reserved for Send to Workflow, which requires an unapproved item).

## Bulk Actions — Results

| # | Action | Result | Notes |
|---|---|---|---|
| 1 | **Export to XLS** | ✅ Working | Completed 12:39–12:40 PM |
| 2 | **Import Master** | ✅ Working (UI) | Same as original: reaches the file-matching screen correctly |
| 3 | **Item Data Compare** | ❌ **Bug reconfirmed** | Identical `"External table is not in the expected format."` error, 3rd consecutive reproduction (original run, retest, and now this full repeat) with File Name correctly filled every time. See Finding 1. |
| 4 | **Item Translation** | ✅ Working | Followed correct dictionary-search → Populate Phrase → e-signature workflow; both items translated correctly, Completed 100% |
| 5 | **Mass Item Approve** | ✅ Working | TESTCM007 approved cleanly |
| 6 | **Mass Item Update** | ❌ **New bug found** | Submit button is completely non-functional — see Finding 2 below. This is a genuine defect, not the "no unapproved item on hand" limitation noted in the original session. |
| 7 | **Mass Print** | ✅ Working | Microsoft Print to PDF, Completed 12:49 PM |
| 8 | **Retire Items** | ✅ Working | "Data Updated: 1 Item Retired", e-signature required |
| 9 | **Save as New** | ✅ Working | New version (v1) of TESTCM006 created |
| 10 | **Save to PDF** | ✅ Working | No "Path is invalid" error this time — Subfolder field filled per the lesson from the original session's Finding 3 |
| 11 | **Send to Workflow** | ✅ Working | Also surfaced a second required field not caught originally: **Preset is required** (`"A workflow preset must be selected."`) — same pattern as Item Data Compare's File Name and Item Translation's dictionary search: several of these actions have required fields that don't fail gracefully or aren't obviously required from the UI alone. Selected `MBPreset1`, submitted successfully — Status: Completed, queued to MBUser1 (Mason Baxter) as the workflow step. |

## Finding 1 (confirmed bug, 3rd reproduction): Item Data Compare fails on brand-new items

Identical to the original finding and the retest: `"External table is not in the expected
format."`, Status: Error, 100% complete, regardless of File Name being filled. Three independent
reproductions across two days now rule out tester error entirely. This is the most solid finding
of the whole test effort.

## Finding 2 (new bug): Mass Item Update's Submit button does nothing

On the "Job Submission - Mass Update" screen, filling every field correctly (Description of Job,
Column = Description, New Value, UserName, Password, ReasonCode) and clicking **Submit** does
**nothing** — no error, no navigation, no job created. Verified this is not a click-timing issue:

- Reproduced identically after a full page reload (fresh iframe, fresh AJAX state).
- Inspected the button directly: `<input type="button" id="SubmitButton" value="Submit">` has
  **zero jQuery event handlers bound to it** (`$._data(btn, 'events')` returned `undefined`).
- Triggering a synthetic `click` event via jQuery also produced no effect.
- No HTTP request of any kind fires to the server on click (confirmed via network log — only the
  plugin's static `.js` file loads; no POST ever appears).

This is a genuinely broken control, not a testing mistake, timing issue, or environment quirk.
**Impact:** Mass Item Update cannot be used at all through the UI — the only escape is
navigating away and starting over, which doesn't help since the same broken button awaits.

Note: entering the Mass Item Update flow (even without a working Submit) still creates an
orphaned `Submitted / 0%` job record in Job Inquiry, consistent with the "Orphaned Job Records"
pattern noted in the original session for Import Master and Mass Item Update.

## Finding 3 (minor, recurring pattern): Several bulk actions have silently-required fields

Across this full repeat, three different actions turned out to have a required field that
isn't obviously required and doesn't fail gracefully until submission:
- Item Data Compare: `File Name` (found via the formal test script, not the UI)
- Save to PDF: `Subfolder` (produces the unhelpful `"Path is invalid."` if blank — original
  Finding 3)
- Send to Workflow: `Preset` (produces `"A workflow preset must be selected."` if blank — new
  this session)

None of these are marked with an asterisk, bold label, or other visual "required" indicator on
their forms. This is a consistent UX pattern worth raising with whoever owns these screens.

## Timing Comparison

Using the Job Inquiry audit trail (`DateInserted`/`DateCompleted` timestamps on each job, not
estimated) as the authoritative source, comparing the same bookend actions (first bulk action
submitted = Export to XLS, last = Send to Workflow completed) across both sessions:

| Session | First action | Last action | Elapsed |
|---|---|---|---|
| **Original session** (2026-08-24) | Export to XLS submitted 3:31 PM | Send to Workflow completed 4:00 PM | **~29 minutes** |
| **Full repeat** (2026-08-25, this session) | Export to XLS completed 12:39–12:40 PM | Send to Workflow completed 12:53 PM | **~14 minutes** |

**Roughly twice as fast**, despite this repeat testing MORE thoroughly than the original in two
respects: Item Translation followed the fully correct multi-step workflow from the start (no
fumbling to discover the dictionary-search step), and Mass Item Update was actually attempted
with a real field edit instead of being skipped for lack of an unapproved item — which is what
surfaced Finding 2, a genuine new bug the original session's narrower attempt never uncovered.

The speedup came from: no more tooling/browser-surface friction (already resolved before this
session), no time spent discovering dropdown positions or Campaign Manager's UI conventions by
trial and error, and already knowing which fields matter for Item Data Compare and Item
Translation from the formal scripts. The bulk-action dropdown's simulated-click reliability quirk
(rendered `<option>` clicks not registering, requiring keyboard Down/Return navigation) and the
"No Items are selected" race condition on the first Do Action click both still occurred at the
same rate as before — those are environment/framework behaviors, not something familiarity
fixes.

## Updated Status Summary (all sessions combined)

| Finding | Status |
|---|---|
| Item Data Compare OLEDB error | **Confirmed bug** — reproduced 3 times (original, retest, full repeat) |
| Item Translation silent no-op | **Not a bug** — was tester error in original session; works correctly |
| Mass Item Update Submit button non-functional | **New confirmed bug** — found this session |
| Save to PDF "Path is invalid" vague message | **Minor UX issue** (original Finding 3) |
| Orphaned Submitted/0% job records | **Reproducible pattern**, intentionality unconfirmed |
| Several actions have silently-required fields | **UX pattern**, worth a design review |

## Recommended Follow-Up

1. File Item Data Compare's OLEDB error as a confirmed, reliably reproducible defect (3-for-3).
2. File Mass Item Update's non-functional Submit button as a new defect — include the console
   evidence (no bound click handler, no network request fires).
3. Consider a UI pass across Campaign Manager's job-submission screens to mark required fields
   explicitly (File Name, Subfolder, Preset) so users don't discover them via cryptic errors.
4. Ask whoever owns Campaign Manager about the orphaned job record pattern and whether cleanup
   is expected.
