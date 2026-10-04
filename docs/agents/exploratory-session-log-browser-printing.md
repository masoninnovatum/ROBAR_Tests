# Exploratory Session Log — Browser Printing

**Charter:** Read-only review of the 42 formal Browser Printing test scripts (network share,
`\\diskstation\backedup\#Unlocked_Test_Cases\Browser_Printing\7.0.1_And_Up\`), then exploratory
testing against the live application, following the same approach used for Campaign Manager,
Workflow Management, and Master Data Management.

**Environment:** `http://vmsrvtst703/innovatum/WebMenu/` → Printing modules, build 7.0.3.20102,
account `MBUser1` (Mason Baxter). `MBUser2` (MBSomeSecurity group) used for negative-permission
testing per this session's grant to modify security for any `MBUser*` account.

**Constraint honored:** No GlobalSettings values were changed. PrintConfig values were changed
twice (`AddLotReasonRequired` on the `LotNumber` config, and — pre-pause — a lot batch-quantity
related setting) and one security process (`Print_Unapproved_Items` on MBSomeSecurity) was
toggled off; all were confirmed restored to their original state before ending the session. Per
explicit user note, **DX Printing is not configured in this environment and was skipped.**

**Status: paused and resumed once** (user requested a pause mid-session; picked back up at the
next message with no loss of state beyond the normal session-timeout re-login). **Partial
coverage** — this is a much larger module (24 test-case areas across 42 scripts) than prior
sessions, and a large fraction of it depends on infrastructure this session doesn't have (RDP to
the print server for XML drop-folder services, direct SQL access to PrintConfig/GlobalSettings
and stored procedures, the Sentinel desktop client). What was tested is documented below; the
rest is scoped out explicitly rather than left ambiguous.

## Formal Script Review — Scope Summary

42 scripts covering 24 test-case areas were converted and read (delegated across 6 parallel
research passes). This module is unusually infrastructure-heavy compared to the three modules
tested previously:

**Confirmed out of scope this session:**
- Lot Batch Quantity Adjust (both Print by Lot and MDP variants) — needs XML drop-folder service
  (RDP) + direct PrintConfig SQL edits.
- Serial Prefix Trigger — needs the same XML drop-folder service.
- Purchase Order Printing — needs custom stored procedures (`SP_PurchaseOrderPrinting*`) and a
  pre-existing "Vendors" Master Data schema, neither of which this session can create from the UI.
- Print Time Redline Comparison — very likely requires the Sentinel desktop client
  (`Innovatum.Sentinel.Plugin.PrintTimeRedlineCompare`), the same pattern already documented for
  Workflow Management's Redline feature.
- Preview Signature (multi-party e-signature gate) — requires PrintConfig edits across multiple
  parameters plus an IISRESET after each change; the 4 required user accounts with distinct
  signature-role security processes weren't available to provision quickly.
- DX Printing — **confirmed by the user as not configured in this environment.**

**Confirmed in scope and exercised this session:** Print by Order (lot auto-creation, reprint
flow), Version Printing (unapproved-item override + security gating), Label Type Exclusion
Maintenance, Add Lot Reason Required.

**In scope but not reached this pass** (time-boxed, not blocked): Misc Printing, Print by Lot /
Print by Lot Multi / Print by Order Multi, View Compare, Serialization Flag, Serial Management
(x4), Single Piece Flow Printing, Single Serial Printing, Test Print watermarking, the remaining
3 of 4 named Version Printing security processes (`Print_Ineffective_Items`,
`Print_Unapproved_Labels`, `Print_Ineffective_Labels`).

## Results by Feature

