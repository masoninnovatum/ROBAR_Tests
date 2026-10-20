# ROBAR module suite - inventory of tests and actions

Generated 2026-10-19 by scripts/list-suite-tests.js: 180 spec files, 194 tests, 791 named steps (test.step titles; template-literal steps show their raw text). Specs without named steps do their actions inline: read the spec file for the click-level detail.

## Attachment-Management

### Attachment_Management_Requirements.spec.ts

- **Test:** Attachment Management vs ValMaster: web-menu entry, filters, Advanced Options, grid, pager, row Actions, Edit Attributes, View / Download

  Steps / actions:
  1. F.12.1 - F.12.4: the icon is on the web menu under Document Control
  2. F.12.20: opened from the web menu, the Link button is disabled; F.12.7 Retrieve Data; F.12.5 add / remove filters
  3. F.12.8 / F.12.9 / F.12.15: the grid of the uploaded files, View x-x of x
  4. F.12.10 / F.12.9 / F.3.7 / F.3.13 / F.1.4: Advanced Options (available / selected lists, Limit Results) and the AttachmentFiles columns of the uploaded rows (FileID, Sequence 0, Active Y)
  5. F.12.13: "No records to view" for an attachment that does not exist
  6. F.12.12 / F.16.1 / F.19.1 / F.12.21: row Actions offer View, Download and Edit Attributes; Edit Attributes popup (File Purpose, Attachment Group, Param1, Param2) on an MB row
  7. F.16.2 / F.19.4: View opens the document, Download offers a file (behavior of the two actions on the MB text file)

### Attachment_Management_Security.spec.ts

- **Test:** Attachment tiles and row actions follow AM_/Attach_Upload_View and FP_Approvals_* (MB group only)

### Attachment_Upload_Requirements.spec.ts

- **Test:** Attachment Upload vs ValMaster: grid, File Purpose list, popups, excluded extensions, Reset, a real two-file upload

  Steps / actions:
  1. F.1.5 / F.1.6: excluded extension list (default .EXE, .DLL, .CHM, .SQL, .COM) and the message for a blocked file
  2. F.3.1 - F.3.10: Browse, grid columns, FileName copied to Description, pre-selected check boxes, Select All, deselect, Reset
  3. F.4.1 - F.4.7: File Purpose drop-down (Select Purpose first, configured list), Missing File Purpose tooltip
  4. F.4.6 / F.5.2 / F.5.3: Apply-to-all popups for File Purpose, Param1 and Param2 (Yes / No, do not show again)
  5. F.3.11 / F.3.12 / F.3.13 / F.3.14 / F.1.3 / F.1.4 / U.3: a real upload of two tiny files with an Attachment Group (nothing else is uploaded)

### Link_Management_Actions.spec.ts

- **Test:** Link Management actions: Link By LCN / Item / Item Version / Template / Template Version, View, Download, Edit, Detach

  Steps / actions:
  1. setup: create and approve a Campaign Manager item
  2. setup: assign a Label Control Number to the item
  3. setup: upload one new attachment (Attachment Upload tile)
  4. Link By LCN, then View / Download / Edit on the Link Management row, then Detach
  5. Link By Item, Detach
  6. Link By Item Version, Detach
  7. Link By Template, Detach
  8. Link By Template Version, Detach

### Link_Management_Requirements.spec.ts

- **Test:** Link Management vs ValMaster: menu, filters, includes, grid, associate drop-down and the three Link pages (read-only)

  Steps / actions:
  1. F.3.1 / F.3.2 / F.4.1 - F.4.4: tile, Document Control section, filters, Include check boxes
  2. F.5.6 - F.5.12: grid only after Retrieve Data; No records to view; hierarchy Items -> Templates -> LCNs; pager; row Actions
  3. F.6.1 / F.6.5 / F.7 / F.9 / F.11: Associate Attachments drop-down options and the pages they open

### Link_Management_Security.spec.ts

- **Test:** Link Management tile, Associate drop-down, Detach and row actions follow their processes (MB group only)


## Browser-Printing

### Add_Lot_Reason_Required.spec.ts

- **Test:** AddLotReasonRequired: the Reason Code dialog on the print screens

  Steps / actions:
  1. ${s.tile}: new ${s.order ? 'order' : 'lot'} -> Reason Code dialog; empty Submit refused; Close dismisses it
  2. Print by lot: a reason + comment lets the flow continue (Item / Order, then the Lot Panel); no lot exists yet
  3. Print by order lot: no Reason Code dialog (its config is not Y); "No Lot found ... Please fix or continue."

### Batch_Quantity_Copies.spec.ts

- **Test:** Batch Quantity x Multiplier + Extra: the Copy field on Print by Order / Print by Lot (no print)

  Steps / actions:
  1. item A (multiplier 3, extra 2): blank batch -> 2; batch 10 -> 32; batch 5 -> 17
  2. item B (multiplier 2, extra "10P" = 10 % of batch x multiplier, rounded UP): batch 10 -> 22; batch 7 -> 16
  3. Print by Lot uses the same rule (LotNumber config): item A batch 10 -> 32
  4. cleanup: delete the unprinted lots in Lot Management

### Batch_Quantity_Reprint.spec.ts

- **Test:** Batch Quantity reprint threshold: Reprint box forced on when printed + about to print exceeds the allowed quantity (Print by Order, Print to PDF)

  Steps / actions:
  1. visit 1: new lot, Override Batch Qty 1 -> Copy 5, Reprint not forced; print 3 copies
  2. visit 2: same lot (3 printed); Copy 3 would make 6 > 5, Copy 2 = 5 = allowed; print 2 more
  3. visit 3: same lot; 1 more copy would make 6 > 5 -> Reprint must be defaulted and forced on

### Batch_Quantity_Reprint_Off.spec.ts

- **Test:** ReprintBasedOnBatchQty = N: after ONE printed copy every further print is a reprint (Print by Order and Print by Lot)

  Steps / actions:
  1. Print by Order, new lot, Override Batch Qty 1: Copy 5, Reprint off; print ONE copy
  2. Print by Order again, same order: Reprint ticked and locked although only 1 of 5 was printed
  3. Print by Lot (LotNumber config), same lot: Reprint ticked and locked

### Batch_Quantity_Serialized.spec.ts

- **Test:** serialized templates (S_USerial / S_Ser): Copy on Print by Order and Copies in Multi Document Printing with a batch quantity (no print)

  Steps / actions:
  1. ${kind} item ${itemNumber}: Print by Order, batch blank and batch 10
  2. ${kind} item ${itemNumber}: Multi Document Printing, Override + Save batch 10
  3. cleanup: delete the unprinted lots in Lot Management

### Blank_Expiration_Date_Calculated.spec.ts

- **Test:** blank expiration date is calculated from manufacturing date + shelf life on the Lot Panel

  Steps / actions:
  1. enter a brand-new Order+Item combo
  2. the Lot Panel shows a calculated (non-blank, non-stale) Expires date

### Invalid_Combination_Blocked.spec.ts

- **Test:** invalid order/lot/item combination is blocked on every retry, never reaches the Lot Panel

  Steps / actions:
  1. a nonexistent order number is rejected with "No Lot found..." and offers Item/Lot fields
  2. retrying with Item/Lot still blank keeps blocking with "No item found." -- never advances
  3. supplying a nonexistent Item Number alongside stays blocked the same way

### Multi_Document_Printing.spec.ts

- **Test:** Multi Document Printing: entry, lot panel, label rows, preview, Test Print and real Print to PDF

  Steps / actions:
  1. open the module (Sentinel prompt): the entry panel has Order / Lot / Item, Next and Reset
  2. Next: Lot Panel with the entered lot/order and defaulted dates, and one Labeling row per printer
  3. choose Carton Label on the PDF row: template + LCN appear, copies defaults to 1, Print is enabled
  4. View Preview shows the label image; View Master / Compare report "No Label Master Found" for this item
  5. Test checkbox turns Print into Test Print; Test Print to the PDF printer succeeds
  6. a real Print to the PDF printer succeeds (creates the lot)
  7. the REAL print is in InnoView > View Print History (once, PDF printer, 1 copy); the Test Print is not
  8. Reset returns to the empty entry panel

### Multi_Document_Printing_Batch_Quantity.spec.ts

- **Test:** Multi Document Printing: Copies = Batch Qty x Multiplier + Extra, Override Lot Data recalculation, no values -> 1, R marker after a print

  Steps / actions:
  1. item A: blank batch -> 2; Override + Save batch 10 -> 32; batch 1 -> 5; cleared -> 2
  2. an item without multiplier / extra values: Copies = 1 (F.14.2)
  3. item A again on the first lot: lower Copies to 1 and print ONE copy to PDF
  4. the same lot again (second print, ReprintBasedOnBatchQty = N): the row is a reprint (R next to the checkbox, F.7.1)
  5. cleanup: delete the unprinted item MI080301 lot

### Multi_Document_Printing_Label_Master.spec.ts

- **Test:** Multi Document Printing: View Master and View Compare work for an item with a label master

  Steps / actions:
  1. open the module (Sentinel prompt) and enter a new lot for the item
  2. choose Carton Label on the PDF row, then View Master and View Compare

### Multi_Document_Printing_Override_Lot.spec.ts

- **Test:** Multi Document Printing: Override Lot Data (editable fields, validation, Save, Cancel) and the print uses the overridden dates

  Steps / actions:
  1. open, enter a NEW lot, Next: only Manufactured is editable until Override Lot Data is ticked
  2. tick Override Lot Data: dates become editable and Save / Cancel appear
  3. Manufactured after Expires is refused on Save
  4. a valid change (Manufactured 1/1/2026, Expires 12/31/2030) Saves and the checkbox unticks
  5. Cancel throws a pending change away
  6. real Print to PDF with the overridden lot, then InnoView shows the 2030 expiry

### Multi_Document_Printing_Print_Entity.spec.ts

- **Test:** Multi Document Printing, PrintEntityRequired = Y: entity dropdown, Reason Code, real Print to PDF, lot carries the chosen entity, last used entity is the default

  Steps / actions:
  1. open the module: the Print Entity dropdown lists the entities of the user (`*` = all) with a default
  2. a new lot: Order / Lot / Item -> Next (Reason Code dialog when AddLotReasonRequired = Y) -> Lot Panel with the Labeling rows
  3. Carton Label on the PDF row, real Print to PDF
  4. Lot Management: the lot exists with the CHOSEN Print Entity
  5. reopen Multi Document Printing: the dropdown defaults to the LAST USED entity

### Multi_Document_Printing_Prompts.spec.ts

- **Test:** Multi Document Printing: print-time prompts (required, Cancel) and Edit Prompt Data

  Steps / actions:
  1. open the module, enter a new lot for the prompts item, choose Carton Label on the PDF row
  2. before any answer: Edit Prompt Data is disabled with the tooltip "No Prompt Data Specified"
  3. Test Print asks the Print Time Prompts question; Cancel prints nothing
  4. an empty answer cannot be saved (Save disabled); answering "Brown" enables Save and lets the Test Print succeed
  5. after an answer, Edit Prompt Data is enabled and re-opens the dialog with the stored answer; a new answer is kept
  6. the next Test Print uses the stored answer: no new prompt, status success

### Multi_Document_Printing_Security.spec.ts

- **Test:** Multi Document Printing security: tile and page need BP_MultiDocumentPrint

  Steps / actions:
  1. without BP_MultiDocumentPrint: no tile, and the page itself is refused
  2. with BP_MultiDocumentPrint: the tile is there and the entry panel loads
  3. cleanup: the group is left without processes

### Print_By_Lot.spec.ts

