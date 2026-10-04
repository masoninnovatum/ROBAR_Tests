# Exploratory Session Log — ROBAR Print Path

**Charter:** Explore the ROBAR print path (Printing menu — Version Printing / Print by order /
Print by lot / Server Printing) with the MBUser1 test account to discover requirement gaps and
unexpected behaviors, given this is the highest-scored risk area (Score 20, CRITICAL) in
`.agents/risk-matrix.md` with zero E2E coverage today.

**Environment:** `http://vmsrvtst703/innovatum/WebMenu/` → Printing → Print by order, build
**7.0.3.20099**, account `MBUser1`, tested via Claude in Chrome (real Chrome + extension —
switched to this after the in-app Browser pane's per-action permission prompts and screenshot
rendering became blocking; see prior conversation).

**Status: substantially covered.** Reached and exercised the actual print-execution screen
(`/Innovatum/ROBAR/printing/Screens/PrintScreen.aspx`), not just the wrapper.

## Session Log

| Step | Action | Observation | Tag |
|---|---|---|---|
| 1 | Print by order, empty Shop Order Number, click Next | Clean validation: "Order Number is required to proceed." No crash. | NOTE (strength) |
| 2 | Enter `ZZZ-NONEXISTENT-99999`, click Next | Progressed to Item/Lot step with "No Lot found for this order/lot/item combination. **Please fix or continue.**" | QUESTION |
| 3 | Leave Item/Lot blank, click Next twice more | Message changed to "No item found." each time; form never let invalid data through despite the "...or continue" wording | NOTE — see finding 1 |
| 4 | Looked up a real combination via Print History Inquiry: OrderNum/Lot/ItemNumber `MI080301`, Print Entity `England` (not the default `ROBAR`) | Real print history data — 500 prior print records available for this account | NOTE |
| 5 | Reset form, select Print Entity = England, Shop Order Number = MI080301, Next | Auto-populated Lot/Order/Expires/Manufactured/Reassay dates correctly, matching print history | NOTE (strength) |
| 6 | Next again | Reached final print screen: label type "Carton Label - Label Stock" pre-selected, Label Control `LCN:LCN0000324 – TName:A1TemplateMT`, printer `Zebra 220Xiiii Plus (203 dpi)`, Copy=1, Reprint Options block | NOTE (strength — correct data reached the print-execution screen) |
| 7 | Clicked **View** with no option chosen in the adjacent "Select Option" dropdown (chose View over **Print** deliberately — printing would consume real label stock and create a real print/audit record in a regulated environment; did not attempt Print without asking) | Dialog: **"Action not implemented."** | BUG — see finding 2 |
| 8 | Checked browser console after the View click | 43 console messages, dominated by `ReferenceError: Sys is not defined` and `Error: ASP.NET Ajax client-side framework failed to load`, originating from `ScriptResource.axd` itself, and also present on `MainMenu.aspx` (not just the print screen) | NOTE — real, but see correction below |
| 9 | Selected **"View Preview"** from the "Select Option" dropdown, then clicked **View** again | No dialog, no visible change — but Chrome had silently blocked a popup | NOTE |
| 10 | User noticed and unblocked the popup, retried | A new tab opened: `PID_DCFF410108FE4788AC2527C3B8FB59B7.jpg`, a real rendered label image | NOTE (strength) — see finding 3 |
| 11 | Inspected the rendered label image | Item MI080301, Item Version 0, LOT MI080301, REF MI080301, "England", LCN0000324 — all correct and consistent with the source data entered. No expiration/manufacture date or barcode visible on this specific template. | NOTE — see finding 3 |

## Findings

### Finding 1 (minor): Misleading validation message wording
"No Lot found for this order/lot/item combination. **Please fix or continue.**" implies a user
can proceed despite the mismatch. In practice, repeated `Next` clicks with the same invalid data
never let the flow through — it correctly kept blocking with "No item found." The gating itself
works; the copy is what's wrong; it should not say "...or continue" if continuing isn't actually
an option with unresolved data.