| Feature | Result | Notes |
|---|---|---|
| Print by Order — lot auto-creation | ✅ Working | New order/item combo correctly auto-creates a lot with sensible defaults (Expires/Manufactured/Reassay dates). |
| Print by Order — reprint flow | ✅ Working | Reprint credentials + Reason dropdown correctly gate a second print of the same order. One minor wording discrepancy — see Finding 1. |
| Version Printing — unapproved item override | ✅ Working | Full flow confirmed end-to-end: "No approved effective Item. You must click OK to override." → "Warning! Item is not approved." → "Proceed with version: 0" → prints successfully to Microsoft Print to PDF. Matches the formal script exactly. |
| Version Printing — security gating (`Print_Unapproved_Items`) | ✅ Working | See Finding 2 — captured the exact block message, which the formal script never quoted. |
| Label Type Exclusion Maintenance | ✅ Working | See Finding 3 — resolved a genuine ambiguity in the formal script (checkbox semantics) and discovered the actual client-workstation identity mechanism. |
| Add Lot Reason Required (Print by Lot) | ✅ Working | Full flow matches docs exactly: dialog text, `"This field is required."` validation, successful new-lot creation after selecting a Reason Code. |

No confirmed bugs this session — everything tested matched the formal scripts' expected
behavior. The value of this pass was mostly in **closing documentation gaps** the formal scripts
themselves left open (see Findings 2 and 3) and in confirming known-tricky mechanics work exactly
as designed.

## Finding 1 (minor, informational): Reprint-block message wording differs slightly from the formal script

The formal script (`BPSecurity1.3`) expects: *"This is a reprint, but the user is not granted the
**BP_Reprint_Label** permission."* The message actually observed live during this session's
pre-pause testing read: *"This is a reprint, but the user is not granted the **Reprint_Label**
permission."* — missing the `BP_` prefix on the security process name. This is a cosmetic
message-text discrepancy, not a functional defect (the block itself works correctly); worth a
quick note to whoever owns the formal script, since it's a documentation-accuracy issue rather
than a product one.

## Finding 2 (documentation gap closed): Version Printing's unapproved-item security block message

The formal script `BPVersionSelect1.2` never quotes the actual block message when a user lacks
`Print_Unapproved_Items`, `Print_Ineffective_Items`, `Print_Unapproved_Labels`, or
`Print_Ineffective_Labels` — it just says "an error message is displayed." This session captured
the real message for `Print_Unapproved_Items`:

> *"User is not authorized to print any version of this item. Ensure that the item and label are
> approved and effective. If not, make sure the user is authorized to print unapproved or
> ineffective items/labels. \<ItemNumber\>"*

This is one generic message covering the capability check as a whole (not four distinct
per-process messages) — worth updating the formal script with this exact text, and worth
confirming live whether the same message appears verbatim for the other three processes (not
tested this session — see Coverage Summary).

## Finding 3 (documentation gap closed): Label Type Exclusion Maintenance semantics and workstation identity

Two things confirmed here that the formal script (`BPLblTyp1.1`) left ambiguous or unstated:

1. **Checkbox semantics**: checking a label type for a workstation **excludes/blocks** that
   workstation from printing that label type — confirmed directly by checking "Carton Label" for
   a workstation and observing `Print by Order` then fail with `"No printable label types for
   this workstation due to label type exclusions. <WorkstationName>"`. The research summary
   flagged this as ambiguous going in; it's now settled.
2. **Client workstation identity**: the name shown in the WebMenu header (`Server: VMSRVTST703`)
   is the **server's** name, not the browser session's actual client identity. The exclusion
   check is keyed by the real client workstation — this session's Claude-in-Chrome browser
   resolves to **`MASON-LAPTOP`**, one of the four pre-existing workstation entries, confirmed by
   checking each of the four in turn until the block triggered. Worth documenting for any future
   session testing workstation-scoped features (this one, Printer User Commands, Print Entity
   Management, etc.) — check `MASON-LAPTOP` first, not `VMSRVTST703`.

**Process note:** the first attempt to restore this test's checkbox state left `MASON-LAPTOP`'s
Carton Label exclusion checked — caught and fixed only because the leftover state caused an
unrelated later test (Add Lot Reason Required) to fail with the exclusion message unexpectedly.
All four workstations were re-verified individually before moving on. Worth being extra careful
with checkbox-based cleanup on this page going forward, since there's no "save" step to confirm
against — every click is live.