- **Test:** @smoke @tier2 Print by Lot, PrintEntityRequired = N: no Print Entity dropdown, new lot flow, lot panel, label screen, real Print to PDF

  Steps / actions:
  1. open Print by Lot (Sentinel prompt): only a Lot Number field, no Print Entity dropdown
  2. an unknown lot: "No lot found." and Item Number / Shop Order Number fields appear
  3. Lot + Item + Order: the Lot Panel (new lot, Manufactured editable, Expires = Manufactured + 1 day)
  4. Next: label type (Carton Label), Label Control (LCN), copies 1, printers incl. PDF, Reprint / Test checkboxes and the View actions
  5. real Print to the PDF printer
  6. the real print is in InnoView > View Print History (PDF printer, 1 copy, entity ROBAR)

### Print_By_Lot_Reprint.spec.ts

- **Test:** Print by Lot reprint: Reprint box locked on, reason + password required, wrong password refused, reprint succeeds and is in the Reprints history

  Steps / actions:
  1. first print of a new lot succeeds
  2. Reset + the same lot again: Reprint is ticked and locked, Reprint Options appear (User ID = the user, Reason list)
  3. Print without a reason: "Please select a reprint reason."
  4. a reason but no password: "Invalid Username/Password. UserID:<user>"
  5. a wrong password: the same message
  6. the right password + reason + comment: the reprint prints
  7. InnoView: two history rows for the lot, one of them in "View Print History Reprints"

### Print_By_Order.spec.ts

- **Test:** Print by Order, PrintEntityRequired = Y: entity dropdown, Reason Code, new order flow, real Print to PDF, lot carries the chosen entity, last used entity becomes the default

  Steps / actions:
  1. open Print by Order: the Print Entity dropdown lists the entities of the user (`*` = all) and a default
  2. a new order with the chosen entity: Reason Code dialog (required), then Item / Lot / Order
  3. Next: label screen, printer = Microsoft Print to PDF, real Print
  4. Lot Management: the lot exists with the CHOSEN Print Entity
  5. reopen Print by Order: the dropdown now defaults to the LAST USED entity

### Print_Request_Multi_Item_Errors.spec.ts

- **Test:** Print by Order / Print by Lot: a number assigned to multiple items shows an error

  Steps / actions:
  1. setup in Lot Management: order O -> lots L1 (item A) and L2 (item B); lot L1 also under order O2 with item B
  2. Print by Order with an order assigned to two items: an error (FRS-8.1.3.13)
  3. Print by Lot with a lot number assigned to two items: an error (FRS-8.1.3.12)
  4. cleanup: delete the unprinted lots in Lot Management

### Print_Request_Security.spec.ts

- **Test:** Print by Lot label screen follows BP_Change_Print_Quantity, BP_Test_Print and the reprint processes (no print)

  Steps / actions:
  1. base processes only (Print by Lot tile, Print_Label)
  2. + BP_Change_Print_Quantity
  3. + BP_Test_Print
  4. + BP_Reprint_Label + BP_Reprint_CanSign

### Print_Request_Test_Print.spec.ts

- **Test:** Test Print: red Test Print button, repeatable, excluded from reprint; default printer = last used; locked after a real print

  Steps / actions:
  1. label screen: the Test checkbox and the Print button; Copy lowered to 1
  2. tick Test: the Print button becomes a red "Test Print" button (F103.0.1)
  3. click Test Print twice (F103.1.1: indefinitely) - 1 copy each
  4. a new visit after test prints only: Reprint is NOT forced (F103.1.2: test prints are excluded)
  5. untick Test, real Print of 1 copy: the panel is locked after the print (FRS-8.1.10.3)
  6. a new visit after the real print: default printer = last used (PDF), Reprint forced

### Serial_Print_To_PDF.spec.ts

- **Test:** @smoke @tier2 [usr] Print by Lot: S_USerial template, Print to PDF
- **Test:** [ser] Print by Lot: S_Ser template, Print to PDF
- **Test:** [ser-inc] Print by Lot: S_Ser template, Print to PDF
- **Test:** [ser-counter] Print by Lot: S_Ser template, Print to PDF
- **Test:** [ser-existing] Print by Lot: S_Ser (existing template SingleSer_na) template, Print to PDF

  Steps / actions:
  1. Print by lot: new lot on the serialized item, to the label screen, printer = Microsoft Print to PDF
  2. Serial Number Management dialog is open
  3. Add One: 001, 002, 003; select all; Done
  4. S_Ser: Serial = 3 (Copy 1), Starting Serial and Of as shown
  5. Print to Microsoft Print to PDF (Copy 1)
  6. InnoView > View Print History lists the print (PDF printer, serial count, copies)

### Serial_Template_Setup.spec.ts

- **Test:** [usr] create an S_USerial template, approve it, and an approved item with LCN and Label Master on it
- **Test:** [ser] create an S_Ser template, approve it, and an approved item with LCN and Label Master on it
- **Test:** [ser-inc] create an S_Ser template, approve it, and an approved item with LCN and Label Master on it
- **Test:** [ser-counter] create an S_Ser template, approve it, and an approved item with LCN and Label Master on it

  Steps / actions:
  1. create template ${template} bound to ${SHARENAME}
  2. approved item with LCN and Label Master on that template


## CM-MDM-PDF

### Build_Data.spec.ts

- **Test:** stage T1 - template MBPDFT<stamp> version 0, approved
- **Test:** stage T2 - template version 1 (Save As New > New Version), left UNAPPROVED
- **Test:** stage I6 - approved item MBPDF6<stamp> on the template (latest template version unapproved)
- **Test:** stage I2 - approved item MBPDF2<stamp> on A1SuperTemplate + Master Data record (v0 approved, v1 unapproved)

### Build_Filter.spec.ts

- **Test:** stage F - saved filter MBMDFILTER<stamp> with Master Data Schema RobarMasterData (CM_MDM_Integration must be Y)


## Campaign-Manager

### Campaign_Manager_Requirements.spec.ts

- **Test:** Campaign Manager vs ValMaster: saved filters on load, default limit, Advanced Options, sort, checkboxes, No records, Exactly Matches drop-down, AND / OR

  Steps / actions:
  1. 101.5 / 101.1: the Limit Results field is shown with a number
  2. 101.2 / 101.3: Advanced Options offer available and selected result columns, selected not empty
  3. 117.0.2: the previous filters are loaded and results retrieved when the page loads
  4. 101.4: sort by a selected column (Item Number header toggles the order)
  5. 102.1: the header checkbox selects / deselects all rows, rows can be ticked individually
  6. 105.3: "No records to view" when nothing matches
  7. 106.3: with Exactly Matches the Value becomes a drop-down for some columns (e.g. Label Type, Approved By)
  8. 106.4: a second filter offers AND / OR

### Create_Approved_Item.spec.ts

- **Test:** create a new Campaign Manager item and approve it

### Export_to_Xls.spec.ts

- **Test:** export to xls submits a job for the selected item

### Import_Master.spec.ts

- **Test:** import master requires a real staged .xlsx file -- not available in this environment

### Item_Change_History.spec.ts

- **Test:** View History shows the audit trail for a newly created item

  Steps / actions:
  1. open View History from the grid row
  2. confirm the history page and audit rows

### Item_Data_Compare.spec.ts

- **Test:** BUG: item data compare fails against a fresh item with an OLEDB error

### Item_PDF_and_Symbols.spec.ts

- **Test:** Item Edit PDF and Insert Symbols buttons

  Steps / actions:
  1. Insert Symbols -- editable item
  2. PDF -- view/generate a PDF for the (still unapproved) item

### Item_Translation.spec.ts

- **Test:** item translation populates a translated phrase into the selected item

### Job_Inquiry.spec.ts

- **Test:** Job Inquiry finds and links back to a just-submitted job

  Steps / actions:
  1. navigate to Job Inquiry
  2. retrieve and find the just-submitted job

### Job_Inquiry_Requirements.spec.ts

- **Test:** Campaign Manager Job Inquiry vs ValMaster: criteria columns, no in-app link, Do Action state

  Steps / actions:
  1. CM.107.1: Do Action is grayed out until an action is chosen
  2. CM.107.8: a visible link to Job Inquiry exists on the Campaign Manager page
  3. CM.107.10: the Job Inquiry criteria offer Display ID, Description, Status, Date Started, Date Completed, Submitting User, Single Item, Percent Complete, Action ID

### Mass_Item_Approve.spec.ts

- **Test:** mass item approve approves the selected item

### Mass_Item_Update.spec.ts

- **Test:** mass item update changes the selected item's Item Group

### Mass_Print.spec.ts

- **Test:** mass print submits a print job for the selected item

### Retire_Item.spec.ts

- **Test:** retire item marks the item inactive

### Retire_Items_Bulk.spec.ts

- **Test:** bulk retire items retires the selected item

### Save_and_Load_Filters.spec.ts

- **Test:** save filters persists the current query, load filters restores it

  Steps / actions:
  1. Save Filters
  2. Load Filters restores the saved criteria

### Save_as_New_Bulk.spec.ts

- **Test:** bulk save as new creates a new version of an approved item

### Save_as_New_Item_or_Label_Type.spec.ts

- **Test:** save as new item / label type creates a distinct new item

### Save_as_New_Version.spec.ts

- **Test:** save as new version creates version 1 from an approved item

### Save_to_Pdf.spec.ts

- **Test:** save to pdf submits a job when Subfolder is provided
- **Test:** BUG: save to pdf rejects a blank Subfolder with a vague message

### Send_to_Workflow.spec.ts

- **Test:** send to workflow submits an unapproved item into a workflow preset
- **Test:** BUG-CHECK: send to workflow requires Workflow Comments and a Preset

### Unretire_Item.spec.ts

- **Test:** unretire item marks a retired item active again


## Codes-Management

### Codes_Management.spec.ts

- **Test:** Codes Management: anatomy, filters, sort / paging, Add validations and create, Edit rules

  Steps / actions:
  1. page anatomy: heading, grid columns, pager, Actions = Excel Import only
  2. filter columns and operators
  3. Contains / In / Exactly Matches (dropdown) / Is Blank / Active
  4. sort by a column header toggles ascending / descending; page size 20 / 30
  5. Add dialog: required fields, duplicate, too long, Active defaults ticked, existing type typed in the select2 box
  6. create ${TYPE} / ${CODE}: appears unfiltered-by-Active, Active Y
  7. creating a second code in the SAME type keeps one type option; blank description is allowed
  8. Edit: Code Type and Code are read-only, Description / Active editable; double-click opens Edit; edit persists
  9. CM.160202.F.1.9 / F.1.10 / F.1.8 / F.1.3: several criteria rows with AND / OR drop-downs; "No records to view" when nothing matches; the grid is shown on open (not only after Retrieve Data)
  10. a new page load starts with the full grid and no criteria row (filters are not remembered)

### Codes_Management_Excel.spec.ts

- **Test:** Codes Management Excel Import: template, validation errors, new rows, overwrite prompt, signer rights

  Steps / actions:
  1. page anatomy and Download Template (headers)
  2. validation errors: blank Code / CodeType, Code over 30 characters, bad Active, duplicate row in Excel
  3. a valid file (Active written as YES / 0, blank Description) validates, is signed and uploaded; the codes appear mapped to Y / N
  4. Active = "Maybe" is NOT rejected by validation (defect candidate); what the upload then does
  5. Row already in database: replace prompt (No / X abort, Yes proceeds), the description is overwritten
  6. signer rights: EI_Codes / EI_Codes_Upd are checked only for the replace path (and name just one process)

### Codes_Management_Security.spec.ts

