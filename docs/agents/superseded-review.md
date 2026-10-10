# Statements in robar-module-reference.md that are probably superseded (review list, 2026-10-09)

Line numbers refer to the ORIGINAL file. Nothing has been changed except the two banners in `printing.md`.

| Original line | Statement | Newer evidence | Suggested action |
|---|---|---|---|
| 2011 | "Test Print ... did NOT complete under automation" | Test Print works with the headed real-click flow (block "Print by Order / Print by Lot vs ValMaster", `Print_Request_Test_Print.spec.ts`) | banner added in draft; also soften the matching DIT report row "Print by Lot - Test Print" |
| 4898 | block title "NOT yet tested live" (batch quantity) | verified blocks right below it | banner added in draft |
| 2212-2220 | "Not yet tested" list for Browser Printing (Misc Printing, Serial Management, Single Serial Printing) | Serialized items / templates now exist (`Userial_na`, `SingleSer_na`, items MBBQU5000105 / MBBQR5071799) and Serial Number Management panel was seen | trim the list; Serial Management still untested |
| ~2532-2620 (Dictionary Management) | Unretire resets Effective Begin / Retire works on unapproved listed as findings | Dictionary requirements re-check: BY DESIGN (F.8.16, F.8.7-F.8.9) | the draft keeps both; the re-check block says SETTLED (line 98 of dictionary-management.md) - ok, maybe move the "SETTLED" note up |
| lot-creation wording (Print by Lot / Browser Printing) | lots are created at print time | the lot is created when the Lot Panel appears (placeholder dates 01/01/1900); unprinted lots can be deleted in Lot Management | check wording in Print by Lot section and Lot Management section |
| 930 and 1138 | two sections both titled "Master Data Management (MDM)" | probably the 6.x / 7.x passes | merge under one heading in the final file (kept apart in the draft) |
| "lots / items / codes cannot be deleted" (various) | lots CAN be deleted until printed (unprinted lots, Lot Management delete) | `Lot_Management.spec.ts`, cleanup specs | qualify the wording |

Not found / not checked: statements outside these topics. A full contradiction sweep would need a read of all 570 KB; the per-module split makes that feasible module by module.

## Resolved 2026-10-09
- Test Print / "NOT yet tested live" banners: added in modules/printing.md.
- "Lots cannot be deleted": WRONG - printed lots are deletable in Lot Management; correction block appended to modules/lot-management.md; spec comments and the robar-module-training skill updated.
- Browser Printing "Not yet tested" list and the MDM duplicate headings: see below (notes added in place).
- Browser Printing "Not yet tested" list: update note appended to modules/printing.md.
- Two Master Data Management sections: explanatory note appended to modules/master-data-management.md (not merged, to keep the text lossless).
- Dictionary "settled by requirements" ordering: read-first note appended to modules/dictionary-management.md.

Still open for a human decision: the formal "Open To-Dos" list in modules/00-overview-and-todos.md (never re-reviewed), and statements outside the topics above (a full read-through per module would be needed).
- Open To-Dos list (modules/00-overview-and-todos.md): reviewed 2026-10-10 - items 4, 5, 7, 9 resolved, item 1 narrowed, items 2, 3, 6, 8, 10 still open (status table appended to that file).