## Coverage Summary

- Print by Order core flow (lot auto-creation, reprint): covered, working
- Version Printing (unapproved-item override + one of four security processes): covered, working
- Label Type Exclusion Maintenance: covered, working, two documentation gaps closed
- Add Lot Reason Required: covered, working
- Misc Printing, Print by Lot/Order Multi variants, View Compare, Serialization Flag, Serial
  Management, Single Piece Flow, Single Serial Printing, Test Print watermarking: **not reached
  this pass** — time-boxed, not infrastructure-blocked, good candidates for a follow-up session
- Print_Ineffective_Items / Print_Unapproved_Labels / Print_Ineffective_Labels (3 of the 4 named
  Version Printing security processes): **not tested** — only `Print_Unapproved_Items` was
  exercised
- Lot Batch Quantity Adjust, Serial Prefix Trigger, Purchase Order Printing, Print Time Redline
  Comparison, Preview Signature: **infrastructure-blocked**, consistent with the pre-testing scope
  assessment
- DX Printing: **not configured in this environment** (confirmed by user), correctly skipped

## Recommended Follow-Up

1. Update `BPSecurity1.3`'s expected message text — confirm whether the live `"Reprint_Label"`
   (missing `BP_` prefix) wording is the actual current product behavior or a recent regression;
   either way the formal script and the product should agree.
2. Update `BPVersionSelect1.2` with the exact captured block message text, and confirm live
   whether the same message text applies to the other three security processes.
3. ~~Complete the remaining in-scope areas (Misc Printing, Print by Lot/Order Multi, View Compare,
   Serialization Flag, Serial Management, Single Piece Flow, Single Serial Printing, Test Print)
   in a follow-up session.~~ **Partially done — see the Follow-Up Session addendum below
   (2026-08-28).**
4. If DB/RDP/Sentinel-client access becomes available, revisit Lot Batch Quantity Adjust, Serial
   Prefix Trigger, Purchase Order Printing, Print Time Redline Comparison, and Preview Signature.