- **Test:** Codes Management: Web_Codes switches Add / Edit / Excel Import and the Update action; tile visibility

  Steps / actions:
  1. S0: only Login_WebMenu
  2. S1: + View_Codes (the tile process) -> tile and grid, but Add / Edit / Excel Import disabled and the Update action refused
  3. S2: + Web_Codes -> Add / Edit enabled, Excel Import enabled
  4. cleanup: the group holds only Login_WebMenu


## Cross-Module

### Approved_Template_Item_MDM.spec.ts

- **Test:** new approved template -> approved item -> approved Master Data record

  Steps / actions:
  1. Part 1: create and approve the template (Template Management)
  2. resolve Playwright\'s own browser process id
  3. confirm the native "Open SentinelLauncher?" prompt
  4. find the BarTender process Sentinel launches
  5. configure and approve the template in BarTender via FlaUI
  6. wait for BarTender / the Sentinel plugin to fully close
  7. Part 2: create and approve a Campaign Manager item using that template
  8. Part 2b: create a Master Data record for the item (Master Data Management)

### Dynamic_UI_Requirements.spec.ts

- **Test:** Dynamic UI vs ValMaster: icon states and Actions menu follow the header security columns; no CanView process -> not authorized message

  Steps / actions:
  1. Part A: the admin user sees the icons / Actions entries the seed configures (DUI.F.3.1, F.3.3-F.3.5)
  2. Part B (DUI.F.3.2): a user without the CanView process gets "User is not authorized to view this page"

### InnoView_Requirements.spec.ts

- **Test:** InnoView vs ValMaster: report menu, the requirement reports, prompts, columns and Export (read-only)

### InnoView_Security.spec.ts

- **Test:** InnoView tile and Print History reports follow Login_InnoView and Innov_ViewPrintHist (MB group only)

### Scenario_Template_Item_Versions.spec.ts

- **Test:** phase A: template CL... with versions 0-7 approved and 8 unapproved
- **Test:** phase B: master data record + item with versions 0-5 approved and 6 unapproved
- **Test:** phase C: Label Control records for item v5 (template v6) and v6 (template v8), linked to the unapproved master data

### Template_Item_MDM_LCN_Release.spec.ts

- **Test:** new template -> approved item -> Master Data record -> assign LCN -> release LCN

  Steps / actions:
  1. Part 1: create and approve the template (Template Management)
  2. resolve Playwright\'s own browser process id
  3. confirm the native "Open SentinelLauncher?" prompt
  4. find the BarTender process Sentinel launches
  5. configure and approve the template in BarTender via FlaUI
  6. wait for BarTender / the Sentinel plugin to fully close
  7. Part 2: create and approve a Campaign Manager item using that template
  8. Part 2b: create a Master Data record for the item (Master Data Management)
  9. Part 3: assign the item a Label Control Number (Label Control)
  10. Part 4a: before releasing, the item shows under "Unreleased Only"
  11. Part 4b: Manage Production Availability -> release the LCN
  12. Part 4c: confirm the LCN is released (gone from "Unreleased Only")

### zz_Template_Item_LCN_Print.spec.ts

- **Test:** new template -> approved item -> Master Data record -> assign LCN -> release LCN

  Steps / actions:
  1. Part 1: create and approve the template (Template Management)
  2. resolve Playwright\'s own browser process id
  3. confirm the native "Open SentinelLauncher?" prompt
  4. find the BarTender process Sentinel launches
  5. configure and approve the template in BarTender via FlaUI
  6. wait for BarTender / the Sentinel plugin to fully close
  7. Part 2: create and approve a Campaign Manager item using that template
  8. Part 2b: create a Master Data record for the item (Master Data Management)
  9. Part 3: assign the item a Label Control Number (Label Control)
  10. Part 4a: before releasing, the item shows under "Unreleased Only"
  11. Part 4b: Manage Production Availability -> release the LCN
  12. Part 4c: confirm the LCN is released (gone from "Unreleased Only")
  13. Part 5: Print by Lot -> new lot for the new item -> real Print to PDF


## Destination-Labeling

### Destination_Labeling.spec.ts

- **Test:** Destination Labeling: launch panel, order lookup, Create Order, destination selection, Reset

  Steps / actions:
  1. DL.171227.F.1.2: the launch page shows Pick Order with Order Number, Order Status, Next, Create Order and the Require Verification checkbox
  2. DL.171227.F.2.4: an unknown order number -> "No worklist elements found for the entered order number. OrderNumber: <n>"
  3. DL.171227.F.5.9 / F.5.1: Create Order with a blank number generates ccyymmdd-NNNN; the number is then locked (F.2.1) and the Destination Code dropdown appears
  4. DL.171227.F.7.1 / F.7.9: the Destination Code list holds the ACTIVE destinations; choosing one shows its languages and the barcode field
  5. DL.171227.F.31.1: Reset returns to the empty Pick Order panel with Next and Create Order
  6. DL.171227.F.5.4 / F.5.5: Create Order with a typed number creates it once; the same number again -> "Order already exists"

### Destination_Labeling_Scan.spec.ts

- **Test:** Destination Labeling scanning: unrecognized barcode, Barcode Scan dialog (Fields Found / Required), Reset, complete scan -> No print rows

  Steps / actions:
  1. setup: Create Order (auto number) and choose the first destination
  2. DL.171227.F.10.9: a barcode with no recognized AI -> unrecognized-identifier message with Continue
  3. DL.171227.F.10.9: the human-readable form with parentheses "(01)...(10)..." is not recognized either (observation)
  4. DL.171227.F.10.4 / F.10.5 / F.10.6 / F.10.7 / F.10.14: a GTIN only -> Barcode Scan dialog with Fields Found (GTIN) and Fields Required (LotNumber), an extra scan field and Reset; Current Scan appears
  5. DL.171227.F.10.8: Reset closes the dialog, clears the scanned values and returns to the main screen
  6. DL.171227.F.10.7 / F.10.11 / F.10.12 / F.11.7: the lot scanned in the dialog completes the scan: the dialog closes and "No print rows found for given barcode" is shown with Continue

### Destination_Labeling_Security.spec.ts

- **Test:** Destination Labeling: each BP_Dest_* process switches on its own control; the tile needs BP_DestinationLabeling

  Steps / actions:
  1. S0: only Login_WebMenu -> no tile (F.1.1)
  2. S1: + BP_DestinationLabeling -> the page opens with Pick Order; Create Order / Require Verification are NOT displayed (F.5.2, F.23.1)
  3. + BP_Dest_CreateOrder -> Create Order is displayed
  4. + BP_Dest_RequireVerification -> the Require Verification checkbox is displayed (F.23.1)
  5. + BP_Dest_PrintMultipleCopies -> Print Multiple Copies is displayed once an order and destination are chosen (F.19.1)
  6. cleanup: the group holds no processes


## Dictionary-Management

### Dictionary_Management.spec.ts

- **Test:** Dictionary Management: anatomy, search, New Entry, View/Edit, HTML editor and New Version rules

  Steps / actions:
  1. page anatomy after Reset: criteria, version filters, Latest / Effective checkboxes, Limit Results, Actions menus, grid columns
  2. search operators on the seeded read-only prompt phrases
  3. New Entry dialog: defaults, required fields, create PHR1, duplicate refused
  4. New Entry with custom and future dates (PHR2, PHR3)
  5. View/Edit: phrase and language read-only, translation / dates / HTML editable; long translation saved and shown as a tooltip
  6. Edit as HTML: CKEditor appears below a disabled Translation, is removed again, HTML source is saved and retained
  7. New Version: Yes/No confirmation and the "latest unapproved version already exists" block

### Dictionary_Management_Bulk.spec.ts

- **Test:** Dictionary Management Bulk Actions: Mass Approve, New Version of an approved record, version filters, Retire / Unretire, Export to Excel

  Steps / actions:
  1. Mass Approve: job submission page, Submit Job disabled until complete, Job Detail, record becomes approved
  2. Mass Approve on an already approved record is refused with a banner
  3. New Version of the approved record: edit dialog with disabled Phrase / Language, Submit creates an unapproved version 1; a second one is refused
  4. Version filters and Latest Only on a phrase with versions 0 (approved) and 1 (unapproved) plus an unapproved phrase
  5. Mass Retire / Unretire: Retire pre-selected, record retired (Effective End), then Unretire
  6. Export to Excel: job submission (description + filename), Job Detail with a download link, the file holds the selected rows

### Dictionary_Management_Excel.spec.ts

- **Test:** Dictionary Management Excel Import: template, validation errors, new rows, overwrite prompt, signer rights

  Steps / actions:
  1. page anatomy and Download Template (headers)
  2. validation errors: blank Phrase / Language (red cell "This column does not allow null values."), bad dates, duplicate row in Excel
  3. a valid new row validates, is signed and uploaded (DisplayId + Upload Successful); the record appears unapproved
  4. Row already in database: replace prompt (No / X abort, Yes proceeds), the translation is overwritten
  5. the SIGNER needs DM_Import (and DM_ImportOverwrite for the replace path): an MB signer without them is refused with a named process

### Dictionary_Management_Requirements.spec.ts

- **Test:** Dictionary Management vs ValMaster: grid UI facts, empty-selection dialogs, Mass Approve and Mass Retire / Unretire page rules

  Steps / actions:
  1. grid / filter UI facts: Column list (F.1.11), Version Filters (F.1.14), Latest Only / Effective Only (F.1.18 / F.1.19), grid columns (F.1.25), counters (F.1.30-F.1.33), menus (F.1.13 / F.1.35 / F.1.29)
  2. F.6.4 / F.7.4 / F.8.4: a bulk action with no record selected -> "Please select one or more records." with an OK button
  3. setup: two own unapproved records
  4. Mass Approve page: fields (F.7.7), reasons (F.7.13), Submit disabled (F.7.17), required messages (F.7.8 / F.7.10 / F.7.14), invalid credentials (F.7.11)
  5. Mass Retire page for ONE unretired record: radios (F.8.6 / F.8.8), job submitted, Effective End = today (F.8.10)
  6. Mass Retire page for ONE retired record: Retire radio disabled (F.8.7); Unretire defaults Effective Begin = today and Effective End = 12/31/2099, not editable (F.8.16 / F.8.17)
  7. Mass Retire with BOTH retired and unretired records: warning with Cancel / Continue (F.8.12 / F.8.13 / F.8.14), Retire selected by default (F.8.9)

### Dictionary_Management_Requirements_Import.spec.ts

- **Test:** Dictionary Management Excel Import vs ValMaster: sheet dropdown, defaults, all-or-nothing validation, overwrite of an approved record

  Steps / actions:
  1. F.2.17 / F.2.18: the Sheet dropdown (one worksheet -> that name; several -> alphabetical with "(Select a sheet)" first)
  2. F.2.11 / F.2.12 / F.2.13 / F.2.14 / F.2.15: blank dates default to today / 12/31/2099; a non-ROBAR ApprovedBy with a blank ApprovalDateTime is accepted and dated today; a future Effective Begin is accepted
  3. F.2.6: overwriting an APPROVED record with blank ApprovedBy / ApprovalDateTime creates a NEW UNAPPROVED version
  4. F.2.21: validation must pass in its entirety - a file with one valid and one invalid row imports nothing

### Dictionary_Management_Security.spec.ts

- **Test:** Dictionary Management: each DM_* process switches on its own control; the module tile needs Web_DictionaryManagement

  Steps / actions:
  1. S0: only Login_WebMenu -> no Dictionary Management tile
  2. S1: + Web_DictionaryManagement -> tile and module open, every action disabled with a "User not authorized" tooltip
  3. + ${proc} -> its own control switches on
  4. server side: a user with only the module process can still open the New Entry dialog URL (observation)
  5. cleanup: the group holds only Login_WebMenu