### Finding 2 (narrowed): plain "View" (no Select Option) shows "Action not implemented"
- **Symptom:** Clicking **View** on the print-execution screen with the "Select Option" dropdown
  left at its default shows a bare **"Action not implemented"** dialog.
- **Correction from the original writeup:** this is a distinct, narrower issue than first
  reported. It does **not** mean label preview is broken overall — see Finding 3. It's specific
  to whatever the bare `View` button (without a Select Option) is supposed to do.
- The `ReferenceError: Sys is not defined` / `ASP.NET Ajax client-side framework failed to load`
  console errors are real and reproducible, appear site-wide (also on `MainMenu.aspx`, not just
  this screen), and remain worth a follow-up — but their causal link to this specific
  "Action not implemented" dialog is unconfirmed, not proven, now that Finding 3 shows a
  different, unrelated action (View Preview) worked fine via a totally different mechanism
  (direct image URL, no AJAX dependency). Don't assume they're the same bug without checking.

### Finding 3 (strength, corrects prior over-claim): Label preview actually works via "View Preview"
- Selecting **"View Preview"** from the "Select Option" dropdown next to View, then clicking
  **View**, generates a real label image and opens it in a new tab/window
  (`/innovatum/temp/PID_<guid>.jpg`).
- **What looked like a broken feature was Chrome's popup blocker silently swallowing the
  `window.open()` call** — no dialog, no console error, no visible feedback that anything had
  even attempted to happen. Once popups were allowed for the site, the preview opened correctly
  on the very next click, no other change made.
- **This is a tooling/environment artifact of this test session, not a confirmed product bug.**
  The original writeup's claim that "the label preview feature is broken sitewide" was wrong —
  correcting it here rather than leaving it stand.
- **The rendered label itself is correct:** Item `MI080301`, Item Version 0, `LOT MI080301`,
  `REF MI080301`, entity "England", `LCN0000324` — every field matches the source data entered
  earlier in the flow. This is a genuine strength for the CRITICAL print-path risk area.
- **Open question, not a confirmed gap:** no expiration date, manufacture date, or barcode/UDI
  is visible on this rendered label, despite the entry screen capturing Expires/Manufactured/
  Reassay dates. This may simply be this specific test template's (`A1TemplateMT`) design — it's
  a self-referential test fixture (Order=Lot=Item=`MI080301`, "Example MDM Description") — not
  necessarily a real gap. Would need a production-representative template to know whether this
  is expected.

## Coverage

- Print by order — empty/invalid input validation: **Covered** (works correctly)
- Print by order — happy path with real historical data: **Covered** through to the print
  screen, data verified correct
- Label preview via **View Preview**: **Covered — confirmed working**, correct data rendered
- Plain **View** (no Select Option): **Covered — confirmed broken**, cause not yet tied to the
  `Sys`/AJAX errors with confidence
- Actual **Print** execution: **Unexplored** (deliberately deferred — needs explicit go-ahead
  given real-world consequences)
- Other Printing submenu items (Print by lot, Server Printing, DX Printing, etc.): **Unexplored**

## Recommended Follow-Up

1. Determine what the bare **View** button (no Select Option) is supposed to do, and whether its
   "Action not implemented" is a real gap or expected (perhaps it requires a Select Option to be
   chosen first, and the message is just a poor error for "nothing selected").
2. Separately, confirm with whoever owns `vmsrvtst703` whether the `Sys is not defined` /
   `ScriptResource.axd` failure is a known environment issue on this specific test server, or
   reproduces elsewhere — worth investigating on its own merits even though it turned out not to
   explain the View Preview behavior.
3. Ask someone who knows the label template system whether `A1TemplateMT` is expected to omit
   expiration/manufacture dates and a barcode, or whether that's a real template gap.
4. Decide whether to actually exercise **Print** (with explicit sign-off, given it's a real
   physical/audit action).
5. Fix the "No Lot found... Please fix or continue" wording, or confirm there actually is a
   legitimate "continue anyway" path this session didn't find.