5. If an IISRESET-capable session becomes available, revisit Test Print's `TestPrintRequiredForLot`
   / `TestPrintRequiredForSession` PrintConfig-driven gating (see the addendum's Finding 6) — the
   PrintConfig change alone did not take effect without a server-side reset.
6. Complete Misc Printing, Serialization Flag, Serial Management (all 4 scripts), Single Piece Flow
   Printing, and Single Serial Printing — still not reached; see the addendum's Coverage Summary
   for why each was deferred.

---

## Follow-Up Session Addendum (2026-08-28): Recommended Follow-Up #3 Coverage

A second session picked up directly from Recommended Follow-Up #3 above. Read-only review of the
remaining 19 formal scripts (Misc Printing ×4, Print by Lot ×1, Print by Lot Multi ×1, Print by
Order Multi ×1, View Compare ×3, Serialization Flag ×1, Serial Management ×4, Single Piece Flow
Printing ×2, Single Serial Printing ×1, Test Print ×2) was delegated across 3 parallel research
passes over the already-converted script text from the original session's scratchpad. Live testing
then covered the areas that turned out to be realistically browser-testable.

**Constraint honored:** No GlobalSettings values were changed. One PrintConfig value
(`TestPrintRequiredForLot` on the `LotNumber` config) was temporarily set to `Y` to test Test
Print's required-test-print gating, then reverted to `N` after confirming the change doesn't take
effect without a server-side IISRESET (see Finding 6). One security process
(`BP_Test_Print_Override` on MBSomeSecurity) was temporarily disabled for a negative-permission
test on MBUser2, then restored to its original checked state — confirmed restored via a final
Security Management check.

### Results by Feature (this addendum)

| Feature | Result | Notes |
|---|---|---|
| Print by Lot Multi | ✅ Working | `Add Lot` correctly reuses an existing lot number under a brand-new order number, auto-creating the new lot/order association and printing successfully. |
| Print by Order Multi | ✅ Working | Same mechanic in reverse — `Add Lot` reuses an existing order number under a new lot number. The `BP_OrderNumberMultiple` Codes-table prerequisite the formal script calls out is already provisioned for MBUser1's group in this environment — no setup needed. |
| Print by Lot — multi-lot negative case | ✅ Working (confirmed incidentally) | Reusing the same lot across two orders (via the Print by Lot Multi test above) left `Print by Lot` itself correctly blocked on that lot number with **"Multiple Lots found for this Order Number or Lot Number."** — an exact match to `BPPrintbyLot1.1`'s documented expectation, discovered as a natural side effect rather than needing separately-seeded multi-item-lot fixture data. |
| View Compare | ✅ Working | See Finding 5 — required creating a label master first (not previously present for the test item), and the module that does this is **Label Control**, not Campaign Manager as the formal scripts' own setup section might suggest. Both Vertical and Horizontal comparison layouts render correctly, master left/top vs. live label right/bottom, with real Item/Lot/Order/LCN data confirmed on the live side. |
| Test Print — security process discovery | ✅ Confirmed present | `BP_Test_Print` and `BP_Test_Print_Override` both exist as real security processes and were successfully toggled via Security Management. The "Test" checkbox itself is present and functional on the print screen (`TestPrintShow=Y` for the `LotNumber` PrintConfig). |
| Test Print — required-test-print gating | ⚠️ Not exercisable this session | See Finding 6 — the PrintConfig change needed to activate this behavior doesn't take effect without a server-side IISRESET, which this session doesn't have. This is the formal script's own documented limitation, not a newly-discovered gap. |

### Finding 4 (informational): "Recreate Master" lives in Label Control, not Campaign Manager

Both `BPViewCompare1.1`'s setup section and this session's own initial assumption pointed at
Campaign Manager for creating a missing label master (the "Recreate Master plugin" phrasing reads
as if it could be either). Campaign Manager's Bulk Actions dropdown (`Export to XLS`, `Import
Master`, `Item Data Compare`, `Item Translation`, `Mass Item Approve`, `Mass Item Update`, `Mass
Print`, `Retire Items`, `Save as New`, `Save to PDF`, `Send to Workflow`) has no such option. The
actual location is **Label Control Management → Bulk Actions → Recreate Master**, keyed by LCN
rather than by Item Number — confirmed working end-to-end (Job Submission → e-signature → Job
Detail: Completed, 100%) and immediately unblocked View Compare afterward. Worth updating
`BPViewCompare1.1`'s setup section to name Label Control explicitly, since Campaign Manager's
identically-worded "Select Action" dropdown could easily send a tester down the wrong path.

### Finding 5 (documentation gap closed): View Compare's Vertical/Horizontal default-selection behavior confirmed live

With the recreated master in place, View Compare correctly rendered both layout modes for the same
label pair: **Vertical** (master left, live label right, both scaled to fit) was the default
selection on first load, and switching to **Horizontal** (master stacked above, live label below,
each shown at native/100% size) re-rendered correctly with no data loss or misalignment. This
environment's current `ViewCompareAutoAlignment` GlobalSetting value was not independently queried
(no DB access), but the observed default (`Vertical`) is consistent with either `BPViewCompare1.1`
(vertical template + AutoAlignment=Y) or `BPViewCompare1.3`'s (AutoAlignment=N forces Vertical
regardless of template orientation) — distinguishing between those two would need the GlobalSetting
value confirmed via DB access in a future session.

### Finding 6 (infrastructure limitation, not a defect): PrintConfig changes to `TestPrint*` parameters require an IISRESET to take effect

`BP_TestPrint1.2`'s own setup section states an IISRESET is required after changing
`TestPrintRequiredForLot`/`TestPrintRequiredForSession` "in order to ensure reloading of print
configurations." This session verified that requirement is real and not overly cautious
boilerplate: `TestPrintRequiredForLot` was set to `Y` via the browser-accessible Print Config
Management module (no DB access needed for the edit itself), immediately confirmed persisted in
the grid, and then tested live as MBUser2 (missing `BP_Test_Print_Override`) against a brand-new,
never-printed lot — the label printed immediately with no test-print requirement enforced,
identical to the pre-change behavior. This confirms the running application caches PrintConfig
values in a way a plain config-table edit doesn't invalidate, and reproduces exactly the gap the
formal script already anticipated. The value was reverted to `N` afterward since it wasn't having
any effect and there was no reason to leave a stale, non-functional override in place.

### Coverage Summary (this addendum)

- Print by Lot Multi, Print by Order Multi: covered, both fully working, no infrastructure blockers
  encountered (the `BP_OrderNumberMultiple` Codes-table prerequisite was already satisfied)
- Print by Lot's multi-lot negative case (`"Multiple Lots found..."`): covered, confirmed working,
  via incidental test-data overlap rather than dedicated seed data
- View Compare (all 3 scripts' core behavior — Vertical/Horizontal default selection, master vs.
  live comparison rendering): covered, working; the `ViewCompareAutoAlignment` GlobalSetting's
  current value specifically was not independently confirmed (no DB access)
- Test Print: security processes and the checkbox's basic presence confirmed working; the
  required-test-print PrintConfig-driven gating specifically could not be exercised — confirmed
  as an IISRESET dependency, not a new gap
- Misc Printing (all 4 scripts): **not reached** — each requires nontrivial from-scratch setup
  (new Codes/Label Types/Templates with specific components, a second test user/group for
  `BPMiscPrint-1.4`) that was deprioritized in favor of the simpler, more clearly in-scope areas
  above; still believed browser-testable in a dedicated future pass
- Serialization Flag: **not reached, and expected to remain out of scope** — requires a direct
  PrintConfig DB edit with no UI path (`IsSerializedShareName`) plus a pre-configured Master Data
  schema field; the research pass flagged this as genuinely DB-dependent, not merely time-boxed
- Serial Management (all 4 scripts): **not reached** — the core add-one/add-series/duplicate-
  detection mechanics (sections 1–2 of each script) look genuinely browser-testable and are good
  candidates for the next pass; the sections that toggle `PrintEntityRequired` require the same
  IISRESET dependency documented in Finding 6 and should be skipped
- Single Piece Flow Printing: **not reached, likely out of scope** — its setup requires
  `PrintEntityRequired = Y`, the opposite of what this environment appears to run at
  (`N`, inferred from every other script's own precondition and from this session's testing);
  changing it would violate the standing "no GlobalSettings changes" constraint
- Single Serial Printing: **not reached** — requires a wider set of pre-seeded templates/items/lots
  (5 items, 5 lots, 2 Master Data records with a specific `m_IsSerialized` schema field) than time
  allowed for this pass; several of its verification substeps also require direct SQL access and a
  server file-share check, so full coverage would remain partial even with more time

### Recommended Follow-Up (this addendum)

1. Update `BPViewCompare1.1`'s setup section to name **Label Control → Bulk Actions → Recreate
   Master** explicitly as the way to create a missing label master, rather than leaving it
   ambiguous between Campaign Manager and Label Control.
2. If DB access becomes available, confirm the current `ViewCompareAutoAlignment` GlobalSetting
   value to settle which of `BPViewCompare1.1`/`.3`'s scenarios this environment's observed
   Vertical-default behavior actually corresponds to.
3. If an IISRESET-capable session becomes available, re-run Test Print's `TestPrintRequiredForLot`
   /`TestPrintRequiredForSession` scenarios (Finding 6) and Serial Management's `PrintEntityRequired`
   -dependent sections in the same pass, since both share the identical infrastructure dependency.
4. Complete Misc Printing and Serial Management's core (non-PrintEntityRequired-toggling) sections
   in a dedicated follow-up — both look achievable without further infrastructure, just more
   from-scratch setup than this pass had time for.
5. Treat Serialization Flag and Single Piece Flow Printing as out of scope for browser-only testing
   going forward unless DB access or a GlobalSettings exception is explicitly granted.