### Dictionary_Management_Server_Side_Authorization.spec.ts

- **Test:** Dictionary Management: the JSON write endpoints refuse a user without DM_NewEntry / DM_NewVersion / DM_Edit

  Steps / actions:
  1. NewRecord without DM_NewEntry is refused (Success false, "not authorized" / the process name)
  2. NewVersion without DM_NewVersion is refused (real MB test phrase id) [only with PROBE_DICTIONARY_NEWVERSION=Y: open defect]
  3. Update without DM_Edit is refused (real MB test phrase id)


## Field-Defs-Management

### Field_Definitions.spec.ts

- **Test:** Field Definitions Management: layout, grid, filters, Edit Record (edit + restore) and the Create New dialog

  Steps / actions:
  1. layout: Label Type dropdown, Actions menu and criteria columns
  2. grid: all field definitions of MBLT1, with the persisted-limit pitfall
  3. criteria: File/Form, Column Name and Sharename filters
  4. Edit Record: Caption, Sharename, Sample Data, Drop Down and Validate are editable; Column Name / Field Type / Read Only / Translate are not
  5. Create New Field Definitions: dialog lists and the confirmation (cancelled -- nothing is created)

### Field_Definitions_Requirements.spec.ts

- **Test:** Field Definitions Management vs ValMaster: retrieve, pager, No records, Dictionary Language, Create confirmation (No), unauthorized double-click

  Steps / actions:
  1. F.1.4: no field definition rows until Retrieve Data is clicked
  2. F.1.8 - F.1.10: "View X - X of X records", Page X of X, record counter 10 / 20 / 30 with default 10
  3. F.1.5: a second query filter offers AND / OR
  4. F.1.7: "No records to view" when nothing matches
  5. F.2.4: the Dictionary Language list is alphabetical with a blank default
  6. F.3.3 / F.3.5: Create confirmation text; No closes both dialogs and creates nothing
  7. F.2.3: an unauthorized user (no FD_Maintain_FieldDefs) double-clicking a record gets "User not authorized for this task.FD_Maintain_FieldDefs" + OK

### Item_Screen_Layout.spec.ts

- **Test:** Item Screen Layout: tabs, moving a field between tabs, Save persists, Cancel discards (MBLT1, reverted)

  Steps / actions:
  1. layout: Label Type dropdown, tabs and per-tab field counts; Save is disabled until a change
  2. dragging a field onto another tab enables Save; Cancel discards the change
  3. Save persists the move (checked after reopening the page), then the move is reverted

### Security_Gating.spec.ts

- **Test:** Field Defs Management: tile, label-type visibility and edit rights follow Web_Field_Definitions / LT_ / FD_Maintain_FieldDefs

  Steps / actions:
  1. without Web_Field_Definitions the tile is not shown
  2. tile only (no LT_ process): the module opens but offers no label type except (Default)
  3. + LT_MBLT1: that label type appears, but the Edit icon stays disabled without FD_Maintain_FieldDefs
  4. + FD_Maintain_FieldDefs: the Edit icon is enabled
  5. cleanup: the fixture group is left with no authorizations


## Flex-Printing

### Flex_Printing_Config_Variants.spec.ts

- **Test:** Flex Printing identifier layouts: Order+Item, Order+Lot (Item AddOnly / not AddOnly), date identifier (config restored afterwards)

  Steps / actions:
  1. FLX.190301.F.1.6: Order Number + Item Number on the initial screen (Lot AddOnly) -> the Lot Number of the single matching lot is displayed
  2. FLX.190301.F.2.3: Order Number + Lot Number entered, Item Number AddOnly -> the Item Number of the single matching lot is displayed
  3. FLX.190301.F.2.3 (negative): Order + Lot entered but the Item identifier is NOT AddOnly -> "Insufficient lot identifiers configured"
  4. FP.160601.F.1.1 / F.1.3 / F.1.4: an identifier with the Date (and Protect) modifier is shown with a date picker

### Flex_Printing_Requirements.spec.ts

- **Test:** Flex Printing: entry screen, lot lookup, add-at-print-time, messages, Reset (config: Item + Lot visible, Order AddOnly)

  Steps / actions:
  1. entry screen: Item Number + Lot Number, Next, Reset; the AddOnly Order Number box is not shown; first field has the cursor (DIT 6617)
  2. FLX.190301.F.1.5 / U.1: Item + Lot of an existing lot -> the Lot Panel shows the Order Number of that lot
  3. FP.160323.F.5.1 / F.3.1 / U.3 / U.5: label screen offers the preview drop-down (View Master / Preview / Compare) and a Test Print check box (TestPrintShow = Y)
  4. messages: blank entry, unknown item (the screen shows the Order box as soon as a lookup fails)
  5. FLX.190301.F.2.2 / U.2 / F.1.1: unknown lot with BP_Add_Lot_Printtime -> message, Order box offered; entering an order adds the lot at print time
  6. FLX.190301.F.2.2: the record can also be submitted with a blank identifier (Next again without an Order)
  7. FLX.190301.F.1.2: DeleteLotIfExists = N and an existing lot/order combination used for a different item
  8. FP.160323.F.4.1 / U.4: Reset clears the entry fields

### Flex_Printing_Security.spec.ts

- **Test:** Flex Printing: tile, add-lot-at-print-time authorization (BP_FlexPrinting_Option, BP_Add_Lot_PrintTime) for an MB user


## Label-Control

### Assign_Control_Number.spec.ts

- **Test:** create a fresh item and assign it a Label Control Number

  Steps / actions:
  1. create and approve a Campaign Manager item (no BarTender needed)
  2. assign a Label Control Number to the new item

### Attachments_Row_Action.spec.ts

- **Test:** Attachments row action opens Link Management for the record and Detach removes the file

  Steps / actions:
  1. create and approve a Campaign Manager item (no BarTender needed)
  2. assign a Label Control Number to the new item
  3. upload a new attachment file via the Attachment Upload tile
  4. Link Attachments: associate the uploaded file with the Label Control record
  5. row action: Attachments opens Link Management pre-filtered to the record
  6. Detach: unlinks the file immediately (no confirmation) and shows a completed job
  7. the record no longer shows under "With Attachments"

### Change_Report.spec.ts

- **Test:** Change Report completes for a record with a Label Master and saves the report to ROBAR

  Steps / actions:
  1. create and approve a Campaign Manager item (no BarTender needed)
  2. assign a Label Control Number to the new item
  3. before: the item shows under "Without Label Master"
  4. after: the item now shows under "With Label Master"
  5. Change Report on the item that now has a Label Master
  6. the saved report shows up as an attachment on the item

### Change_Report_Options.spec.ts

- **Test:** Change Report options: Do Not Recreate, Grouped Master, Both, Save to Folder and Link to Prior

  Steps / actions:
  1. create an item with two approved versions (Save As New Version)
  2. one Assign Control Number job gives each version its LCN
  3. Recreate Master on v1 only, so v1 has the Label Master Change Report needs
  4. 1. CDR Only (default) links one ChangeDocumentReport file; 2. Do Not Recreate adds nothing
  5. 3. running CDR Only again (box off) ADDS a second same-named file
  6. 4. Grouped Master Only links GroupedMaster_<item>.pdf
  7. 5. Both links GroupedMasterWithCDR_<item>.pdf
  8. 6. Save to Folder: empty sub folder is blocked; with one the file lands on the CDR share, nothing new is linked
  9. 7. Link to Prior also links the new file to the version-0 record

### Compare_With_Prior.spec.ts

- **Test:** Compare With Prior reports a clean per-record error for items with no prior LCN

  Steps / actions:
  1. create and approve two Campaign Manager items
  2. assign Label Control Numbers to both items
  3. Compare With Prior with both records selected

### Compare_With_Prior_Success.spec.ts

- **Test:** Compare With Prior succeeds for an item version whose prior version has an LCN

  Steps / actions:
  1. create an item with two approved versions (Save As New Version)
  2. one Assign Control Number job gives each version its own LCN
  3. Compare With Prior over both versions: v1 finds v0 as its prior, v0 has none
  4. the successful comparison was saved to ROBAR: only version 1 now has an attachment

### Export_Master.spec.ts

- **Test:** @smoke @tier1 Export Master writes the master PDF to the export folder and offers a download

  Steps / actions:
  1. create and approve a Campaign Manager item (no BarTender needed)
  2. assign a Label Control Number to the new item
  3. before: the item shows under "Without Label Master"
  4. after: the item now shows under "With Label Master"
  5. Export Master on the item that now has a Label Master

### Export_Master_Merge.spec.ts

- **Test:** Export Master with two records: per-record PDFs without Merge, one merged PDF with Merge

  Steps / actions:
  1. create an item with two approved versions (Save As New Version)
  2. one Assign Control Number job over both versions
  3. one Recreate Master job over both versions, so both have a Label Master
  4. no Merge: one PDF per record in the folder, and the download is a ZIP
  5. Merge: one ExportedMasters_<timestamp>.pdf, larger than either single master, and the download is a PDF

### Grid_Features.spec.ts

- **Test:** Label Control grid: pager, Advanced Options and Save / Load / Overwrite / Delete filter sets

  Steps / actions:
  1. pager: 10 rows per page, change page size, next / previous / last / first
  2. Advanced Options: default fields, add a field as a column, Limit Results caps the retrieve
  3. Save Filters: an empty name is rejected, a named set saves and closes the dialog
  4. Load Filters: the saved set is listed with its owner, Load with no selection is refused, Load re-applies the filters
  5. Overwrite an existing set: Save As existing keeps the name but replaces the filters
  6. cleanup: delete the saved set

### Label_Control_Job_Pages_Requirements.spec.ts

- **Test:** Label Control job submission pages: fields, defaults and required-field validation (no job is submitted)

  Steps / actions:
  1. Manage Production Availability (F.4.x / F.5.x / F.6.2 / F.6.12)
  2. Assign Control Number (F.7.4 / F.7.19 / F.7.20)
  3. Mass Update Versions (F.8.6 / F.8.8 / F.8.12 / F.8.13)
  4. Link to Label Master (F.16.4 / F.16.12 / F.16.11)

### Label_Control_Requirements.spec.ts

- **Test:** Label Control page vs ValMaster: filters, dropdowns, pager, advanced options, grid, row and bulk actions (read-only)

  Steps / actions:
  1. F.1.2 / F.1.7: menu tile; no records until Retrieve Data; F.1.28 reopening restores criteria and results
  2. F.2.1 / F.12.1 / F.17.1: filter drop-downs and defaults
  3. F.1.5 / F.1.8 / F.13.1 / F.15.x: criteria row (column prefixes, And/Or, multiple filters, Field Definitions for Label Type default)
  4. F.1.6 / F.1.11 - F.1.17 / F.1.27: retrieve, record checkbox, Select All, page counter, record counter, view X - X, sort, row Actions
  5. F.1.18 - F.1.20 / F.1.30 / F.1.31: Bulk Actions menu entries and state; Please select record(s)
  6. F.1.36: MD fields show N/A when there is no LCN / Master Data version

### Label_Control_Security_Requirements.spec.ts

- **Test:** Label Control tile, bulk actions and row actions follow their security processes (MB group only)

### Link_Attachments.spec.ts

- **Test:** Link Attachments uploads a new file and links it to a Label Control record

  Steps / actions:
  1. create and approve a Campaign Manager item (no BarTender needed)
  2. assign a Label Control Number to the new item
  3. upload a new attachment file via the Attachment Upload tile
  4. Link Attachments: associate the uploaded file with the Label Control record
  5. verify the item now shows under "With Attachments"

### Link_to_Label_Master.spec.ts

- **Test:** Link to Label Master reports a clean "not found" error for a brand-new item with no master

  Steps / actions:
  1. create and approve a Campaign Manager item (no BarTender needed)
  2. assign a Label Control Number to the new item
  3. Link to Label Master: both checkboxes left unticked, expect a clean per-record error

### Link_to_Label_Master_Success.spec.ts

- **Test:** Link to Label Master: exact match, latest fallback, already-linked and update-existing branches

  Steps / actions:
  1. create an item with two approved versions (Save As New Version)
  2. one Assign Control Number job gives each version its own LCN
  3. Recreate Master on the version-0 record only, so only v0 has a Label Master
  4. A. v1, no options: no exact match and "Use Latest" off -> matching master not found
  5. B. v1, "Use Latest If No Exact Match": falls back to the latest master and links
  6. C. v0, no options: already linked and "Update Existing" off -> already linked
  7. D. v0, "Update Existing Label Master Link": exact match, re-links

### Manage_Production_Availability.spec.ts

- **Test:** release a freshly-assigned Label Control Number via Manage Production Availability

  Steps / actions:
  1. create and approve a Campaign Manager item (no BarTender needed)
  2. assign a Label Control Number to the new item
  3. sanity check: item shows under Unreleased Only before the job runs
  4. Manage Production Availability: release the new LCN
  5. confirm: item no longer shows under Unreleased Only after the job completes

### Manage_Production_Availability_Dates.spec.ts

- **Test:** Manage Production Availability: effective dates, un-release, multi-field and validation paths

  Steps / actions:
  1. create and approve an item, assign it an LCN
  2. S0: freshly assigned record is unreleased
  3. S1: Release (default field, box ticked) -> Active
  4. S2: Effective Begin + End set to a past window -> released but no longer Active
  5. S3: window restored (end 12/31/2099) -> Active again
  6. record-level validation: an End date earlier than the existing Begin is an Error row, record unchanged
  7. submit-level validation: Begin >= End in the same job shows the error dialog and nothing is sent
  8. client-side validation: the same field twice is rejected; Add Field To Update caps at three
  9. S4: Release unticked (un-release) in a multi-field job -> unreleased again

### Mass_Update_Versions.spec.ts

- **Test:** mass-update a freshly-assigned Label Control record, keeping all versions

  Steps / actions:
  1. create and approve a Campaign Manager item (no BarTender needed)
  2. assign a Label Control Number to the new item
  3. Mass Update Versions: Keep Version for Item, Template, and Master Data

### Mass_Update_Versions_Template_MasterData.spec.ts

- **Test:** Mass Update Versions: Use Latest for the Template and Master Data dimensions, incl. a partial success

  Steps / actions:
  1. unapproved Master Data record, approved item, then an LCN
  2. J1: Template = Use Latest -> already on the latest approved template version
  3. J2: Master Data = Use Latest -> the only MD record is unapproved
  4. J3: Template + Master Data = Use Latest -> both failures reported in one message
  5. J4: Master Data = Use Latest + Allow Unapproved succeeds while Template = Use Latest fails (partial)
  6. J5: Master Data = Use Latest + Allow Unapproved again -> already on the latest MD version

### Mass_Update_Versions_Use_Latest.spec.ts

- **Test:** Mass Update Versions: Use Latest Version, with and without Allow Unapproved, for the Item dimension

  Steps / actions:
  1. create and approve item v0 (Campaign Manager tab stays open)
  2. assign an LCN to v0 while it is the only version
  3. back on the Campaign Manager tab: v1 (approved) and v2 (unapproved) via Save As New Version
  4. J1: Use Latest Version -> latest approved (v1), Updated
  5. J2: again -> already on latest approved, Error
  6. J3: Use Latest Version + Allow Unapproved -> v2, Updated
  7. J4: again with Allow Unapproved -> already on latest, Error

### Recreate_Master.spec.ts

- **Test:** Recreate Master creates a Label Master for a freshly-assigned Label Control record

  Steps / actions:
  1. create and approve a Campaign Manager item (no BarTender needed)
  2. assign a Label Control Number to the new item
  3. before: the item shows under "Without Label Master"
  4. after: the item now shows under "With Label Master"

### Redline_Compare.spec.ts

- **Test:** Redline Compare triggers the Create Temporary Master dialog then shows a real PDF comparison

  Steps / actions:
  1. create and approve two Campaign Manager items
  2. assign Label Control Numbers to both items
  3. Redline Compare with both records selected

### Update_Versions.spec.ts

- **Test:** Update Versions: shows current versions, blocks Submit until a change, and links an unapproved Master Data version

  Steps / actions:
  1. set up two approved items with control numbers (the second with an unapproved Master Data record)
  2. A. record with no Master Data: current versions shown, MD select disabled, Submit unclickable
  3. B. record with an unapproved Master Data record: starts on None, offers 0 Unapproved, Submit links it


## Label-Type-Management

### Label_Type_Actions.spec.ts

- **Test:** Label Type Management Actions: Excel Export, Adjust Page Size and Save/Load Search

  Steps / actions:
  1. Excel Export: dialog and a completed export job with a download link
  2. Adjust Page Size: Default Grid Count persists across a Retrieve (restored to 10 afterwards)
  3. Save Search / Load Search: save as new, load it back, delete

### Label_Type_Management.spec.ts

- **Test:** Label Type Management: layout, filters, View/Edit/Add dialogs (validation only) and audit

  Steps / actions:
  1. layout: Actions menu, filter, Limit Results (1000) and grid columns
  2. nav icons: Add is always available; Edit / View / Delete need a selected row
  3. View Record: read-only popup with just a Close button
  4. Edit Record: only Description is editable; the change persists and is restored
  5. Add Record: options and validation (every submit below is refused; nothing is created)
  6. Audit page

### Security_Gating.spec.ts

- **Test:** Label Type Management: tile, read-only mode and edit rights follow View_LabelTypes / Web_LabelTypes

  Steps / actions:
  1. without View_LabelTypes the tile is not shown (even with Web_LabelTypes)
  2. View_LabelTypes only: the module opens READ-ONLY (View works; Add / Edit / Delete do not; no Excel Import)
  3. + Web_LabelTypes: Add, Edit and Excel Import appear; Delete is still never offered
  4. cleanup: the fixture group is left with no authorizations


## Login-Password

### n_run.spec.ts

- **Test:** NeedsLetters N / NeedsNumbers N on every surface


## Lot-Management

### Lot_Management.spec.ts

- **Test:** Lot Management: grid, search, add (validation), edit, view, delete, audit

  Steps / actions:
  1. grid anatomy: columns, nav icons, Actions menu
  2. Add: ItemNumber / PrintEntity defaults; a valid lot is added and found by an exact LotNum search
  3. Add validation: NO field is required (a blank record is accepted once; a second blank record is "Record already exists"), a duplicate lot is refused
  4. Add with an UNKNOWN item number (observed): the lot is created or refused
  5. search operators: Contains, Exactly Matches on Order / Item / Print Entity, and no results
  6. Edit: ItemNumber, PrintEntity and LastTouch are read-only; changing Expires and U2 updates the grid
  7. View: the read-only record window shows the lot
  8. Audit action opens the audit trail for the lot (observed)
  9. Delete: asks to confirm; Cancel keeps the lot, Delete removes it

### Lot_Management_Edit_Entity_Lock.spec.ts

- **Test:** Lot Management Edit dialog: one Print Entity -> the Print Entity dropdown is locked (PE.161004.F.7.9)

  Steps / actions:
  1. the seed user adds an England lot
  2. an MB user with ONLY England opens the Edit dialog: Print Entity is England and locked
  3. cleanup: delete the lot, MB user without entities, group without processes

### Lot_Management_Excel.spec.ts

- **Test:** Lot Management Excel: template, export (name validation, limited / unlimited), import (validation errors, create, update)

  Steps / actions:
  1. Download Template: Lots_Template.xlsx, one sheet, the 12 column headers
  2. Excel Export: file name is required / validated; limited vs unlimited; the file holds the retrieved lots
  3. Excel Import validation: blank date cells are invalid ("Row 2 has an invalid DateTime value for the Expires column"); no Submit until validation succeeds
  4. Excel Import: two new lots are created (job Completed) and found in the grid
  5. Excel Import cannot UPDATE: an existing order/lot/item/entity is refused at validation ("Row 2 already exists"), the lot stays unchanged
  6. cleanup: delete every imported CLLIMP lot (also leftovers of an interrupted earlier run)

### Lot_Management_Excel_Print_Entity.spec.ts

- **Test:** Lot Management Excel Import with PrintEntityRequired = Y: the PrintEntity column is checked against the importing user

  Steps / actions:
  1. setup: the MB user may view lots and import, with the single entity England
  2. a blank PrintEntity cell is refused
  3. an entity the user does not hold (ROBAR) is refused with the same generic message (the script expects "Print Entity is not linked to the UserID")
  4. an entity that does not exist is refused
  5. the user\'s own entity (England) validates and imports; the lot carries England
  6. cleanup: delete the lot, remove the entity from the MB user, group without processes

### Lot_Management_Print_Entity.spec.ts

- **Test:** Lot Management: the rows and the Add dialog follow the user's Print Entities

  Steps / actions:
  1. setup: the MB group can view / add / change lots; the test user adds a ROBAR lot and an England lot
  2. NO Print Entity: "No records to view"; the Add icon stays ENABLED but the dialog\'s Print Entity list is empty (live 2026-10-08; the formal script PE_LotManagment expects every icon disabled)
  3. ONE entity (England): only the England lot is listed; the Add dialog\'s Print Entity is England and read-only
  4. TWO entities (ROBAR + England): both lots are listed and the Add dialog offers both entities
  5. ALL (*): both lots are listed
  6. cleanup: delete the lots, remove the entities from the MB user, leave the group without processes

### Lot_Management_Print_Entity_Off.spec.ts

- **Test:** Lot Management with PrintEntityRequired = N: ROBAR only, lots visible to every user, import accepts only ROBAR (invalid value message)

  Steps / actions:
  1. setup: the MB group can view / add lots; the test user adds a ROBAR lot; its Add dialog offers only ROBAR
  2. MB user with entities ${JSON.stringify(entities)}: the lot is listed, Add is enabled, the Print Entity dropdown is ROBAR only
  3. Excel Import: a PrintEntity other than ROBAR is refused ("ROBAR is a required value for this column")
  4. cleanup: delete the lot, remove the entities from the MB user, leave the group without processes

### Lot_Management_Process_Icons.spec.ts

- **Test:** Lot Management: each process (Add / Change / Delete / Excel Import) switches on its own icon or menu item

  Steps / actions:
  1. setup: LE_View_Lots only; the MB user gets the ROBAR entity; the test user adds the throw-away lot
  2. cleanup: delete the lot, remove the entity from the MB user, leave the group without processes

### Lot_Management_Requirements.spec.ts

- **Test:** Lot Management vs ValMaster: icon states, row Actions, date defaults, Excel Import page rules

  Steps / actions:
  1. LM.160210.F.1.6: no row selected -> pencil / page / trash disabled; one row -> all enabled; several rows -> pencil and page disabled, trash enabled
  2. LM.160210.F.1.7: the row-level Actions dropdown offers View Print History, View Lot Data Override, View Serial Numbers, View Locked LCNs
  3. LM.150420.F.4.2: Expires, Manufactured and Reassay default to today in the Add Record window
  4. LM.150420.F.5.11 / F.5.15: Excel Import page - nothing can proceed before a file is chosen; one worksheet -> the Sheet dropdown is disabled with that name; several -> enabled
  5. LM.150420.F.5.12 / F.5.5: validation errors list row-level errors and a Reset button lets the user upload a new file; duplicate rows inside the sheet are reported
  6. LM.150420.F.5.8: dates in other formats (text "2027-12-31" / "31-Dec-2027") are converted to MM/DD/YYYY on import
  7. PE.161004.F.7.1: with PrintEntityRequired = N the Print Entity dropdown is NOT displayed in the Add Record / Edit Record dialog (Print Entity = ROBAR automatically); skipped when the setting is Y
  8. cleanup: delete the imported / added lots, remove the MB entity and processes

### Lot_Management_Save_Load_Search.spec.ts

- **Test:** Lot Management: Save Search (new / overwrite / duplicate / required) and Load Search restore the criteria

  Steps / actions:
  1. Retrieve with LotNum contains MBMDPL
  2. Name and Description are required
  3. Save the search (new the first time, overwrite afterwards)
  4. Save As New with an existing name is refused
  5. Overwrite does NOT update the description in the Load Search list (observation)
  6. Reset, then Load Search brings the criteria back (only MBMDPL lots)

### Lot_Management_Security.spec.ts

- **Test:** Lot Management security: icons per process, view-only window, and the missing server-side checks

  Steps / actions:
  1. setup: group = Login_WebMenu + LE_View_Lots; the MB user gets the ROBAR Print Entity; the test user adds lots L1, L2, L3
  2. LE_View_Lots only: the user sees the lots (Print Entity ROBAR), Add / Edit / Delete icons are disabled, double-click opens the read-only View window, Excel Import is hidden
  3. SERVER-SIDE (documented gap): with ONLY LE_View_Lots the user can still edit L2, add L4 and delete L1 by calling the endpoints from his page
  4. cleanup: delete the throw-away lots, remove the Print Entity from the MB user, leave the group without processes


## Master-Data-Management

### Bulk_Assign_GTIN.spec.ts

- **Test:** Assign GTIN generates GTINs, warns before overwriting, and refuses approved records

  Steps / actions:
  1. create A, B, C; approve C
  2. Unit of Use DI Number + Company Prefix: a GTIN is generated for each record
  3. Primary DI Number already has a value: the overwrite warning appears
  4. an approved record is refused

### Bulk_Assign_GTIN_Source_DI.spec.ts

- **Test:** Assign GTIN with an Add Source DI Field row derives the GTIN from the record's own DI and replaces the indicator digit

  Steps / actions:
  1. create two unapproved records with known Primary DI Numbers
  2. page: one Company Prefix row; "Add Source DI Field" adds a Source DI row, "Remove" takes a row away
  3. run both rows: counter GTIN on Unit of Use, Source-DI GTIN (packaging code 1) on Package DI
  4. the Primary DI Number itself is untouched

### Bulk_Assign_Labels.spec.ts

- **Test:** Assign Labels creates unapproved Campaign Manager items for the selected records

  Steps / actions:
  1. create two MDM records
  2. Assign Labels job (Carton Label): validation, then Completed
  3. both items now exist in Campaign Manager, unapproved

### Bulk_End_Distribution.spec.ts

- **Test:** End Distribution sets the distribution end date and can prepare a new DI version

  Steps / actions:
  1. create two records
  2. End Distribution without "Prepare for new DI"

### Bulk_Mass_Approve.spec.ts

- **Test:** Mass Approve approves three unapproved records in one job

  Steps / actions:
  1. create three unapproved records
  2. all three show as Unapproved, none as Approved
  3. Mass Approve job page: count and an empty submit is refused client-side
  4. submit the job: Completed, and the records are now Approved

### Bulk_Mass_Retire_Unretire.spec.ts

- **Test:** Mass Retire - Unretire: retire, mixed-selection warning, unretire

  Steps / actions:
  1. create three active records
  2. Retire A + B: Retire is preselected, the job completes and they are inactive
  3. a mixed active + inactive selection shows the warning
  4. Unretire A + B: Unretire is preselected with an Effective End Date, and they are active again

### Bulk_Mass_Update.spec.ts

- **Test:** Mass Update sets a field on every selected record

  Steps / actions:
  1. create two records with a different Brand Name
  2. Mass Update job page: validation, then set Brand Name on both
  3. both records now carry the new Brand Name (grid filter)

### Bulk_Save_As_New_Version.spec.ts

- **Test:** bulk Save as New Version refuses unapproved records and versions approved ones

  Steps / actions:
  1. create A, B, C; approve B and C with a Mass Approve job
  2. an unapproved record is not eligible for a new version
  3. approved B + C: the job page, then Version 1 appears for both

### Create_New_Record.spec.ts

- **Test:** new record creates item-schema and non-item-schema master data records, and rejects a duplicate item number

  Steps / actions:
  1. creates a new record for an item schema (${schemaName})
  2. attempting to create a second record with the same Item Number is rejected
  3. creates a new record for a non-item schema (MBNonItemSchema)

### Data_Retrieval_Filters.spec.ts

- **Test:** For Items, Latest Version Only, Effective Only, operators and Limit Results return the expected rows

  Steps / actions:
  1. create A, B (+ unapproved v1), Z (expired), U
  2. For Items: Any / Approved / Unapproved
  3. Latest Version Only and Effective Only
  4. operators on Item Number
  5. Limit Results caps the retrieve

### Excel_Import.spec.ts

- **Test:** Excel Import: template, valid import, failure modes, override and the overwrite prompt

  Steps / actions:
  1. Download Template gives the schema\'s own headers (ItemNumber, Description, EffectiveBegin, EffectiveEnd, then the field captions)
  2. page validation: Submit stays disabled until a file and the signature are supplied; unsupported extension is refused
  3. valid import: two rows + an unrecognised column -> Completed, no errors, records created unapproved at v0
  4. missing required column: job-level "Missing Columns" and an EMPTY Errors Only grid
  5. blank required cell -> row error "Brand Name: Required"; invalid dropdown value -> "InvalidValue"
  6. a mixed sheet (one valid row, one with a blank required cell): observe what is imported
  7. the failed job offers a Download Spreadsheet link (the uploaded file name)
  8. Validation Rules Override lets the blank required cell import
  9. overwrite prompt: "No" creates no job; "Yes" updates an UNAPPROVED record in place

### Excel_Import_Security.spec.ts

- **Test:** MDM Excel Import: tile, direct URL and override checkbox follow MD_ExcelImport_Web / MD_Validation_Override

### Export_to_Excel.spec.ts

- **Test:** Export to Excel: records what happens and validates the file if one arrives

  Steps / actions:
  1. create two records
  2. Export to Excel dialog: options, then Continue

### MD_Job_Inquiry.spec.ts

- **Test:** MD Job Inquiry finds a Mass Approve job by its Job Id and opens its detail

  Steps / actions:
  1. run a Mass Approve job and read its Job Id
  2. MD Job Inquiry: filter Display Id = the job id, Retrieve, open the detail
  3. the same job is also found by one of its ITEM numbers

### Quick_Edit.spec.ts

- **Test:** Quick Edit pages through selected records and saves only the changed ones

  Steps / actions:
  1. create three records
  2. no extra fields selected: the page explains it needs at least one editable column
  3. select Brand Name + Catalog Number, open Quick Edit
  4. edit two records with Save & Next, leave the third alone
  5. the grid shows the two edited records changed and the third unchanged
  6. unsaved changes: navigating away asks before discarding

### Record_Lifecycle.spec.ts

- **Test:** MDM record lifecycle: validation, approve + lock, new version, retire / unretire, save as new record

  Steps / actions:
  1. a fresh record is Version 0, unapproved, Effective End 12/31/2099
  2. validation: clearing a required field blocks Save with the module-wide popup
  3. Approve (e-signature): Approved By is filled in and the record locks
  4. Save as New Version: confirm dialog, then an unapproved Version 1 opens
  5. Retire the record (e-signature), then Unretire it
  6. Save As New Record: copies the record under a new item number

### Save_and_Load_Search.spec.ts

- **Test:** Save Search / Load Search / Overwrite / duplicate name / delete

  Steps / actions:
  1. save a search (filter on Brand Name, For Items = Unapproved)
  2. after the filter is changed, Load Search brings the saved criteria back
  3. Save As New with the same name is refused; Overwrite replaces the criteria
  4. cleanup: delete the "PWSearch*" searches owned by the test user (this run\'s, plus any a failed run left)

### Schemas_Dropdown_Sources_Export.spec.ts

- **Test:** Schema Dropdown sources (static / linked / query) validate, save, render and appear in Export Schema

  Steps / actions:
  1. Static List: add the PW Static field with two options
  2. Linked Field: Dropdown Schema list, then Option Text / Option Value field lists for the chosen schema
  3. Database Query: a "Remote System SQL" textarea; an empty query makes the schema unsaveable
  4. Save all three fields (the query now has a value)
  5. Export Schema: downloads <Schema>.sql for the SAVED schema, naming the new fields and the linked schema
  6. the saved fields reload with their sources; the linked dropdown renders LabelerDuns records on a blank New Record page
  7. cleanup: delete the added fields; the fixture is back at its baseline (and still has no data)

### Schemas_Field_Editor.spec.ts

- **Test:** Schemas editor: add fields with settings, persist, validate, delete (no-data fixture schema)

  Steps / actions:
  1. baseline: an item schema without data
  2. New Schema dialog validation (nothing is created)
  3. add four fields with settings and Save
  4. reload: every added field persisted with its settings
  5. an empty caption blocks Save client-side
  6. share names: two fields with the SAME share name in one schema (observed outcome)
  7. cleanup: delete the added fields and Save; the fixture is back at its baseline

### Schemas_Field_Settings_Effect.spec.ts

- **Test:** Schema field settings show up on a blank New Record page (required, length, mask, default, protected, hidden)

  Steps / actions:
  1. fixture: a non-item schema with no data
  2. add the five fields and Save the schema
  3. blank New Record page: render, defaults, protected and hidden fields (NOT saved)
  4. cleanup: delete the added fields; the fixture is back at its baseline (and still has no data)

### View_History.spec.ts

- **Test:** View History lists the per-version field changes, filters by field and opens a record snapshot

  Steps / actions:
  1. build a record with a known history (v0: create, edit, approve; v1: new version + edit)
  2. v0 history: header, the initial values, the Brand Name edit and the approval date
  3. v1 history is per version: only its own Brand Name change
  4. Field filter narrows the grid; View Detail opens a record snapshot dialog
  5. Change User filter: selecting a user keeps that user\'s rows


## Print-Entity

### Print_Entity_Inactive.spec.ts

- **Test:** Print Entity: an inactive entity assigned to the user never appears on the print screens

  Steps / actions:
  1. ONLY an inactive entity (Mars): every print screen refuses with the hard-block message
  2. England (active) + Mars (inactive): only England, pre-selected and disabled
  3. cleanup: the MB user has no entities, the group no processes

### Print_Entity_Print_Screens.spec.ts

- **Test:** Print Entity (PrintEntityRequired = Y): every print screen follows the user's active entities

  Steps / actions:
  1. NO active Print Entity: every screen refuses with the hard-block message and shows no dropdown
  2. ONE entity (England): dropdown pre-selected and disabled on every screen
  3. TWO entities (ROBAR + England): editable dropdown, ascending, default England
  4. cleanup: the MB user has no entities, the group no processes

### User_Print_Entity_Management.spec.ts

- **Test:** User Print Entity Management: grid, multi-user update, tri-state, "*" exclusivity, unsaved-changes prompt

  Steps / actions:
  1. the grid lists users with their Print Entity; columns and the User ID filter
  2. Bulk Actions with nothing ticked asks to select records
  3. Update screen for two users: entity list, Records Selected, filter dropdown
  4. assign ROBAR to both users -> "Update successful", the grid shows ROBAR for both
  5. tri-state: England for ONE user -> indeterminate when both are selected
  6. "*" (All) is exclusive: checking it disables and unchecks every named entity; unchecking it frees them
  7. leaving with unsaved changes prompts "Changes will not be saved."; No stays, Yes leaves
  8. cleanup: remove every entity from the two MB users again


## Print-History-Inquiry

### Print_History_Inquiry_Requirements.spec.ts

- **Test:** Print History Inquiry vs ValMaster: security entry, search criteria, results, row actions, serialization (read-only)

  Steps / actions:
  1. FRS-15.1.1.1: no access without logging in (direct URLs in a fresh session: the grid data, the See Detail page, the label image)
  2. FRS-15.1.2.1 / 15.1.7.1 / URS-15.1.2: Column, Operator and Value controls; the Column list holds the Print History columns
  3. FRS-15.1.7.2: a second filter can be added with an And / Or operator, and removed again
  4. FRS-15.1.7.5: the Value box is type-sensitive (a date picker / number box for date and number columns)
  5. FRS-15.1.7.4: a "Reset All" button clears the criteria and the results
  6. URS-15.1.7: Retrieve Data returns the right records (Exactly Matches on PrintID)
  7. FRS-15.1.6.1 / URS-15-1.6 / FRS-15.1.7.3: one record at a time; Select Action + Do Action only after results
  8. FRS-15.1.3.x / URS-15-1.3: the row Actions menu lists the plug-in actions
  9. FRS-15.1.3.2: See Image opens the label image
  10. FRS-15.1.3.3: See Detail shows the print job details for the print id, with reprint activity when there is any
  11. Print Data Values (extra action): the share names and values sent to the label
  12. FRS-15.1.3.4 / 15.1.3.5: Exact Reprint and Regenerate open their print screens (nothing is printed)
  13. SER...F5.0.3: Serialization Detail lists Print ID, print date/time, serial #, reprint, user for a serialized print; "No Serials found!" for a plain print
  14. DIT #6600 (open): Test Prints are listed in Print History
  15. URS-15.1.5: an empty result says so
  16. page-level Actions menu (observation)

### Print_History_Inquiry_Security.spec.ts

- **Test:** Print History Inquiry security: PrintHist_Login gates the tile; BP_Reprint_Label / BP_Exact_Reprint_Print / BP_SerializationDetail gate the actions

  Steps / actions:
  1. FRS-15.1.1.2: without PrintHist_Login the tile is not offered
  2. FRS-15.1.1.2 / 15.1.1.3: with PrintHist_Login only: the tile, the grid and the three read-only actions; no Regenerate / Exact Reprint / Serialization Detail
  3. FRS-15.1.1.3 / SER...F5.0.2: with BP_Reprint_Label, BP_Exact_Reprint_Print and BP_SerializationDetail all six actions are offered
  4. FRS-15.1.1.3: a user who may print (Print_Label) but lacks the reprint processes: the Exact Reprint screen URL (annotated)
  5. each action process alone adds exactly its own action


## Security-Management

### Security_Effect_On_Login.spec.ts

- **Test:** Security Management changes drive the module tiles and the read-only Security page of a real MB user

  Steps / actions:
  1. fixtures: group MBPWLoginGrp and active user MBPWLogin01 in it (created only if missing)
  2. S-1: no authorizations -> the login is refused ("User not authorized for this task.")
  3. S0: only Login_WebMenu -> the Main Menu opens with a baseline set of tiles
  4. S1: + MD_Management_Option -> the Master Data tile appears
  5. S2: + MD_JobInquiry_Option -> MD Job Inquiry appears; removing MD_Management_Option removes Master Data again
  6. S3: only View_Security -> Security Management opens READ-ONLY (no Add/Edit, all checkboxes disabled)
  7. cleanup: the fixture group is left with no authorizations

### Security_Groups.spec.ts

- **Test:** Security Management Groups: filters, add/edit group, copy security, toggle processes and Select All

  Steps / actions:
  1. layout: Groups is the default view; process table lists every process; filters narrow it
  2. Add Group: dialog fields and validation (blank, too long, duplicate)
  3. read ${SOURCE}'s authorizations (to compare with the copy)
  4. Add Group with "Copy Security Settings From = GROUP - ${SOURCE}" creates ${group} with the same authorizations
  5. Edit Group: the Group name is locked, the Description can be changed
  6. a process checkbox posts immediately and persists across a reload
  7. Select All authorizes every process; unchecking it removes them all

### Security_Management_Requirements.spec.ts

- **Test:** Security Management vs ValMaster: tooltip, reset-at-next-logon, inactive user, EditUsersAndGroups / EditSecurity gating

  Steps / actions:
  1. F.8.5: hovering a process name shows its Description (tooltip)
  2. F.2.12: a new user has "Reset password at next logon" on and blank passwords; the first login asks for a new password
  3. F.2.7: an inactive user cannot access any module (login refused)
  4. F.7.1 / F.9.2: View_Security + Security_EditUsersAndGroups: Add / Edit work, process checkboxes, Select All and Copy Security Settings From are disabled
  5. F.7.2: View_Security + Security_EditSecurity: process checkboxes and Select All work, Add / Edit icons are disabled

### Security_Users.spec.ts

- **Test:** Security Management Users: filters, add/edit user, copy security, group inheritance and deactivation

  Steps / actions:
  1. Users view: columns and the UserID / Full Name / Group filters
  2. Add User: defaults and validation (blank, too long, password mismatch, duplicate)
  3. Add User ${user} with "Copy Security Settings From = GROUP - ${SOURCE_GROUP}": ungrouped, with its own copy of the set
  4. assigning a Group replaces the user\'s set with the group\'s (read-only); removing it reverts
  5. Edit User: deactivate -> greyed row, hidden by "Show Active Users Only"; details persist


## Template-Management

### Comments.spec.ts

- **Test:** view/edit comments supports adding, canceling an edit, editing, and deleting a comment

  Steps / actions:
  1. create a throwaway template to comment on
  2. query for the template
  3. dialog shows the expected header and empty state
  4. adds a new comment
  5. cancels an in-progress edit without changing the comment
  6. edits the comment
  7. deletes the comment

### Create_Approved_Template_and_Item.spec.ts

- **Test:** create and approve a new template, create and approve an item using it, and assign it a Label Control Number

  Steps / actions:
  1. Part 1: create and approve the template (Template Management)
  2. resolve Playwright\'s own browser process id
  3. confirm the native "Open SentinelLauncher?" prompt
  4. find the BarTender process Sentinel launches
  5. configure and approve the template in BarTender via FlaUI
  6. Part 2: create and approve a Campaign Manager item using that template
  7. Part 3: assign the item a Label Control Number (Label Control)

### Create_and_Approve_Template.spec.ts

- **Test:** create a new template and upload its file

  Steps / actions:
  1. resolve Playwright\'s own browser process id
  2. confirm the native "Open SentinelLauncher?" prompt
  3. find the BarTender process Sentinel launches
  4. configure the template in BarTender via FlaUI
  5. close Template Management and log out of the WebMenu

### Download.spec.ts

- **Test:** download supports both row-level (single file) and bulk (zip) downloads

  Steps / actions:
  1. create a throwaway template to download
  2. query for the template
  3. row-level Download downloads the raw .btw file
  4. rejects Bulk Actions Download with nothing selected
  5. bulk Download zips the selected template

### Edit_Attributes.spec.ts

- **Test:** edit attributes updates a template's description, and rejects a blank one

  Steps / actions:
  1. create a throwaway template to edit attributes on
  2. query for the new template and open Edit Attributes
  3. rejects a blank Description
  4. submits a valid Description update

### Get_Data.spec.ts

- **Test:** get data loads the associated item's data into the template, then restore reverts it

  Steps / actions:
  1. create a template with real Item-level sharenames (A1SuperTemplate content)
  2. create an item associated with the new template
  3. return to Template Management and reopen the template
  4. Get Data, Submit against the associated item, then Restore

### Get_Data_Master_Data.spec.ts

- **Test:** Get Data fills the template with the item's approved Master Data values (md_brand, md_primedi ...)

  Steps / actions:
  1. template from A1SuperTemplate
  2. item on the template
  3. approved Master Data record for the item with a known Brand Name
  4. open the template, Get Data, screenshot before/after

### Get_Data_Options.spec.ts

- **Test:** Get Data options: unapproved Master Data on/off and Use Sample Data

  Steps / actions:
  1. template from A1SuperTemplate
  2. item on the template
  3. UNAPPROVED Master Data record for the item (Brand Name known)
  4. open the template in BarTender and try the three Get Data modes

### Mass_Approve_Negative.spec.ts

- **Test:** Approve Templates: nothing selected, wrong password, incomplete form and an already-approved template

  Steps / actions:
  1. nothing ticked: Approve Templates answers "Please select one or more records."
  2. job page: fields, reasons, Submit stays disabled until everything is filled, wrong password is refused
  3. an ALREADY-APPROVED selection disables the whole job form

### Mass_Approve_Templates.spec.ts

- **Test:** mass approve templates approves the selected template

  Steps / actions:
  1. create a throwaway unapproved template
  2. query for it, check it, and start the Approve Templates bulk action
  3. submit the approval job
  4. confirm the template now shows as approved

### Mass_Retire_Unretire_Templates.spec.ts

- **Test:** mass retire and unretire templates toggles the selected template

  Steps / actions:
  1. create a throwaway template to retire
  2. query for the new template
  3. retire it
  4. confirm it is now retired, then unretire it

### Replace_Template.spec.ts

- **Test:** replace template rejects a mismatched file type and replaces the template with a valid one

  Steps / actions:
  1. create a throwaway template to replace
  2. query for the new template and open Replace Template
  3. rejects a file of the wrong type
  4. submits a valid file, then cancels the confirmation (no replace should happen)
  5. re-opens Replace Template and actually replaces it this time
  6. confirms the replacement via View Label Characteristics

### Save_As_New.spec.ts

- **Test:** save as new creates an independent copy of the template under a new name

  Steps / actions:
  1. create a throwaway source template with a known sharename
  2. query for the source template and open Save As New
  3. New Version is disabled and New Template/Label Type is selected for an unapproved source
  4. rejects a submission with all fields left blank
  5. rejects a duplicate template name
  6. submits a valid, unique name and confirms the new template opens in BarTender
  7. confirms the new template is independent and carries the source content

### Search_and_Filter.spec.ts

- **Test:** Template Management search and filter: criteria rows, operators, Approved dropdown, data source, limits, paging, reset

  Steps / actions:
  1. page layout: Main Actions, filter controls and grid columns
  2. operators on Template Name
  3. Approved dropdown combines with the criteria rows (AND)
  4. Limit Results, Latest Version Only, Effective Only and paging
  5. Filter by Data Source: the multi-select share-name list narrows the templates
  6. Reset restores the defaults

### Security_Gating.spec.ts

- **Test:** Template Management: tile, label-type visibility and per-process action gating for a real MB user

  Steps / actions:
  1. without Web_Template_Management the tile is not shown
  2. label type security: without LT_Carton Label the Carton Label templates are not searchable
  3. with the tile + LT_Carton Label but no TM_* process every action is flagged "User not authorized ... TM_x"
  4. ${m.process} alone enables exactly: ${[...m.row, ...m.bulk.map((b) => 'bulk ' + b)].join(', ')}
  5. with every TM_* process the menus are open, but approved templates still block Replace Template / Edit Attributes
  6. cleanup: the fixture group is left with no authorizations

### Submit_to_Workflow.spec.ts

- **Test:** submit to workflow submits a template into a workflow preset

  Steps / actions:
  1. create a throwaway template
  2. query for it, check it, and start Submit to Workflow
  3. fill and submit the workflow job

### View_Edit_Template.spec.ts

- **Test:** view/edit template opens an existing template and persists a change made to it

  Steps / actions:
  1. create a throwaway template, unmodified, to view/edit afterward
  2. query for the template and open it via View/Edit Template
  3. modify the template in BarTender and save
  4. confirms the edit persisted via View Label Characteristics

### View_Label_Characteristics.spec.ts

- **Test:** view label characteristics shows a newly created template's attributes

  Steps / actions:
  1. create a template with a text object bound to a real sharename
  2. filter the grid for the new template and open View Label Characteristics


## Workflow-Management

### Attachments.spec.ts

- **Test:** workflow attachments: add, duplicate refused, closed-workflow warning, download, delete

  Steps / actions:
  1. setup: preset (one step for the test user) and two workflows A and B
  2. a new workflow has no attachments; the upload page shows the workflow, Submit is disabled until a file is chosen
  3. Submit adds the file to the OPEN workflow (no warning); the Attachments tab lists it with user, date and name
  4. the same file name again is refused as a duplicate
  5. two different files in ONE submit are both added
  6. Download returns the uploaded bytes
  7. Delete asks for confirmation; No keeps the file, Yes removes it
  8. close workflow B (approve it), then attaching to the CLOSED workflow warns first; Cancel adds nothing, Continue adds the file
  9. cleanup: close A (reject) and delete the throw-away preset

### Attachments_Security.spec.ts

- **Test:** workflow attachments security: add on open / closed, delete own / any user / closed

  Steps / actions:
  1. setup: group can vote; preset [test user, MB user] group 1; A stays open, B is closed by both votes; the test user attaches a file to each
  2. no attachment process: Add Attachments is disabled on open AND closed workflows; no Delete is enabled
  3. WM_AddAttachment_Open: Add enabled on the OPEN workflow only
  4. WM_AddAttachment_Closed (without Open): Add enabled on the CLOSED workflow only
  5. WM_DeleteWFAttachments: the MB user can delete only HIS OWN file (the test user\'s file stays locked)
  6. + WM_DeleteWFAttachments_Anyuser: the other user\'s file is deletable too
  7. a CLOSED workflow\'s attachments can never be deleted, even with both delete processes
  8. cleanup: close A (both reject), delete the preset, leave the group without processes

### Edit_Workflows.spec.ts

- **Test:** Edit Workflows: add user at end / beginning, replace user, delete user on two open workflows

  Steps / actions:
  1. setup: preset with one step for the test user; reject leftover open "PW edit" workflows; create workflows A and B
  2. Edit Workflows lists both workflows with the identical step list as ONE group (Count 2)
  3. required user: Create with no user -> error "User must be selected."
  4. Add User > Add to End: MBUser3 becomes the last step of BOTH workflows
  5. Add User > Add to Beginning: MBUser4 becomes the FIRST step
  6. Replace User: MBUser3 -> MBUser5
  7. Delete User: MBUser4 then MBUser5 -> only the test user is left
  8. close both: A approved, B rejected (the test user is the only step left)
  9. cleanup: delete the throw-away preset

### Edit_Workflows_Add_To_Group.spec.ts

- **Test:** Edit Workflows: Add User > Add to Group (inside a group vs insert a new group)

  Steps / actions:
  1. setup: preset [test user group 1, MBUser3 group 2] and workflows A and B
  2. Add to Group (inside group 1): MBUser4 joins group 1, no new group is created
  3. Insert Group at 1: MBUser5 becomes the NEW group 1 and the old groups shift up
  4. cleanup: remove MBUser3 / 4 / 5 from both workflows, vote them closed, delete the preset

### Edit_Workflows_Voted_Steps.spec.ts

- **Test:** Edit Workflows with an already voted step: observe warning, per-workflow messages and the resulting steps

  Steps / actions:
  1. setup: preset [test user g1, MBUser3 g2], W1 (test user already approved) and W2 (untouched)
  2. OBSERVE: Edit Workflows with W1 (voted) + W2 together
  3. cleanup: remove MBUser3/MBUser4 from each workflow, close both (closeWorkflow adds a step if all steps are voted), delete the preset

### Export_to_Excel.spec.ts

- **Test:** Workflow Management Export to Excel downloads a valid workbook with the ticked workflows (the old 503 does not reproduce)

### Filters.spec.ts

- **Test:** Workflow Management filters: Included vs Can Vote, open-for-voting, status, limit, select all / page

  Steps / actions:
  1. setup: two-step preset (test user, MBUser3), workflows W1 and W2; the test user votes W1 (approve) so it waits for MBUser3
  2. "Can Vote" (default) lists only workflows waiting for the user: W2 yes, W1 (already voted, now waits for MBUser3) no
  3. "Included" lists every workflow the user is part of: W1 and W2, many more than Can Vote
  4. "Show item open for voting" narrows Included down to the workflows the user can vote on now
  5. status filter on Included: Open Only keeps W1 and W2 and drops closed ones; Closed Only has neither
  6. Limit Results caps the number of rows retrieved
  7. Select Page ticks the 10 rows of the page; Select All ticks every retrieved row ("Checked Rows: N")
  8. Field Definitions dropdown and the change-control selector are present (observed)
  9. cleanup: remove MBUser3 from both workflows (Edit Workflows), close them, delete the preset

### Item_Workflow.spec.ts

- **Test:** item workflow: Send to Workflow locks the item; approving closes it Approved (by the workflow id), rejecting releases it

  Steps / actions:
  1. setup: a throw-away preset (one step for the test user)
  2. item ${key}: create it and Send to Workflow (Campaign Manager bulk action)
  3. while the workflows are open both items are LOCKED
  4. Workflow Management lists them with the generated description; the Detail dialog opens
  5. vote: approve item A, reject item B (one View And Vote job)
  6. the items follow their workflows: A approved BY THE WORKFLOW ID and editable-state changes; B released unapproved
  7. cleanup: delete the throw-away preset

### Linked_Documents.spec.ts

- **Test:** Linked Documents: item and template workflows open Link Management pre-filtered; a standalone workflow has no button

  Steps / actions:
  1. ITEM workflow: Linked Documents -> Link Management filtered by Item Number, Item Version and Label Type
  2. TEMPLATE workflow: filtered by Template Name, Template Version and Label Type
  3. a STANDALONE workflow (no item / template) has no Linked Documents button

### Linked_Documents_Security.spec.ts

- **Test:** Linked Documents security: the button is disabled without LM_View_LinkManagement and opens Link Management with it

  Steps / actions:
  1. setup: group can vote; preset [test user, MB user] in group 1
  2. Template Management: Submit one unapproved MBGDMD template to the preset (Submit to Workflow job)
  3. without LM_View_LinkManagement the Linked Documents button is DISABLED
  4. with LM_View_LinkManagement the button is enabled and opens Link Management filtered by the template
  5. cleanup: both voters reject the workflow; delete the preset; leave the group without processes

### Multi_Step_Presets.spec.ts

- **Test:** multi-step presets: sequential groups, parallel group, Vote For Entire Group, Veto

  Steps / actions:
  1. setup: MBPWLoginGrp can vote; leftover CLPW presets are removed
  2. S1 sequential groups [test user (group 1), MB user (group 2)]: after the first approval the workflow stays Open and moves to the MB user; the MB approval completes it
  3. S2 parallel group [test user + MB user, both group 1]: both can vote at once; Open until both approved
  4. S3 Vote For Entire Group [test user with the box ticked + MB user, group 1]: the test user\'s single approval completes the workflow
  5. S4 a plain reject [test user (g1), MB user (g2)]: one reject does NOT close the workflow (no veto); it is decided when every step has voted
  6. S5 parallel group, plain reject [test user + MB user, group 1]: observe what one reject does
  7. S6 Veto [test user + MB user (Vote Counts as Veto = Reject), group 1]: observe the MB user\'s reject
  8. cleanup: close leftover workflows (test user votes / MB user votes), delete the presets, leave MBPWLoginGrp without processes

### Preset_Management.spec.ts

- **Test:** Preset Management: create, add and edit steps, Save As, deactivate and delete a preset

  Steps / actions:
  1. page: preset list and the Create New Preset dialog validation
  2. create ${name}: it is selected, Active is on and has no steps
  3. Add Step: defaults, validation and creating two steps
  4. Edit Step: Update and Delete Step (with a confirmation)
  5. Save As clones the steps into a new preset (name validated)
  6. description edit and the Active checkbox persist; an inactive preset stays in the list
  7. cleanup: delete the throw-away presets

### Report.spec.ts

- **Test:** workflow summary report: required subdirectory, merged PDF and one PDF per workflow on the report share

  Steps / actions:
  1. setup: preset (one step for the test user) and two workflows
  2. the dialog: Subdirectory + Merge checkbox (checked by default), Cancel/Submit; a blank subdirectory shows "Required"; Cancel creates nothing
  3. merged: one WorkflowReport_Merged_<date>.pdf in the chosen subdirectory
  4. not merged: one PDF per workflow
  5. cleanup: close the two workflows (reject) and delete the throw-away preset

### Security_Gating.spec.ts

- **Test:** Workflow Management security: menu gating per process and the comment-required-on-reject rule

  Steps / actions:
  1. S0 (Login_WebMenu + Web_WorkflowManagement): module opens; Create New Workflow and Preset Management are greyed with their process in the tooltip
  2. S1 (+ WM_ViewAndVote): Claude01 sets up a preset whose step is the MB user, and two workflows
  3. S1: the MB user sees both workflows; Bulk Actions: View And Vote + Export enabled, Edit Workflows + Report disabled
  4. S1: on the View And Vote page every vote checkbox is DISABLED without WM_ViewAndVoteCheckBox
  5. S1b (+ WM_ViewAndVoteCheckBox): Reject + Detail with no comment -> "Comments are required for rejected workflows." (Reject is unticked); the grid path with no comment still goes through
  6. S2 (+ WM_ViewAndVoteSkipComment): the same Reject + Detail shows NO comment message
  7. S3 (+ Create New Workflow, Create Workflow Preset, WorkflowEdit_Option, WF_Generate_Report): every menu item is enabled
  8. cleanup: delete the throw-away preset; leave the group without processes

### Template_Workflow.spec.ts

- **Test:** template workflow: Submit to Workflow for two templates, then approve one and reject the other

  Steps / actions:
  1. setup: a throw-away preset (one step for the test user)
  2. setup: reject leftover OPEN template workflows of earlier runs (a template can only be in one open workflow)
  3. create a new template from A1SuperTemplate (BarTender save + close)
  4. Template Management: tick the new template and an unapproved MBGDMD fixture -> Submit to Workflow (one job)
  5. Workflow Management lists the two template workflows (description "Template: ...")
  6. vote: approve the new template, reject the fixture
  7. Template Management: the new template is approved BY THE WORKFLOW, the rejected fixture is still unapproved
  8. cleanup: delete the throw-away preset

### Workflow_Lifecycle.spec.ts

- **Test:** create two workflows from a preset, find and inspect them, vote one approved and one rejected in a single job

  Steps / actions:
  1. setup: a throw-away preset with one step for the test user
  2. Create New Workflow twice: required fields, the preset shows its steps, Submit Job -> Workflow Ids
  3. find them (newest first), status Open, and the Detail dialog tabs
  4. View And Vote: approve A and reject B in ONE job
  5. both are closed: Open Only no longer lists them, Closed Only does (A Approved, B Rejected)
  6. cleanup: delete the throw-away preset

